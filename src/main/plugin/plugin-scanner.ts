import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { PluginManifest } from '../../shared/types';
import type { PluginInfo } from '../../shared/types';

export class PluginScanner {
  /**
   * 扫描目录下的所有插件，返回 manifest 列表
   */
  scanDirectory(dirPath: string, source: 'builtin' | 'user'): PluginInfo[] {
    const results: PluginInfo[] = [];

    if (!fs.existsSync(dirPath)) {
      return results;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(dirPath, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest: PluginManifest = JSON.parse(
          fs.readFileSync(manifestPath, 'utf-8')
        );

        if (!manifest.id || !manifest.name || !manifest.type || !manifest.entry) {
          console.warn(`[PluginScanner] 跳过无效插件: ${entry.name}, 缺少必要字段`);
          continue;
        }

        // 用户插件做静态安全检查
        if (source === 'user') {
          const entryPath = path.join(dirPath, entry.name, manifest.entry);
          if (fs.existsSync(entryPath)) {
            const code = fs.readFileSync(entryPath, 'utf-8');
            const violations = this.checkCodeSafety(code);
            if (violations.length > 0) {
              console.warn(`[PluginScanner] 插件 ${entry.name} 安全检查失败:`, violations);
              continue;
            }
          }
        }

        results.push({
          manifest,
          source,
          enabled: true,
        });
      } catch (err) {
        console.warn(`[PluginScanner] 读取插件 manifest 失败: ${entry.name}`, err);
      }
    }

    return results;
  }

  /**
   * 获取内置插件目录
   */
  getBuiltinTriggerDir(): string {
    // 内置插件在编译后的目录中
    return path.join(__dirname, '..', 'triggers');
  }

  getBuiltinActionDir(): string {
    return path.join(__dirname, '..', 'actions');
  }

  /**
   * 获取用户自定义插件目录
   */
  getUserPluginDir(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'plugins');
  }

  getUserTriggerDir(): string {
    return path.join(this.getUserPluginDir(), 'triggers');
  }

  getUserActionDir(): string {
    return path.join(this.getUserPluginDir(), 'actions');
  }

  /**
   * 静态安全检查：检测用户插件代码中的危险模式
   */
  private checkCodeSafety(code: string): string[] {
    const violations: string[] = [];
    const dangerousPatterns = [
      { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, msg: '禁止使用 child_process' },
      { pattern: /require\s*\(\s*['"]cluster['"]\s*\)/, msg: '禁止使用 cluster' },
      { pattern: /require\s*\(\s*['"]worker_threads['"]\s*\)/, msg: '禁止使用 worker_threads' },
      { pattern: /process\s*\.\s*(exit|kill|abort)/, msg: '禁止调用 process.exit/kill/abort' },
      { pattern: /eval\s*\(/, msg: '禁止使用 eval' },
      { pattern: /new\s+Function\s*\(/, msg: '禁止使用 new Function' },
      { pattern: /require\s*\(\s*['"]vm['"]\s*\)/, msg: '禁止使用 vm 模块' },
    ];
    for (const { pattern, msg } of dangerousPatterns) {
      if (pattern.test(code)) {
        violations.push(msg);
      }
    }
    return violations;
  }

  /**
   * 确保用户插件目录存在
   */
  ensureUserPluginDirs(): void {
    const dirs = [
      this.getUserTriggerDir(),
      this.getUserActionDir(),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
}

export const pluginScanner = new PluginScanner();