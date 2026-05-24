import type { ActionPlugin, PluginContext, ActionContext, ActionResult } from '../../plugin/plugin-types';

class WelinkMessageAction implements ActionPlugin {
  manifest: any;

  async initialize(_context: PluginContext): Promise<void> {
    // 后续接入真实的 Welink SDK
  }

  async execute(config: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const targetType = config.target_type || 'user';
    const targetId = context.renderTemplate(config.target_id || '');
    const messageType = config.message_type || 'text';
    const content = context.renderTemplate(config.content_template || '');

    context.logger.info(`发送 Welink ${messageType} 消息到 ${targetType}:${targetId}`);

    try {
      // TODO: 接入真实的 Welink API
      // 目前返回模拟结果
      const result = {
        message_id: `mock_${Date.now()}`,
        status: 'sent',
        target_type: targetType,
        target_id: targetId,
        content_preview: content.substring(0, 100),
      };

      context.logger.info(`Welink 消息发送成功: ${result.message_id}`);

      return {
        status: 'success',
        output: result,
        logs: [`消息已发送到 ${targetType}:${targetId}`],
      };
    } catch (err: any) {
      context.logger.error(`Welink 消息发送失败`, err);
      return {
        status: 'failed',
        error: err.message || '发送失败',
      };
    }
  }

  async destroy(): Promise<void> {
    // 清理资源
  }
}

export default new WelinkMessageAction();