import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

contextBridge.exposeInMainWorld('taskManager', {
  // 任务 CRUD
  tasks: {
    list: (filter?: any) => ipcRenderer.invoke(IPC_CHANNELS.TASK_LIST, filter),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASK_GET, id),
    create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.TASK_CREATE, data),
    update: (id: string, data: any) => ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASK_DELETE, id),
  },

  // 任务控制
  control: {
    start: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASK_START, id),
    pause: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASK_PAUSE, id),
    resume: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASK_RESUME, id),
  },

  // 执行历史
  history: {
    list: (taskId?: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST, taskId),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET, id),
    actionLogs: (executionId: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_ACTION_LOGS, executionId),
  },

  // 系统日志
  systemLogs: {
    list: (filter?: any) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_LOG_LIST, filter),
  },

  // 配置管理
  config: {
    listWelinkAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_WELINK_LIST),
    saveWelinkAccount: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_WELINK_SAVE, data),
    deleteWelinkAccount: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_WELINK_DELETE, id),
    listEmailAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_EMAIL_LIST),
    saveEmailAccount: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_EMAIL_SAVE, data),
    deleteEmailAccount: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_EMAIL_DELETE, id),
    listLlmProviders: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LLM_LIST),
    saveLlmProvider: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LLM_SAVE, data),
    deleteLlmProvider: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LLM_DELETE, id),
  },

  // 插件管理
  plugins: {
    listTriggers: () => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_LIST_TRIGGERS),
    listActions: () => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_LIST_ACTIONS),
    getSchema: (pluginId: string) => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_GET_SCHEMA, pluginId),
    scanUser: () => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_SCAN_USER),
  },

  // 事件订阅
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