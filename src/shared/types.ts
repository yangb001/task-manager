// ============================================================
// 共享类型定义 — 主进程和渲染进程共用
// ============================================================

// ---- 任务 ----

export type TaskType = 'one_shot' | 'scheduled';
export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type TriggerLogic = 'or' | 'and';
export type LastRunStatus = 'success' | 'failed' | null;

export interface OneShotSchedule {
  mode: 'immediate' | 'scheduled';
  execute_at?: string; // ISO8601
}

export interface CronSchedule {
  cron: string;
  start_at?: string;   // ISO8601
  end_at?: string;     // ISO8601
  max_executions: number; // 0 = unlimited
}

export interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  schedule: OneShotSchedule | CronSchedule;
  trigger_logic: TriggerLogic;
  tags: string[];
  group_name: string;
  created_at: string;
  updated_at: string;
  total_runs: number;
  last_run_at: string | null;
  last_run_status: LastRunStatus;
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  type: TaskType;
  schedule: OneShotSchedule | CronSchedule;
  trigger_logic?: TriggerLogic;
  tags?: string[];
  group_name?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: TaskStatus;
}

export interface TaskFilter {
  status?: TaskStatus;
  type?: TaskType;
  search?: string;
  tags?: string[];
  group_name?: string;
}

// ---- 触发器 ----

export type TriggerType = string; // 插件 id

export interface Trigger {
  id: string;
  task_id: string;
  type: TriggerType;
  config: Record<string, any>;
  enabled: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateTriggerInput {
  type: TriggerType;
  config: Record<string, any>;
  enabled?: boolean;
  sort_order?: number;
}

// ---- 动作 ----

export type ActionType = string; // 插件 id

export interface Action {
  id: string;
  task_id: string;
  type: ActionType;
  name: string;
  config: Record<string, any>;
  enabled: boolean;
  continue_on_error: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateActionInput {
  type: ActionType;
  name?: string;
  config: Record<string, any>;
  enabled?: boolean;
  continue_on_error?: boolean;
  sort_order?: number;
}

// ---- 执行日志 ----

export type ExecutionStatus = 'running' | 'success' | 'failed';

export interface ExecutionLog {
  id: string;
  task_id: string;
  trigger_id: string | null;
  trigger_data: Record<string, any> | null;
  status: ExecutionStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  variables_snapshot: Record<string, any> | null;
  action_count: number;
  success_count: number;
  failed_count: number;
}

// ---- 动作日志 ----

export type ActionLogStatus = 'running' | 'success' | 'failed' | 'skipped';

export interface ActionLog {
  id: string;
  execution_id: string;
  task_id: string;
  sort_order: number;
  action_id: string | null;
  action_type: string;
  action_name: string;
  status: ActionLogStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  input_config: Record<string, any> | null;
  output_data: Record<string, any> | null;
  error_message: string | null;
  error_stack: string | null;
  log_content: string | null;
  log_level: string;
  parent_action_id: string | null;
  branch: string | null;
}

// ---- 系统日志 ----

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogModule = 'scheduler' | 'trigger' | 'plugin' | 'db' | 'ipc' | 'app';

export interface SystemLog {
  id: number;
  timestamp: string;
  level: LogLevel;
  module: LogModule;
  message: string;
  details: Record<string, any> | null;
  task_id: string | null;
  execution_id: string | null;
}

export interface SystemLogFilter {
  level?: LogLevel;
  module?: LogModule;
  start_time?: string;
  end_time?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---- 加密存储 ----

export interface VaultEntry {
  key: string;
  value: string; // 加密后的值
  created_at: string;
}

// ---- 插件 ----

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: 'trigger' | 'action';
  description: string;
  author: string;
  entry: string;
  config_schema: Record<string, any>; // JSON Schema
  output_schema?: Record<string, any>;
  icon?: string;
  category?: string;
  permissions?: PluginPermission[];
}

export type PluginPermission =
  | 'network'      // 允许网络请求
  | 'filesystem'   // 允许文件系统访问
  | 'process'      // 允许执行子进程
  | 'vault'        // 允许访问加密存储
  | 'env';         // 允许读取环境变量

export interface PluginInfo {
  manifest: PluginManifest;
  source: 'builtin' | 'user';
  enabled: boolean;
}

// ---- 账号配置 ----

export interface WelinkAccount {
  id: string;
  name: string;
  token: string; // 加密存储
  status: 'connected' | 'disconnected';
  created_at: string;
}

export interface EmailAccount {
  id: string;
  name: string;
  username: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  status: 'connected' | 'disconnected';
  created_at: string;
}

export interface LlmProvider {
  id: string;
  name: string;
  provider: 'openai' | 'deepseek' | 'glm' | 'custom';
  base_url: string;
  model: string;
  api_key: string; // 加密存储
  created_at: string;
}

// ---- IPC 通道 ----

export const IPC_CHANNELS = {
  TASK_LIST: 'task:list',
  TASK_GET: 'task:get',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_START: 'task:start',
  TASK_PAUSE: 'task:pause',
  TASK_RESUME: 'task:resume',

  TRIGGER_LIST: 'trigger:list',
  TRIGGER_CREATE: 'trigger:create',
  TRIGGER_UPDATE: 'trigger:update',
  TRIGGER_DELETE: 'trigger:delete',

  ACTION_LIST: 'action:list',
  ACTION_CREATE: 'action:create',
  ACTION_UPDATE: 'action:update',
  ACTION_DELETE: 'action:delete',

  HISTORY_LIST: 'history:list',
  HISTORY_GET: 'history:get',
  HISTORY_ACTION_LOGS: 'history:actionLogs',

  SYSTEM_LOG_LIST: 'systemLog:list',

  CONFIG_WELINK_LIST: 'config:welink:list',
  CONFIG_WELINK_SAVE: 'config:welink:save',
  CONFIG_WELINK_DELETE: 'config:welink:delete',
  CONFIG_EMAIL_LIST: 'config:email:list',
  CONFIG_EMAIL_SAVE: 'config:email:save',
  CONFIG_EMAIL_DELETE: 'config:email:delete',
  CONFIG_LLM_LIST: 'config:llm:list',
  CONFIG_LLM_SAVE: 'config:llm:save',
  CONFIG_LLM_DELETE: 'config:llm:delete',

  PLUGIN_LIST_TRIGGERS: 'plugin:listTriggers',
  PLUGIN_LIST_ACTIONS: 'plugin:listActions',
  PLUGIN_GET_SCHEMA: 'plugin:getSchema',
  PLUGIN_SCAN_USER: 'plugin:scanUser',
  PLUGIN_LIST_ALL: 'plugin:listAll',
  PLUGIN_UNINSTALL: 'plugin:uninstall',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // 主进程推送事件
  EVENT_TASK_STATUS: 'event:taskStatus',
  EVENT_EXECUTION_UPDATE: 'event:executionUpdate',
  EVENT_SYSTEM_LOG: 'event:systemLog',
} as const;