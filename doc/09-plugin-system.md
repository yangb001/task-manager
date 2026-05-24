# 九、插件系统设计

触发器和动作都设计为插件化架构，后续可以按规范新增自定义插件。

## 9.1 插件体系总览

```
┌─────────────────────────────────────────────────────────┐
│                    插件管理器                             │
│                  (Plugin Manager)                        │
│                                                         │
│  负责：注册、发现、生命周期管理、依赖注入                │
└──────────┬────────────────────────────────┬─────────────┘
           │                                │
           ▼                                ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│   触发器插件          │    │     动作插件                  │
│  (Trigger Plugin)   │    │   (Action Plugin)           │
│                     │    │                             │
│  • welink-message   │    │  • welink-message           │
│  • email-received   │    │  • send-email               │
│  • file-detected    │    │  • http-request             │
│  • webhook          │    │  • llm-call                 │
│  • manual           │    │  • run-python               │
│  • [自定义...]      │    │  • run-command              │
│                     │    │  • write-file               │
│                     │    │  • webhook-callback          │
│                     │    │  • transform                │
│                     │    │  • condition                │
│                     │    │  • [自定义...]               │
└─────────────────────┘    └─────────────────────────────┘
```

## 9.2 插件定义规范

### 插件包结构

```
plugins/
├── triggers/                        # 触发器插件
│   ├── welink-message/              # 内置插件
│   │   ├── index.ts
│   │   ├── manifest.json
│   │   └── README.md
│   ├── email-received/
│   ├── file-detected/
│   ├── webhook/
│   └── manual/
│
├── actions/                         # 动作插件
│   ├── welink-message/
│   ├── send-email/
│   ├── http-request/
│   ├── llm-call/
│   ├── run-python/
│   ├── run-command/
│   ├── write-file/
│   ├── webhook-callback/
│   ├── transform/
│   └── condition/
│
└── user-plugins/                    # 用户自定义插件目录
    ├── triggers/
    │   └── my-custom-trigger/
    └── actions/
        └── my-custom-action/
```

### manifest.json 规范

每个插件根目录下必须包含 `manifest.json`：

```json
{
  "id": "welink-message",
  "name": "WeLink 消息",
  "version": "1.0.0",
  "type": "trigger | action",
  "description": "监听 WeLink 群聊消息，支持关键词匹配",
  "author": "system",
  "entry": "index.ts",
  
  "config_schema": {
    "type": "object",
    "properties": {
      "chat_id": {
        "type": "string",
        "title": "群聊 ID",
        "description": "要监听的群聊 ID，不填则监听所有"
      },
      "keyword": {
        "type": "string",
        "title": "关键词",
        "description": "消息匹配关键词"
      },
      "match_mode": {
        "type": "string",
        "enum": ["contains", "regex", "exact"],
        "default": "contains",
        "title": "匹配模式"
      },
      "poll_interval_sec": {
        "type": "number",
        "minimum": 10,
        "default": 30,
        "title": "轮询间隔（秒）"
      }
    },
    "required": ["keyword"]
  },
  
  "output_schema": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "消息文本" },
      "sender": { "type": "string", "description": "发送人" },
      "chat_id": { "type": "string", "description": "群聊 ID" },
      "timestamp": { "type": "string", "description": "消息时间" }
    }
  },
  
  "icon": "🔔",
  "category": "communication"
}
```

- `config_schema`：JSON Schema 格式，UI 根据此自动生成配置表单
- `output_schema`：触发器/动作的输出数据结构，供变量引用时做校验和提示
- `entry`：插件入口文件

### 插件入口接口

#### 触发器插件接口

```typescript
interface TriggerPlugin {
  /** 插件元信息 */
  manifest: PluginManifest;
  
  /** 初始化（应用启动时调用） */
  initialize(context: PluginContext): Promise<void>;
  
  /** 启动轮询/监听（任务启用时调用） */
  start(config: Record<string, any>, context: TriggerContext): Promise<void>;
  
  /** 停止轮询/监听（任务暂停/删除时调用） */
  stop(): Promise<void>;
  
  /** 销毁（插件卸载时调用） */
  destroy(): Promise<void>;
}

interface TriggerContext {
  /** 任务 ID */
  taskId: string;
  /** 触发器 ID */
  triggerId: string;
  /** 触发回调：插件检测到条件满足时调用 */
  onTrigger(data: TriggerData): void;
  /** 日志记录 */
  logger: Logger;
}

interface TriggerData {
  /** 触发数据，会注入到变量作用域的 trigger.data */
  data: Record<string, any>;
  /** 触发时间 */
  timestamp: string;
}
```

#### 动作插件接口

```typescript
interface ActionPlugin {
  /** 插件元信息 */
  manifest: PluginManifest;
  
  /** 初始化 */
  initialize(context: PluginContext): Promise<void>;
  
  /** 执行动作 */
  execute(
    config: Record<string, any>,
    context: ActionContext
  ): Promise<ActionResult>;
  
  /** 销毁 */
  destroy(): Promise<void>;
}

interface ActionContext {
  /** 任务 ID */
  taskId: string;
  /** 动作 ID */
  actionId: string;
  /** 变量作用域（可读取所有前置输出） */
  variables: VariableScope;
  /** 模板变量替换函数 */
  renderTemplate(template: string): string;
  /** 日志记录 */
  logger: Logger;
  /** 访问 vault 加密存储 */
  vault: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
}

interface ActionResult {
  /** 执行状态 */
  status: 'success' | 'failed';
  /** 输出数据（会写入变量作用域，如果配置了 output_var） */
  output?: Record<string, any>;
  /** 错误信息 */
  error?: string;
  /** 执行日志 */
  logs?: string[];
}
```

## 9.3 插件管理器

```typescript
class PluginManager {
  /** 根据 ID 获取插件 */
  getTriggerPlugin(id: string): TriggerPlugin | undefined;
  getActionPlugin(id: string): ActionPlugin | undefined;

  /** 获取所有已注册的插件 */
  getAllTriggerPlugins(): TriggerPlugin[];
  getAllActionPlugins(): ActionPlugin[];

  /** 获取所有插件信息（含 source/manifest） */
  getAllTriggerPluginInfos(): PluginInfo[];
  getAllActionPluginInfos(): PluginInfo[];

  /** 启动/停止触发器实例 */
  startTrigger(pluginId, config, taskId, triggerId, onTrigger): Promise<void>;
  stopTrigger(taskId, triggerId): Promise<void>;
  stopAllTriggersForTask(taskId): Promise<void>;

  /** 执行动作 */
  executeAction(pluginId, config, variables, taskId, actionId, vault): Promise<ActionResult>;

  /** 获取插件配置的 JSON Schema（用于 UI 动态渲染表单） */
  getConfigSchema(pluginId: string): JSONSchema | undefined;

  /** 销毁所有插件（应用退出时） */
  destroy(): Promise<void>;
}
```

## 9.4 插件加载流程

```
应用启动
    │
    ▼
PluginManager.initialize()
    │
    ├── 1. 确保用户插件目录存在
    │      └── ensureUserPluginDirs()
    │
    ├── 2. 扫描内置触发器目录 triggers/
    │      ├── 读取 manifest.json → 校验格式
    │      └── import 入口文件 → 注册到 triggerPlugins Map
    │
    ├── 3. 扫描内置动作目录 actions/
    │      └── 同上流程 → 注册到 actionPlugins Map
    │
    ├── 4. 扫描用户自定义触发器目录 plugins/triggers/
    │      ├── 读取 manifest.json → 校验格式
    │      ├── 静态安全检查（checkCodeSafety）
    │      │   ├── 检测 child_process / cluster / worker_threads
    │      │   ├── 检测 eval / new Function / vm 模块
    │      │   └── 检测 process.exit/kill/abort
    │      ├── 安全检查通过 → import 入口 → 注册
    │      └── 安全检查失败 → 跳过并记录警告
    │
    ├── 5. 扫描用户自定义动作目录 plugins/actions/
    │      └── 同上流程
    │
    └── 6. 将插件列表暴露给渲染进程
           └── UI 根据插件列表动态渲染"添加触发器/动作"的下拉选项
```

## 9.4.1 插件卸载

卸载用户插件流程：

```
用户点击"卸载插件"
    │
    ▼
IPC 调用 plugin:uninstall
    │
    ├── 验证插件存在且 source === 'user'
    ├── 删除插件目录（fs.rmSync recursive）
    └── 重新调用 pluginManager.initialize() 刷新插件列表
```

> 内置插件不允许卸载。

## 9.4.2 插件使用统计

`plugin:listAll` IPC 通道返回所有插件及使用统计：

```typescript
interface PluginWithStats extends PluginInfo {
  usageCount: number;                    // 使用该插件的任务数
  usedByTasks: { id: string; name: string }[];  // 关联任务列表
}
```

统计方式：遍历所有任务的 triggers 和 actions，匹配 `type === plugin.manifest.id`。

## 9.5 插件开发指南（供用户参考）

### 创建一个自定义触发器插件

```
plugins/user-plugins/triggers/my-timer/
├── manifest.json
├── index.ts
└── README.md
```

**manifest.json：**

```json
{
  "id": "my-timer",
  "name": "自定义定时器",
  "version": "1.0.0",
  "type": "trigger",
  "description": "支持自定义时间格式的定时触发",
  "author": "zhangsan",
  "entry": "index.ts",
  "config_schema": {
    "type": "object",
    "properties": {
      "cron": {
        "type": "string",
        "title": "Cron 表达式",
        "description": "自定义触发时间"
      },
      "message": {
        "type": "string",
        "title": "触发消息",
        "description": "触发时携带的固定消息"
      }
    },
    "required": ["cron"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "message": { "type": "string" },
      "triggered_at": { "type": "string" }
    }
  },
  "icon": "⏰",
  "category": "timer"
}
```

**index.ts：**

```typescript
import { TriggerPlugin, TriggerContext, TriggerData } from '../../../types/plugin';

export default class MyTimerTrigger implements TriggerPlugin {
  manifest = {
    id: 'my-timer',
    name: '自定义定时器',
    version: '1.0.0',
    type: 'trigger' as const,
    // ...
  };

  private timer: NodeJS.Timeout | null = null;
  private context: TriggerContext | null = null;

  async initialize() {
    // 初始化资源
  }

  async start(config: Record<string, any>, context: TriggerContext) {
    this.context = context;
    const { cron, message } = config;
    
    // 注册 cron 定时器
    this.timer = scheduleCron(cron, () => {
      const data: TriggerData = {
        data: { message, triggered_at: new Date().toISOString() },
        timestamp: new Date().toISOString()
      };
      context.onTrigger(data);
    });
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async destroy() {
    await this.stop();
  }
}
```

### 创建一个自定义动作插件

```
plugins/user-plugins/actions/send-sms/
├── manifest.json
├── index.ts
└── README.md
```

**manifest.json：**

```json
{
  "id": "send-sms",
  "name": "发送短信",
  "version": "1.0.0",
  "type": "action",
  "description": "通过第三方 API 发送短信通知",
  "author": "zhangsan",
  "entry": "index.ts",
  "config_schema": {
    "type": "object",
    "properties": {
      "api_url": {
        "type": "string",
        "title": "短信 API 地址"
      },
      "phone": {
        "type": "string",
        "title": "手机号",
        "description": "支持模板变量"
      },
      "content_template": {
        "type": "string",
        "title": "短信内容模板",
        "format": "textarea"
      }
    },
    "required": ["api_url", "phone", "content_template"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "message_id": { "type": "string" },
      "status": { "type": "string" }
    }
  },
  "icon": "📱",
  "category": "notification"
}
```

## 9.6 UI 动态适配

### 任务表单中的插件选择

插件化后，UI 的"添加触发器/动作"下拉菜单不再硬编码，而是从 PluginManager 动态获取：

```
┌─ 触发器 (输入) ─────────────────────────────────────────┐
│  触发器关系: [● OR 任一触发  ○ AND 全部触发]              │
│                                                          │
│  [+ 添加触发器 ▼]                                        │
│    ├── 🔔 WeLink 消息轮询        (内置)                  │
│    ├── 📧 邮件接收              (内置)                  │
│    ├── 📁 文件检测              (内置)                  │
│    ├── 🌐 Webhook               (内置)                  │
│    ├── 👆 手动触发              (内置)                  │
│    ├── ────────────                                    │
│    ├── ⏰ 自定义定时器          (用户插件)              │
│    └── 🔄 刷新插件列表                                  │
│                                                          │
│  ① ⏰ 自定义定时器                                       │
│    Cron 表达式: [0 30 9 * * 1-5]                        │
│    触发消息: [工作日早上好！]                             │
│    [🔴 删除]                                             │
└─────────────────────────────────────────────────────────┘
```

### JSON Schema 驱动的动态表单

配置表单根据插件的 `config_schema`（JSON Schema）自动渲染，无需为每个插件手写表单组件。

核心组件：
- `<SchemaForm>`：通用 JSON Schema 表单渲染器，递归处理 object/string/number/boolean/enum 类型
- `<TriggerConfig>`：触发器配置包装器，展示插件信息 + SchemaForm
- `<ActionConfig>`：动作配置包装器，展示插件信息 + SchemaForm + 执行选项（output_var、continue_on_error）

### 独立插件管理页面

侧边栏新增"插件管理"入口，提供集中化的插件查看和管理能力。详见 7.6 节。

## 9.7 插件市场（未来扩展）

```
┌─────────────────────────────────────────────────┐
│  🔌 插件市场                                      │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  📱 发送短信        v1.2    作者:张三  [安装] │ │
│  │  通过第三方 API 发送短信通知                  │ │
│  ├─────────────────────────────────────────────┤ │
│  │  🐧 企业微信通知    v1.0    作者:李四  [安装] │ │
│  │  发送企业微信应用消息                          │ │
│  ├─────────────────────────────────────────────┤ │
│  │  📊 数据库查询      v2.1    作者:王五  [安装] │ │
│  │  执行 SQL 查询并将结果传给后续动作             │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- 插件市场从远程仓库拉取插件列表
- 一键安装到 `plugins/user-plugins/` 目录
- 支持版本管理和更新

## 9.8 项目目录结构更新

```
task-manager/
├── ...
├── src/
│   ├── main/
│   │   ├── ...
│   │   ├── plugin/                    # 插件系统
│   │   │   ├── plugin-manager.ts      # 插件管理器
│   │   │   ├── plugin-types.ts        # 插件类型定义
│   │   │   ├── plugin-scanner.ts      # 插件目录扫描器
│   │   │   └── schema-form-renderer.ts # JSON Schema → UI 表单
│   │   │
│   │   ├── triggers/                  # 内置触发器插件
│   │   │   ├── welink-poller/
│   │   │   ├── email-poller/
│   │   │   ├── file-poller/
│   │   │   ├── webhook-listener/
│   │   │   └── manual/
│   │   │
│   │   ├── actions/                   # 内置动作插件
│   │   │   ├── welink-message/
│   │   │   ├── send-email/
│   │   │   ├── http-request/
│   │   │   ├── llm-call/
│   │   │   ├── run-python/
│   │   │   ├── run-command/
│   │   │   ├── write-file/
│   │   │   ├── webhook-callback/
│   │   │   ├── transform/
│   │   │   └── condition/
│   │   │
│   │   └── ...
│   │
│   └── ...
│
├── plugins/                           # 用户自定义插件目录
│   ├── triggers/
│   └── actions/
│
└── ...
```

## 9.9 插件安全机制

### 静态安全检查（已实现）

用户插件在加载前进行静态代码扫描（`plugin-scanner.ts` 的 `checkCodeSafety` 方法），检测以下危险模式：

| 检测项 | 说明 |
|---|---|
| `require('child_process')` | 禁止使用子进程 |
| `require('cluster')` | 禁止使用 cluster |
| `require('worker_threads')` | 禁止使用 worker_threads |
| `process.exit/kill/abort` | 禁止调用进程控制 |
| `eval()` | 禁止使用 eval |
| `new Function()` | 禁止动态创建函数 |
| `require('vm')` | 禁止使用 vm 模块 |

安全检查仅对 `source === 'user'` 的插件执行，内置插件跳过。

### 权限声明

插件 manifest 中可声明所需权限（`permissions` 字段），UI 在插件管理页面展示权限标签：

```typescript
type PluginPermission = 'network' | 'filesystem' | 'process' | 'vault' | 'env';
```

### Worker 线程隔离（基础设施已就绪）

`plugin-worker.ts` 提供了基于 `worker_threads` 的隔离执行基础设施，后续可将用户插件执行迁移到 Worker 线程中，实现：
- 文件系统访问隔离
- 执行时间限制
- 内存使用限制

### 敏感数据脱敏（已实现）

执行日志存储前，通过 `sanitize.ts` 的 `sanitizeForLog` 函数自动脱敏以下字段：
- password / token / api_key / secret / authorization / api_key_var

递归处理嵌套对象，将敏感字段值替换为 `[REDACTED]`。