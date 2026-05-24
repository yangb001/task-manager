import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

async function invoke(channel: string, ...args: any[]): Promise<any> {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (result && typeof result === 'object' && 'success' in result) {
    if (result.success) return result.data;
    throw new Error(result.error);
  }
  return result;
}

contextBridge.exposeInMainWorld('taskManager', {
  // 任务 CRUD
  tasks: {
    list: (filter?: any) => invoke(IPC_CHANNELS.TASK_LIST, filter),
    get: (id: string) => invoke(IPC_CHANNELS.TASK_GET, id),
    create: (data: any) => invoke(IPC_CHANNELS.TASK_CREATE, data),
    update: (id: string, data: any) => invoke(IPC_CHANNELS.TASK_UPDATE, id, data),
    delete: (id: string) => invoke(IPC_CHANNELS.TASK_DELETE, id),
  },

  // 任务控制
  control: {
    start: (id: string) => invoke(IPC_CHANNELS.TASK_START, id),
    pause: (id: string) => invoke(IPC_CHANNELS.TASK_PAUSE, id),
    resume: (id: string) => invoke(IPC_CHANNELS.TASK_RESUME, id),
  },

  // 执行历史
  history: {
    list: (taskId?: string) => invoke(IPC_CHANNELS.HISTORY_LIST, taskId),
    get: (id: string) => invoke(IPC_CHANNELS.HISTORY_GET, id),
    actionLogs: (executionId: string) => invoke(IPC_CHANNELS.HISTORY_ACTION_LOGS, executionId),
  },

  // 系统日志
  systemLogs: {
    list: (filter?: any) => invoke(IPC_CHANNELS.SYSTEM_LOG_LIST, filter),
  },

  // 配置管理
  config: {
    listWelinkAccounts: () => invoke(IPC_CHANNELS.CONFIG_WELINK_LIST),
    saveWelinkAccount: (data: any) => invoke(IPC_CHANNELS.CONFIG_WELINK_SAVE, data),
    deleteWelinkAccount: (id: string) => invoke(IPC_CHANNELS.CONFIG_WELINK_DELETE, id),
    listEmailAccounts: () => invoke(IPC_CHANNELS.CONFIG_EMAIL_LIST),
    saveEmailAccount: (data: any) => invoke(IPC_CHANNELS.CONFIG_EMAIL_SAVE, data),
    deleteEmailAccount: (id: string) => invoke(IPC_CHANNELS.CONFIG_EMAIL_DELETE, id),
    listLlmProviders: () => invoke(IPC_CHANNELS.CONFIG_LLM_LIST),
    saveLlmProvider: (data: any) => invoke(IPC_CHANNELS.CONFIG_LLM_SAVE, data),
    deleteLlmProvider: (id: string) => invoke(IPC_CHANNELS.CONFIG_LLM_DELETE, id),
  },

  // 通用设置
  settings: {
    get: (key: string) => invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key: string, value: any) => invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  },

  // 插件管理
  plugins: {
    listTriggers: () => invoke(IPC_CHANNELS.PLUGIN_LIST_TRIGGERS),
    listActions: () => invoke(IPC_CHANNELS.PLUGIN_LIST_ACTIONS),
    getSchema: (pluginId: string) => invoke(IPC_CHANNELS.PLUGIN_GET_SCHEMA, pluginId),
    scanUser: () => invoke(IPC_CHANNELS.PLUGIN_SCAN_USER),
    listAll: () => invoke(IPC_CHANNELS.PLUGIN_LIST_ALL),
    uninstall: (pluginId: string) => invoke(IPC_CHANNELS.PLUGIN_UNINSTALL, pluginId),
  },

  // 事件订阅（推送事件不走 wrap，保持原样）
  onTaskStatusChange: (callback: (taskId: string, status: string) => void) => {
    const handler = (_event: any, taskId: string, status: string) => callback(taskId, status);
    ipcRenderer.on(IPC_CHANNELS.EVENT_TASK_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_TASK_STATUS, handler);
  },
  onExecutionUpdate: (callback: (log: any) => void) => {
    const handler = (_event: any, log: any) => callback(log);
    ipcRenderer.on(IPC_CHANNELS.EVENT_EXECUTION_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_EXECUTION_UPDATE, handler);
  },
  onSystemLog: (callback: (log: any) => void) => {
    const handler = (_event: any, log: any) => callback(log);
    ipcRenderer.on(IPC_CHANNELS.EVENT_SYSTEM_LOG, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SYSTEM_LOG, handler);
  },
});
