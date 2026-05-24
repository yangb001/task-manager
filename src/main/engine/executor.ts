import { v4 as uuidv4 } from 'uuid';
import type { Task, Action } from '../../shared/types';
import { taskRepo, triggerRepo, actionRepo, executionLogRepo, getDatabase, markDirty } from '../database';
import { pluginManager } from '../plugin';
import { sanitizeForLog } from '../utils/sanitize';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return promise;
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 执行超时 (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

interface RetryConfig {
  max_retries?: number;
  delay_sec?: number;
  backoff?: 'fixed' | 'exponential';
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retry: RetryConfig | undefined,
  logger: { warn: (...args: any[]) => void },
): Promise<T> {
  const maxAttempts = (retry?.max_retries || 0) + 1;
  const baseDelay = (retry?.delay_sec || 5) * 1000;
  const backoff = retry?.backoff || 'exponential';

  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = backoff === 'exponential' ? baseDelay * Math.pow(2, attempt) : baseDelay;
        logger.warn(`第 ${attempt + 1} 次尝试失败，${delay}ms 后重试...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export class Executor {
  private runningTasks = new Set<string>();

  isRunning(taskId: string): boolean {
    return this.runningTasks.has(taskId);
  }

  async executeTask(taskId: string, triggerId?: string, triggerData?: Record<string, any>): Promise<void> {
    if (this.runningTasks.has(taskId)) {
      console.warn(`任务 ${taskId} 正在执行中，跳过本次触发`);
      return;
    }

    const task = taskRepo.get(taskId);
    if (!task) {
      console.error(`任务未找到: ${taskId}`);
      return;
    }

    this.runningTasks.add(taskId);
    taskRepo.update(taskId, { status: 'running' });

    const now = new Date().toISOString();
    const executionLog = executionLogRepo.create({
      task_id: taskId,
      trigger_id: triggerId,
      trigger_data: triggerData || null,
      status: 'running',
      started_at: now,
    });

    const variables: Record<string, any> = {
      task: {
        name: task.name, description: task.description,
        last_run_at: task.last_run_at, total_runs: task.total_runs,
      },
      trigger: { type: triggerId ? 'trigger' : 'manual', data: triggerData || {} },
      execution: { started_at: executionLog.started_at, status: 'running' },
      steps: {},
    };

    // 更新变量快照（脱敏后存储）
    const db = getDatabase();
    db.run('UPDATE execution_logs SET variables_snapshot = ? WHERE id = ?',
      [JSON.stringify(sanitizeForLog(variables)), executionLog.id]);
    markDirty();

    const actions = actionRepo.listByTask(taskId);
    const enabledActions = actions.filter(a => a.enabled).sort((a, b) => a.sort_order - b.sort_order);

    console.log(`开始执行任务: ${task.name}, 动作数: ${enabledActions.length}`);

    let hasError = false;
    let successCount = 0;
    let failedCount = 0;

    // 任务级超时（从 schedule 配置中读取 timeout_sec）
    const taskTimeoutMs = ((task.schedule as any)?.timeout_sec || 0) * 1000;
    const taskStartTime = Date.now();

    try {
      for (let i = 0; i < enabledActions.length; i++) {
        const action = enabledActions[i];

        // 检查任务级超时
        if (taskTimeoutMs > 0 && (Date.now() - taskStartTime) >= taskTimeoutMs) {
          failedCount++;
          hasError = true;
          console.warn(`任务超时，终止于动作: ${action.name}`);
          break;
        }

        try {
          const actionTimeoutMs = (action.config?.timeout_sec || 300) * 1000;
          const retryConfig = action.config?.retry as RetryConfig | undefined;

          const result = await withRetry(async () => {
            const actionPromise = pluginManager.executeAction(
              action.type, action.config, variables, taskId, action.id,
              {
                get: async (key: string) => {
                  const { vaultRepo } = await import('../database');
                  return vaultRepo.get(key);
                },
                set: async (key: string, value: any) => {
                  const { vaultRepo } = await import('../database');
                  vaultRepo.set(key, value);
                },
              },
            );
            return withTimeout(actionPromise, actionTimeoutMs, `动作 ${action.name || action.type}`);
          }, retryConfig, console);

          if (result.status === 'success') {
            successCount++;
            if (action.config?.output_var && result.output) {
              variables.steps[action.config.output_var] = result.output;
            }
          } else {
            failedCount++;
            if (!action.continue_on_error) {
              hasError = true;
              console.warn(`动作执行失败，任务终止: ${action.name}`, result.error);
              break;
            }
          }
        } catch (err: any) {
          failedCount++;
          console.error(`动作执行异常: ${action.name}`, err.message);
          if (!action.continue_on_error) {
            hasError = true;
            break;
          }
        }
      }

      const finalStatus = hasError ? 'failed' : 'success';
      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(now).getTime();

      executionLogRepo.update(executionLog.id, {
        status: finalStatus,
        finished_at: finishedAt,
        duration_ms: durationMs,
        variables_snapshot: sanitizeForLog(variables),
        action_count: enabledActions.length,
        success_count: successCount,
        failed_count: failedCount,
        error_message: hasError ? '部分动作执行失败' : undefined,
      });

      taskRepo.updateStats(taskId, {
        total_runs: (task.total_runs || 0) + 1,
        last_run_at: finishedAt,
        last_run_status: finalStatus,
      });

      if (task.type === 'one_shot') {
        taskRepo.update(taskId, { status: finalStatus === 'success' ? 'completed' : 'failed' });
      } else {
        taskRepo.update(taskId, { status: 'idle' });
      }

      console.log(`任务执行完成: ${task.name} (${finalStatus}), 耗时: ${durationMs}ms`);
    } catch (err: any) {
      console.error(`任务执行异常: ${task.name}`, err.message);
      taskRepo.update(taskId, { status: 'failed' });
    } finally {
      this.runningTasks.delete(taskId);
    }
  }
}

export const executor = new Executor();