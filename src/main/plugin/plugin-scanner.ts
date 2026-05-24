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

        // 校验必要字段
        if (!manifest.id || !manifest.name || !manifest.type || !manifest.entry) {
          console.warn(`[PluginScanner] 跳过无效插件: ${entry.name}, 缺少必要字段`);
          continue;
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