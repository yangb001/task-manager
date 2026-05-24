import * as fs from 'fs';
import * as path from 'path';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import { taskRepo, triggerRepo, actionRepo, executionLogRepo, vaultRepo } from './database';
import { taskManager } from './engine';
import { pluginManager, pluginScanner } from './plugin';

type IpcResult<T = any> = { success: true; data: T } | { success: false; error: string };

function wrapHandler(handler: (...args: any[]) => any) {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<IpcResult> => {
    try {
      const data = await handler(...args);
      return { success: true, data };
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC Error]', message);
      return { success: false, error: message };
    }
  };
}

export function registerIpcHandlers(): void {
  // ---- 任务 CRUD ----

  ipcMain.handle(IPC_CHANNELS.TASK_LIST, wrapHandler((filter) => {
    return taskRepo.list(filter);
  }));

  ipcMain.handle(IPC_CHANNELS.TASK_GET, wrapHandler((id) => {
    return taskRepo.get(id);
  }));

  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, wrapHandler(async (data) => {
    const { triggers, actions, ...taskData } = data;
    return taskManager.createTask(taskData, triggers, actions);
  }));

  ipcMain.handle(IPC_CHANNELS.TASK_UPDATE, wrapHandler(async (id, data) => {
    return taskManager.updateTask(id, data);
  }));

  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, wrapHandler(async (id) => {
    await taskManager.deleteTask(id);
  }));

  // ---- 任务控制 ----

  ipcMain.handle(IPC_CHANNELS.TASK_START, wrapHandler(async (id) => {
    await taskManager.executeTask(id);
  }));

  ipcMain.handle(IPC_CHANNELS.TASK_PAUSE, wrapHandler(async (id) => {
    await taskManager.pauseTask(id);
  }));

  ipcMain.handle(IPC_CHANNELS.TASK_RESUME, wrapHandler(async (id) => {
    await taskManager.resumeTask(id);
  }));

  // ---- 触发器 CRUD ----

  ipcMain.handle(IPC_CHANNELS.TRIGGER_LIST, wrapHandler((taskId) => {
    return triggerRepo.listByTask(taskId);
  }));

  ipcMain.handle(IPC_CHANNELS.TRIGGER_CREATE, wrapHandler((data) => {
    return triggerRepo.create(data);
  }));

  ipcMain.handle(IPC_CHANNELS.TRIGGER_DELETE, wrapHandler((id) => {
    triggerRepo.delete(id);
  }));

  // ---- 动作 CRUD ----

  ipcMain.handle(IPC_CHANNELS.ACTION_LIST, wrapHandler((taskId) => {
    return actionRepo.listByTask(taskId);
  }));

  ipcMain.handle(IPC_CHANNELS.ACTION_CREATE, wrapHandler((data) => {
    return actionRepo.create(data);
  }));

  ipcMain.handle(IPC_CHANNELS.ACTION_DELETE, wrapHandler((id) => {
    actionRepo.delete(id);
  }));

  // ---- 执行历史 ----

  ipcMain.handle(IPC_CHANNELS.HISTORY_LIST, wrapHandler((filter) => {
    return executionLogRepo.list(filter || {});
  }));

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET, wrapHandler((id) => {
    return executionLogRepo.get(id);
  }));

  // ---- 配置管理（Vault） ----

  ipcMain.handle(IPC_CHANNELS.CONFIG_WELINK_LIST, wrapHandler(() => {
    // TODO: 从 vault 中扫描 welink_ 前缀的 key 并返回账号列表
    return [];
  }));

  ipcMain.handle(IPC_CHANNELS.CONFIG_WELINK_SAVE, wrapHandler((data) => {
    vaultRepo.set(`welink_${data.name}`, data.token);
  }));

  ipcMain.handle(IPC_CHANNELS.CONFIG_WELINK_DELETE, wrapHandler((id) => {
    vaultRepo.delete(id);
  }));

  ipcMain.handle(IPC_CHANNELS.CONFIG_EMAIL_LIST, wrapHandler(() => {
    // TODO: 从 vault 中扫描 email_ 前缀的 key 并返回账号列表
    return [];
  }));

  ipcMain.handle(IPC_CHANNELS.CONFIG_EMAIL_SAVE, wrapHandler((data) => {
    vaultRepo.set(`email_${data.name}`, JSON.stringify(data));
  }));

  ipcMain.handle(IPC_CHANNELS.CONFIG_EMAIL_DELETE, wrapHandler((id) => {
    vaultRepo.delete(id);
  }));

  ipcMain.handle(IPC_CHANNELS.CONFIG_LLM_LIST, wrapHandler(() => {
    // TODO: 从 vault 中扫描 llm_ 前缀的 key 并返回 provider 列表
    return [];
  }));

  ipcMain.handle(IPC_CHANNELS.CONFIG_LLM_SAVE, wrapHandler((data) => {
    vaultRepo.set(`llm_${data.name}`, JSON.stringify(data));
  }));

  ipcMain.handle(IPC_CHANNELS.CONFIG_LLM_DELETE, wrapHandler((id) => {
    vaultRepo.delete(id);
  }));

  // ---- 通用设置（Vault KV） ----

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, wrapHandler((key: string) => {
    return vaultRepo.get(key);
  }));

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, wrapHandler((key: string, value: any) => {
    vaultRepo.set(key, value);
  }));

  // ---- 插件管理 ----

  ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST_TRIGGERS, wrapHandler(() => {
    return pluginManager.getAllTriggerPluginInfos();
  }));

  ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST_ACTIONS, wrapHandler(() => {
    return pluginManager.getAllActionPluginInfos();
  }));

  ipcMain.handle(IPC_CHANNELS.PLUGIN_GET_SCHEMA, wrapHandler((pluginId) => {
    return pluginManager.getConfigSchema(pluginId);
  }));

  ipcMain.handle(IPC_CHANNELS.PLUGIN_SCAN_USER, wrapHandler(async () => {
    await pluginManager.initialize();
  }));

  ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST_ALL, wrapHandler(() => {
    const triggerInfos = pluginManager.getAllTriggerPluginInfos();
    const actionInfos = pluginManager.getAllActionPluginInfos();
    const allInfos = [...triggerInfos, ...actionInfos];

    // 统计每个插件被多少任务使用
    const allTasks = taskRepo.list();
    return allInfos.map(info => {
      const usedByTasks: { id: string; name: string }[] = [];
      for (const task of allTasks) {
        const triggers = triggerRepo.listByTask(task.id);
        const actions = actionRepo.listByTask(task.id);
        const used = triggers.some(t => t.type === info.manifest.id)
                  || actions.some(a => a.type === info.manifest.id);
        if (used) {
          usedByTasks.push({ id: task.id, name: task.name });
        }
      }
      return { ...info, usageCount: usedByTasks.length, usedByTasks };
    });
  }));

  ipcMain.handle(IPC_CHANNELS.PLUGIN_UNINSTALL, wrapHandler((pluginId: string) => {
    // 只允许卸载用户插件
    const triggerInfos = pluginManager.getAllTriggerPluginInfos();
    const actionInfos = pluginManager.getAllActionPluginInfos();
    const info = [...triggerInfos, ...actionInfos].find(
      p => p.manifest.id === pluginId && p.source === 'user'
    );
    if (!info) {
      throw new Error('只能卸载用户自定义插件');
    }
    const dir = info.manifest.type === 'trigger'
      ? path.join(pluginScanner.getUserTriggerDir(), pluginId)
      : path.join(pluginScanner.getUserActionDir(), pluginId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    // 重新加载插件
    pluginManager.initialize();
  }));
}
