import * as http from 'http';
import * as url from 'url';
import type { TriggerPlugin, PluginContext, TriggerContext, TriggerData } from '../../plugin/plugin-types';

interface WebhookConfig {
  port: number;
  path: string;
  method: string;
  secret?: string;
}

class WebhookTrigger implements TriggerPlugin {
  manifest: any;
  private server: http.Server | null = null;
  private config: WebhookConfig | null = null;
  private context: TriggerContext | null = null;
  private logger: any = null;

  async initialize(_context: PluginContext): Promise<void> {
    // 无需额外初始化
  }

  async start(config: Record<string, any>, ctx: TriggerContext): Promise<void> {
    this.config = {
      port: config.port || 0,
      path: config.path || '/webhook',
      method: (config.method || 'POST').toUpperCase(),
      secret: config.secret,
    };
    this.context = ctx;
    this.logger = ctx.logger;

    await this.startServer();
  }

  private startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const config = this.config!;
      this.server = http.createServer((req, res) => {
        // 只处理配置的路径和方法
        const parsedUrl = url.parse(req.url || '', true);
        if (parsedUrl.pathname !== config.path) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        if (req.method !== config.method) {
          res.writeHead(405);
          res.end('Method Not Allowed');
          return;
        }

        // 验证签名（可选）
        if (config.secret) {
          const signature = req.headers['x-webhook-signature'] || req.headers['authorization'];
          if (!signature || signature !== config.secret) {
            res.writeHead(401);
            res.end('Unauthorized');
            return;
          }
        }

        // 读取请求体
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          let parsedBody: any = {};
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = { raw: body };
          }

          // 触发任务
          const data: TriggerData = {
            data: {
              method: req.method,
              path: parsedUrl.pathname,
              headers: req.headers,
              body: parsedBody,
              query: parsedUrl.query,
            },
            timestamp: new Date().toISOString(),
          };

          this.context?.onTrigger(data);

          // 返回成功
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', timestamp: data.timestamp }));
        });
      });

      this.server.listen(config.port, () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.logger.info(`Webhook 服务已启动: http://localhost:${addr.port}${config.path}`);
        }
        resolve();
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.config = null;
    this.context = null;
  }
}

export default new WebhookTrigger();