import * as path from 'path';
import { app } from 'electron';
import type { PluginInfo, PluginManifest } from '../../shared/types';
import type {
  TriggerPlugin,
  ActionPlugin,
  PluginContext,
  TriggerContext,
  ActionContext,
  VariableScope,
} from './plugin-types';
import { isTriggerPlugin, isActionPlugin } from './plugin-types';
import { pluginScanner } from './plugin-scanner';


class SimpleVariableScope implements VariableScope {
  private vars: Record<string, any> = {};

  constructor(initial: Record<string, any> = {}) {
    this.vars = { ...initial };
  }

  get(key: string): any {
    // 支持点号链式访问
    const parts = key.split('.');
    let current = this.vars;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }

  set(key: string, value: any): void {
    this.vars[key] = value;
  }

  has(key: string): boolean {
    return key in this.vars;
  }

  getAll(): Record<string, any> {
    return { ...this.vars };
  }
}

export class PluginManager {
  private triggerPlugins: Map<string, TriggerPlugin> = new Map();
  private actionPlugins: Map<string, ActionPlugin> = new Map();
  private pluginInfos: Map<string, PluginInfo> = new Map();

  private activeTriggerInstances: Map<string, { plugin: TriggerPlugin; taskId: string; triggerId: string }> = new Map();

  private context: PluginContext;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.context = {
      dataDir: path.join(userDataPath, 'plugin-data'),
      logger: {
        debug: (msg, data?) => console.log('debug', 'plugin', msg, data),
        info: (msg, data?) => console.log('info', 'plugin', msg, data),
        warn: (msg, data?) => console.log('warn', 'plugin', msg, data),
        error: (msg, err?, data?) => console.log('error', 'plugin', msg + (err ? ': ' + err.message : ''), { ...data, stack: err?.stack }),
      },
    };
  }

  /**
   * 初始化：扫描并加载所有插件
   */
  async initialize(): Promise<void> {
    pluginScanner.ensureUserPluginDirs();

    // 扫描内置触发器
    const builtinTriggers = pluginScanner.scanDirectory(
      pluginScanner.getBuiltinTriggerDir(), 'builtin'
    );
    for (const info of builtinTriggers) {
      await this.loadPlugin(info);
    }

    // 扫描内置动作
    const builtinActions = pluginScanner.scanDirectory(
      pluginScanner.getBuiltinActionDir(), 'builtin'
    );
    for (const info of builtinActions) {
      await this.loadPlugin(info);
    }

    // 扫描用户自定义插件
    const userTriggers = pluginScanner.scanDirectory(
      pluginScanner.getUserTriggerDir(), 'user'
    );
    for (const info of userTriggers) {
      await this.loadPlugin(info);
    }

    const userActions = pluginScanner.scanDirectory(
      pluginScanner.getUserActionDir(), 'user'
    );
    for (const info of userActions) {
      await this.loadPlugin(info);
    }

    this.context.logger.info(`插件加载完成: ${this.triggerPlugins.size} 个触发器, ${this.actionPlugins.size} 个动作`);
  }

  /**
   * 加载单个插件
   */
  private async loadPlugin(info: PluginInfo): Promise<void> {
    try {
      // 动态导入插件入口
      const pluginPath = this.resolvePluginPath(info);
      const pluginModule = await import(pluginPath);
      const plugin = pluginModule.default || pluginModule;

      if (!plugin) {
        this.context.logger.warn(`插件入口为空: ${info.manifest.id}`);
        return;
      }

      // 设置 manifest
      plugin.manifest = info.manifest;

      // 调用初始化
      if (typeof plugin.initialize === 'function') {
        await plugin.initialize(this.context);
      }

      // 注册
      if (isTriggerPlugin(plugin)) {
        this.triggerPlugins.set(info.manifest.id, plugin);
        this.pluginInfos.set(`trigger:${info.manifest.id}`, info);
        this.context.logger.info(`触发器插件已加载: ${info.manifest.name} (${info.manifest.id})`);
      } else if (isActionPlugin(plugin)) {
        this.actionPlugins.set(info.manifest.id, plugin);
        this.pluginInfos.set(`action:${info.manifest.id}`, info);
        this.context.logger.info(`动作插件已加载: ${info.manifest.name} (${info.manifest.id})`);
      } else {
        this.context.logger.warn(`未知插件类型: ${info.manifest.id}`);
      }
    } catch (err) {
      this.context.logger.error(`加载插件失败: ${info.manifest.id}`, err as Error);
    }
  }

  /**
   * 解析插件入口文件路径
   */
  private resolvePluginPath(info: PluginInfo): string {
    // 内置插件在编译后的 dist/main/triggers/ 或 dist/main/actions/ 中
    const baseDir = info.source === 'builtin'
      ? path.join(__dirname, '..')
      : pluginScanner.getUserPluginDir();

    const pluginDir = info.manifest.type === 'trigger' ? 'triggers' : 'actions';
    return path.join(baseDir, pluginDir, info.manifest.id, info.manifest.entry);
  }

  // ---- 触发器管理 ----

  getTriggerPlugin(id: string): TriggerPlugin | undefined {
    return this.triggerPlugins.get(id);
  }

  getAllTriggerPlugins(): TriggerPlugin[] {
    return Array.from(this.triggerPlugins.values());
  }

  getAllTriggerPluginInfos(): PluginInfo[] {
    return Array.from(this.pluginInfos.entries())
      .filter(([key]) => key.startsWith('trigger:'))
      .map(([, info]) => info);
  }

  /**
   * 启动一个触发器实例
   */
  async startTrigger(
    pluginId: string,
    config: Record<string, any>,
    taskId: string,
    triggerId: string,
    onTrigger: (data: any) => void,
  ): Promise<void> {
    const plugin = this.triggerPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`触发器插件未找到: ${pluginId}`);
    }

    const instanceKey = `${taskId}:${triggerId}`;
    if (this.activeTriggerInstances.has(instanceKey)) {
      await this.stopTrigger(taskId, triggerId);
    }

    const triggerContext: TriggerContext = {
      taskId,
      triggerId,
      onTrigger: (data) => {
        console.log('info', 'trigger', `触发器触发: ${pluginId}`, {
          taskId, triggerId, data,
        });
        onTrigger(data);
      },
      logger: this.context.logger,
    };

    await plugin.start(config, triggerContext);

    this.activeTriggerInstances.set(instanceKey, { plugin, taskId, triggerId });
  }

  /**
   * 停止一个触发器实例
   */
  async stopTrigger(taskId: string, triggerId: string): Promise<void> {
    const instanceKey = `${taskId}:${triggerId}`;
    const instance = this.activeTriggerInstances.get(instanceKey);
    if (instance) {
      await instance.plugin.stop();
      this.activeTriggerInstances.delete(instanceKey);
    }
  }

  /**
   * 停止某个任务的所有触发器
   */
  async stopAllTriggersForTask(taskId: string): Promise<void> {
    const toStop: string[] = [];
    for (const [key, instance] of this.activeTriggerInstances) {
      if (instance.taskId === taskId) {
        toStop.push(key);
      }
    }
    for (const key of toStop) {
      const instance = this.activeTriggerInstances.get(key);
      if (instance) {
        await instance.plugin.stop();
        this.activeTriggerInstances.delete(key);
      }
    }
  }

  // ---- 动作管理 ----

  getActionPlugin(id: string): ActionPlugin | undefined {
    return this.actionPlugins.get(id);
  }

  getAllActionPlugins(): ActionPlugin[] {
    return Array.from(this.actionPlugins.values());
  }

  getAllActionPluginInfos(): PluginInfo[] {
    return Array.from(this.pluginInfos.entries())
      .filter(([key]) => key.startsWith('action:'))
      .map(([, info]) => info);
  }

  /**
   * 执行一个动作
   */
  async executeAction(
    pluginId: string,
    config: Record<string, any>,
    variables: Record<string, any>,
    taskId: string,
    actionId: string,
    vault: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> },
  ): Promise<{ status: string; output?: Record<string, any>; error?: string; logs?: string[] }> {
    const plugin = this.actionPlugins.get(pluginId);
    if (!plugin) {
      return { status: 'failed', error: `动作插件未找到: ${pluginId}` };
    }

    const scope = new SimpleVariableScope(variables);

    const actionContext: ActionContext = {
      taskId,
      actionId,
      variables: scope,
      renderTemplate: (template: string) => this.renderTemplate(template, scope),
      logger: this.context.logger,
      vault,
    };

    try {
      const result = await plugin.execute(config, actionContext);
      return {
        status: result.status,
        output: result.output,
        error: result.error,
        logs: result.logs,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        error: err.message || String(err),
        logs: [err.stack || ''],
      };
    }
  }

  /**
   * 简单的模板变量替换
   */
  private renderTemplate(template: string, scope: SimpleVariableScope): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmed = key.trim();
      const value = scope.get(trimmed);
      if (value === undefined || value === null) {
        return match;
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
  }

  /**
   * 获取插件配置的 JSON Schema
   */
  getConfigSchema(pluginId: string): Record<string, any> | undefined {
    for (const [, info] of this.pluginInfos) {
      if (info.manifest.id === pluginId) {
        return info.manifest.config_schema;
      }
    }
    return undefined;
  }

  /**
   * 销毁所有插件
   */
  async destroy(): Promise<void> {
    for (const [, instance] of this.activeTriggerInstances) {
      await instance.plugin.stop();
    }
    this.activeTriggerInstances.clear();

    for (const [, plugin] of this.triggerPlugins) {
      await plugin.destroy();
    }
    for (const [, plugin] of this.actionPlugins) {
      await plugin.destroy();
    }

    this.triggerPlugins.clear();
    this.actionPlugins.clear();
    this.pluginInfos.clear();
  }
}

// 单例
export const pluginManager = new PluginManager();