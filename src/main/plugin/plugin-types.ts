import type { PluginManifest } from '../../shared/types';

// ---- 插件上下文 ----

export interface PluginContext {
  /** 插件数据目录 */
  dataDir: string;
  /** 日志记录 */
  logger: PluginLogger;
}

export interface PluginLogger {
  debug(message: string, data?: Record<string, any>): void;
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, error?: Error, data?: Record<string, any>): void;
}

// ---- 触发器插件 ----

export interface TriggerData {
  data: Record<string, any>;
  timestamp: string;
}

export interface TriggerContext {
  taskId: string;
  triggerId: string;
  onTrigger(data: TriggerData): void;
  logger: PluginLogger;
}

export interface TriggerPlugin {
  manifest: PluginManifest;
  initialize(context: PluginContext): Promise<void>;
  start(config: Record<string, any>, context: TriggerContext): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
}

// ---- 动作插件 ----

export interface VariableScope {
  get(key: string): any;
  set(key: string, value: any): void;
  has(key: string): boolean;
  getAll(): Record<string, any>;
}

export interface ActionContext {
  taskId: string;
  actionId: string;
  variables: VariableScope;
  renderTemplate(template: string): string;
  logger: PluginLogger;
  vault: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
}

export interface ActionResult {
  status: 'success' | 'failed';
  output?: Record<string, any>;
  error?: string;
  logs?: string[];
}

export interface ActionPlugin {
  manifest: PluginManifest;
  initialize(context: PluginContext): Promise<void>;
  execute(config: Record<string, any>, context: ActionContext): Promise<ActionResult>;
  destroy(): Promise<void>;
}

// ---- 插件类型守卫 ----

export function isTriggerPlugin(plugin: any): plugin is TriggerPlugin {
  return plugin && typeof plugin.start === 'function' && typeof plugin.stop === 'function';
}

export function isActionPlugin(plugin: any): plugin is ActionPlugin {
  return plugin && typeof plugin.execute === 'function';
}