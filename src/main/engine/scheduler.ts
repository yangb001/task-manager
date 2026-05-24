import * as cron from 'node-cron';
import type { Task, OneShotSchedule, CronSchedule } from '../../shared/types';
// systemLog 暂用 console 替代
function log(level: string, module: string, message: string, details?: any) {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${module}] ${message}`, details || '');
}

interface ScheduledTask {
  taskId: string;
  type: 'cron' | 'one_shot';
  cronJob?: cron.ScheduledTask;
  timeout?: NodeJS.Timeout;
}

export class Scheduler {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private onTaskDue: ((taskId: string) => void) | null = null;

  /**
   * 设置任务到期回调
   */
  setOnTaskDue(callback: (taskId: string) => void): void {
    this.onTaskDue = callback;
  }

  /**
   * 注册一个任务到调度器
   */
  registerTask(task: Task): void {
    this.unregisterTask(task.id);

    if (task.status === 'paused' || task.status === 'completed') {
      return;
    }

    if (task.type === 'scheduled') {
      this.registerCronTask(task);
    } else if (task.type === 'one_shot') {
      this.registerOneShotTask(task);
    }
  }

  /**
   * 注册定时任务
   */
  private registerCronTask(task: Task): void {
    const schedule = task.schedule as CronSchedule;
    if (!schedule.cron) {
      log('warn', 'scheduler', `任务 ${task.name} 缺少 Cron 表达式`);
      return;
    }

    // 检查是否在有效期内
    if (schedule.start_at && new Date(schedule.start_at) > new Date()) {
      // 还没到开始时间，延迟注册
      const delayMs = new Date(schedule.start_at).getTime() - Date.now();
      const timeout = setTimeout(() => {
        this.registerCronTask(task);
      }, delayMs);
      this.scheduledTasks.set(task.id, { taskId: task.id, type: 'cron', timeout });
      return;
    }

    if (schedule.end_at && new Date(schedule.end_at) < new Date()) {
      log('info', 'scheduler', `任务 ${task.name} 已过结束时间，跳过调度`);
      return;
    }

    // 检查执行次数
    if (schedule.max_executions > 0 && task.total_runs >= schedule.max_executions) {
      log('info', 'scheduler', `任务 ${task.name} 已达最大执行次数 ${schedule.max_executions}`);
      return;
    }

    try {
      const cronJob = cron.schedule(schedule.cron, () => {
        // 检查结束时间
        if (schedule.end_at && new Date(schedule.end_at) < new Date()) {
          cronJob.stop();
          this.scheduledTasks.delete(task.id);
          log('info', 'scheduler', `任务 ${task.name} 已到期，停止调度`);
          return;
        }

        // 检查执行次数
        if (schedule.max_executions > 0) {
          // 需要在执行完成后更新 total_runs，这里由外部处理
        }

        this.onTaskDue?.(task.id);
      }, {
        scheduled: true,
        timezone: 'Asia/Shanghai',
      });

      this.scheduledTasks.set(task.id, { taskId: task.id, type: 'cron', cronJob });
      log('info', 'scheduler', `任务已调度: ${task.name} (${schedule.cron})`);
    } catch (err: any) {
      log('error', 'scheduler', `Cron 表达式无效: ${task.name} - ${schedule.cron}`, { error: err.message });
    }
  }

  /**
   * 注册单次任务
   */
  private registerOneShotTask(task: Task): void {
    const schedule = task.schedule as OneShotSchedule;

    if (schedule.mode === 'immediate') {
      // 立即执行
      log('info', 'scheduler', `单次任务立即执行: ${task.name}`);
      this.onTaskDue?.(task.id);
      return;
    }

    if (schedule.execute_at) {
      const executeTime = new Date(schedule.execute_at).getTime();
      const now = Date.now();
      const delayMs = executeTime - now;

      if (delayMs <= 0) {
        // 已到时间，立即执行
        log('info', 'scheduler', `单次任务已到执行时间: ${task.name}`);
        this.onTaskDue?.(task.id);
        return;
      }

      const timeout = setTimeout(() => {
        this.onTaskDue?.(task.id);
        this.scheduledTasks.delete(task.id);
      }, delayMs);

      this.scheduledTasks.set(task.id, { taskId: task.id, type: 'one_shot', timeout });
      log('info', 'scheduler', `单次任务已调度: ${task.name} 于 ${schedule.execute_at}`);
    }
  }

  /**
   * 取消注册一个任务
   */
  unregisterTask(taskId: string): void {
    const scheduled = this.scheduledTasks.get(taskId);
    if (scheduled) {
      if (scheduled.cronJob) {
        scheduled.cronJob.stop();
      }
      if (scheduled.timeout) {
        clearTimeout(scheduled.timeout);
      }
      this.scheduledTasks.delete(taskId);
    }
  }

  /**
   * 获取所有已调度的任务 ID
   */
  getScheduledTaskIds(): string[] {
    return Array.from(this.scheduledTasks.keys());
  }

  /**
   * 清空所有调度
   */
  clearAll(): void {
    for (const [, scheduled] of this.scheduledTasks) {
      if (scheduled.cronJob) scheduled.cronJob.stop();
      if (scheduled.timeout) clearTimeout(scheduled.timeout);
    }
    this.scheduledTasks.clear();
  }
}

export const scheduler = new Scheduler();