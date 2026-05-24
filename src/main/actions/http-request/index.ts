import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import type { ActionPlugin, PluginContext, ActionContext, ActionResult } from '../../plugin/plugin-types';

class HttpRequestAction implements ActionPlugin {
  manifest: any;

  async initialize(_context: PluginContext): Promise<void> {
    // 无需初始化
  }

  async execute(config: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const method = (config.method || 'GET').toUpperCase();
    const requestUrl = context.renderTemplate(config.url || '');
    const timeoutSec = config.timeout_sec || 30;
    const retryConfig = config.retry || { max_retries: 0, delay_sec: 5 };

    // 渲染请求头
    const headers: Record<string, string> = {};
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        headers[key] = context.renderTemplate(String(value));
      }
    }

    // 渲染请求体
    let body: string | undefined;
    if (config.body_template && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      body = context.renderTemplate(config.body_template);
    }

    context.logger.info(`HTTP ${method} ${requestUrl}`);

    let lastError: Error | null = null;
    const maxRetries = retryConfig.max_retries || 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = (retryConfig.delay_sec || 5) * 1000;
        context.logger.info(`重试第 ${attempt} 次，等待 ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        const result = await this.makeRequest(requestUrl, method, headers, body, timeoutSec * 1000);
        context.logger.info(`HTTP 请求成功: ${result.status_code}`);

        return {
          status: 'success',
          output: result,
          logs: [`${method} ${requestUrl} → ${result.status_code}`],
        };
      } catch (err: any) {
        lastError = err;
        context.logger.warn(`HTTP 请求失败(第${attempt + 1}次): ${err.message}`);
      }
    }

    return {
      status: 'failed',
      error: lastError?.message || '请求失败',
      logs: [`${method} ${requestUrl} 失败: ${lastError?.message}`],
    };
  }

  private makeRequest(
    requestUrl: string, method: string,
    headers: Record<string, string>, body: string | undefined,
    timeoutMs: number,
  ): Promise<{ status_code: number; headers: Record<string, string>; body: any }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(requestUrl);
      const isHttps = parsedUrl.protocol === 'https:';

      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port ? parseInt(parsedUrl.port) : (isHttps ? 443 : 80),
        path: parsedUrl.path || '/',
        method,
        headers: {
          ...headers,
          ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {}),
        },
        timeout: timeoutMs,
      };

      const lib = isHttps ? https : http;
      const req = lib.request(options, (res) => {
        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          responseHeaders[key] = String(value || '');
        }

        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          let parsedBody: any = responseBody;
          try {
            parsedBody = JSON.parse(responseBody);
          } catch {
            // 保持原始字符串
          }

          resolve({
            status_code: res.statusCode || 0,
            headers: responseHeaders,
            body: parsedBody,
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  async destroy(): Promise<void> {
    // 无需清理
  }
}

export default new HttpRequestAction();