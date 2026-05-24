# 八、IPC 通信设计

渲染进程通过 `contextBridge` 暴露的 API 与主进程通信：

```typescript
// 渲染进程可调用的 API
interface TaskManagerAPI {
  // 任务 CRUD
  tasks: {
    list(filter?: TaskFilter): Promise<Task[]>
    get(id: string): Promise<Task | null>
    create(data: CreateTaskInput): Promise<Task>
    update(id: string, data: UpdateTaskInput): Promise<Task>
    delete(id: string): Promise<void>
  }

  // 任务控制
  control: {
    start(id: string): Promise<void>       // 立即执行
    pause(id: string): Promise<void>       // 暂停
    resume(id: string): Promise<void>      // 恢复
  }

  // 执行历史
  history: {
    list(taskId: string, filter?: HistoryFilter): Promise<ExecutionLog[]>
    get(id: string): Promise<ExecutionLog | null>
    getActionLogs(executionId: string): Promise<ActionLog[]>
  }

  // 系统日志
  systemLogs: {
    list(filter?: SystemLogFilter): Promise<SystemLog[]>
  }

  // 状态订阅（主进程推送）
  onTaskStatusChange(callback: (taskId: string, status: TaskStatus) => void): () => void
  onExecutionUpdate(callback: (log: ExecutionLog) => void): () => void
  onSystemLog(callback: (log: SystemLog) => void): () => void

  // 配置管理
  config: {
    listWelinkAccounts(): Promise<WelinkAccount[]>
    saveWelinkAccount(account: WelinkAccountInput): Promise<void>
    deleteWelinkAccount(id: string): Promise<void>
    listEmailAccounts(): Promise<EmailAccount[]>
    saveEmailAccount(account: EmailAccountInput): Promise<void>
    deleteEmailAccount(id: string): Promise<void>
    listLlmProviders(): Promise<LlmProvider[]>
    saveLlmProvider(provider: LlmProviderInput): Promise<void>
    deleteLlmProvider(id: string): Promise<void>
  }

  // 插件管理
  plugins: {
    listTriggers(): Promise<PluginInfo[]>        // 获取所有触发器插件
    listActions(): Promise<PluginInfo[]>         // 获取所有动作插件
    getSchema(pluginId: string): Promise<JSONSchema | null>  // 获取插件配置 Schema
    scanUser(): Promise<void>                    // 重新扫描用户插件目录
    listAll(): Promise<PluginWithStats[]>        // 获取所有插件（含使用统计）
    uninstall(pluginId: string): Promise<void>   // 卸载用户插件
  }

  // 通用设置
  settings: {
    get(key: string): Promise<any>               // 读取设置
    set(key: string, value: any): Promise<void>  // 写入设置
  }

  // 日志导出
  export: {
    executionLog(id: string): Promise<string>   // 返回文件路径
  }
}
```

# 十、模板变量系统

所有动作配置中的字符串支持模板变量替换。变量来源：

| 变量 | 来源 | 说明 |
|---|---|---|
| `{{task.name}}` | 任务元信息 | 任务名称 |
| `{{task.description}}` | 任务元信息 | 任务描述 |
| `{{task.last_run_at}}` | 任务元信息 | 上次执行时间 |
| `{{task.total_runs}}` | 任务元信息 | 总执行次数 |
| `{{trigger.type}}` | 触发器 | 触发类型 |
| `{{trigger.data}}` | 触发器 | 触发原始数据（JSON） |
| `{{trigger.data.text}}` | 触发器 | Welink 消息文本 |
| `{{trigger.data.sender}}` | 触发器 | 触发来源（发件人/文件名） |
| `{{trigger.data.file_path}}` | 触发器 | 触发的文件路径 |
| `{{trigger.data.email_subject}}` | 触发器 | 邮件主题 |
| `{{trigger.data.email_body}}` | 触发器 | 邮件正文 |
| `{{execution.started_at}}` | 执行上下文 | 本次执行开始时间 |
| `{{execution.status}}` | 执行上下文 | 本次执行状态 |
| `{{steps.<output_var>}}` | 前置动作输出 | 引用前序动作的输出 |
| `{{steps.<output_var>.path.to.field}}` | 前置动作输出 | 链式访问 JSON 字段 |
| `{{vault:<key>}}` | 加密存储 | 引用 vault 中的敏感信息 |
| `{{env:<VAR_NAME>}}` | 环境变量 | 系统环境变量 |

# 十一、关键设计决策总结

| 决策 | 选择 | 理由 |
|---|---|---|
| 数据存储 | SQLite (sql.js WASM) | 零配置，单人够用，WASM 版本跨平台兼容 |
| 密码存储 | Electron safeStorage | 系统级 AES-256-GCM 加密 |
| 任务调度 | node-cron + 自建时间轮 | Cron 覆盖定时任务，时间轮覆盖单次精确调度 |
| 轮询实现 | setInterval + 游标记录 | 简单可靠，支持断点续查 |
| 进程模型 | 主进程干活，渲染进程纯 UI | 关窗口不关引擎，托盘常驻 |
| IPC 模式 | contextBridge + invoke/on | Electron 官方推荐的安全模式 |
| UI 框架 | React + 内联样式 | 轻量，无外部 UI 依赖，自定义主题系统 |
| 构建打包 | electron-builder | 支持 NSIS/dmg/AppImage 多平台 |
| 模板引擎 | 模板变量 + 链式访问 | 支持 `{{steps.xxx.yyy}}` 引用前序动作输出 |
| 触发器关系 | OR / AND 可配置 | 满足复杂场景，AND 模式用状态位追踪 |
| 动作变量传递 | output_var 机制 | 动作间通过变量作用域共享数据，支持流程串接 |
| 条件分支 | condition 动作 | 内置 if/else，分支内可嵌套任意动作 |
| 大模型调用 | 多 provider 抽象 | 支持 OpenAI/DeepSeek/GLM/自定义，API Key 加密存储 |
| 触发器和动作 | 插件化架构 | 内置 + 用户自定义，manifest.json 声明式配置 |
| 配置表单 | JSON Schema 驱动 | SchemaForm 组件根据 config_schema 自动生成表单，无需手写 |
| 日志体系 | 三层（执行/动作/系统） | 结构化 SQLite + 文件 JSON Lines，自动清理 |
| 敏感信息 | vault 表 + safeStorage | 所有密码/Token 加密存储，运行时通过 `{{vault:key}}` 引用 |
| 插件安全 | 静态扫描 + 权限声明 | 用户插件加载前检查危险代码模式，manifest 声明所需权限 |
| 数据库写入 | 脏标记 + 定时刷盘 | markDirty() + 5 秒 flushToDisk()，避免频繁 IO |
| IPC 错误处理 | wrapHandler 统一包装 | 所有 IPC handler 自动 try-catch，返回 `{success, data/error}` |
| 渲染进程优化 | 乐观更新 + 虚拟滚动 | taskStore 乐观更新回滚机制，VirtualList 处理大量日志 |

# 十二、后续可能的扩展

- **任务导入/导出**：JSON/YAML 格式，方便分享任务配置
- **定时任务日历视图**：甘特图/日历展示
- **插件市场**：远程仓库一键安装
- **插件安全沙箱**：worker_threads 隔离自定义插件
- **Webhook 触发器支持签名验证**：HMAC-SHA256 等
- **多语言支持**：i18n