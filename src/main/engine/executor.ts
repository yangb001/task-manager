import { v4 as uuidv4 } from 'uuid';
import type { Task, Action } from '../../shared/types';
import { taskRepo, triggerRepo, actionRepo, executionLogRepo, getDatabase, saveDatabase } from '../database';
import { pluginManager } from '../plugin';

export class Executor {
  async executeTask(taskId: string, triggerId?: string, triggerData?: Record<string, any>): Promise<void> {
    const task = taskRepo.get(taskId);
    if (!task) {
      console.error(`任务未找到: ${taskId}`);
      return;
    }

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

    // 更新变量快照
    const db = getDatabase();
    db.run('UPDATE execution_logs SET variables_snapshot = ? WHERE id = ?',
      [JSON.stringify(variables), executionLog.id]);
    saveDatabase();

    const actions = actionRepo.listByTask(taskId);
    const enabledActions = actions.filter(a => a.enabled).sort((a, b) => a.sort_order - b.sort_order);

    console.log(`开始执行任务: ${task.name}, 动作数: ${enabledActions.length}`);

    let hasError = false;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < enabledActions.length; i++) {
      const action = enabledActions[i];

      try {
        const result = await pluginManager.executeAction(
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
      variables_snapshot: variables,
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
  }
}

export const executor = new Executor();