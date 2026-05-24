import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import { taskRepo, triggerRepo, actionRepo, executionLogRepo, vaultRepo } from './database';
import { taskManager } from './engine';
import { pluginManager } from './plugin';

export function registerIpcHandlers(): void {
  // ---- 任务 CRUD ----

  ipcMain.handle(IPC_CHANNELS.TASK_LIST, (_event, filter) => {
    return taskRepo.list(filter);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_GET, (_event, id) => {
    return taskRepo.get(id);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, async (_event, data) => {
    const { triggers, actions, ...taskData } = data;
    return taskManager.createTask(taskData, triggers, actions);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_UPDATE, async (_event, id, data) => {
    return taskManager.updateTask(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, async (_event, id) => {
    await taskManager.deleteTask(id);
  });

  // ---- 任务控制 ----

  ipcMain.handle(IPC_CHANNELS.TASK_START, async (_event, id) => {
    await taskManager.executeTask(id);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_PAUSE, async (_event, id) => {
    await taskManager.pauseTask(id);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_RESUME, async (_event, id) => {
    await taskManager.resumeTask(id);
  });

  // ---- 触发器 CRUD ----

  ipcMain.handle(IPC_CHANNELS.TRIGGER_LIST, (_event, taskId) => {
    return triggerRepo.listByTask(taskId);
  });

  ipcMain.handle(IPC_CHANNELS.TRIGGER_CREATE, (_event, data) => {
    return triggerRepo.create(data);
  });

  ipcMain.handle(IPC_CHANNELS.TRIGGER_DELETE, (_event, id) => {
    triggerRepo.delete(id);
  });

  // ---- 动作 CRUD ----

  ipcMain.handle(IPC_CHANNELS.ACTION_LIST, (_event, taskId) => {
    return actionRepo.listByTask(taskId);
  });

  ipcMain.handle(IPC_CHANNELS.ACTION_CREATE, (_event, data) => {
    return actionRepo.create(data);
  });

  ipcMain.handle(IPC_CHANNELS.ACTION_DELETE, (_event, id) => {
    actionRepo.delete(id);
  });

  // ---- 执行历史 ----

  ipcMain.handle(IPC_CHANNELS.HISTORY_LIST, (_event, filter) => {
    return executionLogRepo.list(filter || {});
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET, (_event, id) => {
    return executionLogRepo.get(id);
  });

  // ---- 配置管理（Vault） ----

  ipcMain.handle(IPC_CHANNELS.CONFIG_WELINK_LIST, () => {
    // 从 vault 读取 Welink 账号列表（简化版，实际需要 vault 支持 key 前缀扫描）
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_WELINK_SAVE, (_event, data) => {
    vaultRepo.set(`welink_${data.name}`, data.token);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_WELINK_DELETE, (_event, id) => {
    vaultRepo.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_EMAIL_LIST, () => {
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_EMAIL_SAVE, (_event, data) => {
    vaultRepo.set(`email_${data.name}`, JSON.stringify(data));
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_EMAIL_DELETE, (_event, id) => {
    vaultRepo.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_LLM_LIST, () => {
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_LLM_SAVE, (_event, data) => {
    vaultRepo.set(`llm_${data.name}`, JSON.stringify(data));
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_LLM_DELETE, (_event, id) => {
    vaultRepo.delete(id);
  });

  // ---- 插件管理 ----

  ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST_TRIGGERS, () => {
    return pluginManager.getAllTriggerPluginInfos();
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST_ACTIONS, () => {
    return pluginManager.getAllActionPluginInfos();
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_GET_SCHEMA, (_event, pluginId) => {
    return pluginManager.getConfigSchema(pluginId);
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_SCAN_USER, async () => {
    await pluginManager.initialize();
  });
}