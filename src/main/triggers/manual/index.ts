import type { TriggerPlugin, PluginContext, TriggerContext, TriggerData } from '../../plugin/plugin-types';

class ManualTrigger implements TriggerPlugin {
  manifest: any;
  private context: TriggerContext | null = null;

  async initialize(_context: PluginContext): Promise<void> {
    // 手动触发无需初始化
  }

  async start(_config: Record<string, any>, context: TriggerContext): Promise<void> {
    this.context = context;
  }

  async stop(): Promise<void> {
    this.context = null;
  }

  async destroy(): Promise<void> {
    this.context = null;
  }

  /**
   * 供外部调用：触发执行
   */
  fire(source: string = 'user'): void {
    if (this.context) {
      const data: TriggerData = {
        data: {
          triggered_by: source,
          triggered_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
      this.context.onTrigger(data);
    }
  }
}

export default new ManualTrigger();