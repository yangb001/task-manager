import { taskRepo, triggerRepo, actionRepo } from '../database';
import { pluginManager } from '../plugin';
import { scheduler } from './scheduler';
import { executor } from './executor';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../shared/types';

export class TaskManager {
  /**
   * 初始化：加载所有任务到调度器
   */
  async initialize(): Promise<void> {
    // 设置调度器回调
    scheduler.setOnTaskDue(async (taskId) => {
      await executor.executeTask(taskId);
    });

    // 加载所有未暂停/未完成的任务
    const tasks = taskRepo.list();
    for (const task of tasks) {
      if (task.status === 'idle' || task.status === 'running') {
        scheduler.registerTask(task);
      }
    }

    console.log('info', 'scheduler', `任务管理器初始化完成，已调度 ${scheduler.getScheduledTaskIds().length} 个任务`);
  }

  /**
   * 创建任务
   */
  async createTask(input: CreateTaskInput, triggers?: any[], actions?: any[]): Promise<Task> {
    const task = taskRepo.create(input);

    // 创建触发器
    if (triggers) {
      for (const t of triggers) {
        triggerRepo.create({ task_id: task.id, ...t });
      }
    }

    // 创建动作
    if (actions) {
      for (const a of actions) {
        actionRepo.create({ task_id: task.id, ...a });
      }
    }

    // 注册调度
    scheduler.registerTask(task);

    // 启动触发器
    await this.startTriggers(task.id);

    console.log('info', 'scheduler', `任务已创建: ${task.name}`);
    return task;
  }

  /**
   * 更新任务
   */
  async updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const task = taskRepo.update(id, input);
    if (!task) return null;

    // 重新注册调度
    scheduler.unregisterTask(id);
    scheduler.registerTask(task);

    // 如果暂停了，停止触发器
    if (input.status === 'paused') {
      await pluginManager.stopAllTriggersForTask(id);
    } else if (input.status === 'idle' || input.status === 'running') {
      await this.startTriggers(id);
    }

    return task;
  }

  /**
   * 删除任务
   */
  async deleteTask(id: string): Promise<void> {
    scheduler.unregisterTask(id);
    await pluginManager.stopAllTriggersForTask(id);
    taskRepo.delete(id);
    console.log('info', 'scheduler', `任务已删除: ${id}`);
  }

  /**
   * 立即执行任务
   */
  async executeTask(id: string): Promise<void> {
    const task = taskRepo.get(id);
    if (!task) return;

    await executor.executeTask(id, undefined, { triggered_by: 'manual', triggered_at: new Date().toISOString() });
  }

  /**
   * 暂停任务
   */
  async pauseTask(id: string): Promise<void> {
    scheduler.unregisterTask(id);
    await pluginManager.stopAllTriggersForTask(id);
    taskRepo.update(id, { status: 'paused' });
    console.log('info', 'scheduler', `任务已暂停: ${id}`);
  }

  /**
   * 恢复任务
   */
  async resumeTask(id: string): Promise<void> {
    const task = taskRepo.get(id);
    if (!task) return;

    taskRepo.update(id, { status: 'idle' });
    scheduler.registerTask(task);
    await this.startTriggers(id);
    console.log('info', 'scheduler', `任务已恢复: ${id}`);
  }

  /**
   * 启动任务的所有触发器
   */
  private async startTriggers(taskId: string): Promise<void> {
    const triggers = triggerRepo.listByTask(taskId);
    for (const trigger of triggers) {
      if (!trigger.enabled) continue;

      try {
        await pluginManager.startTrigger(
          trigger.type,
          trigger.config,
          taskId,
          trigger.id,
          async (data) => {
            // 触发器触发时执行任务
            await executor.executeTask(taskId, trigger.id, data.data);
          },
        );
      } catch (err: any) {
        console.log('error', 'trigger', `启动触发器失败: ${trigger.type}`, {
          taskId, error: err.message,
        });
      }
    }
  }

  /**
   * 销毁
   */
  async destroy(): Promise<void> {
    scheduler.clearAll();
    await pluginManager.destroy();
  }
}

export const taskManager = new TaskManager();