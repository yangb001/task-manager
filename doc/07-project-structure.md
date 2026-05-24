# 八、项目目录结构

```
task-manager/
├── package.json
├── electron-builder.yml
├── tsconfig.json
│
├── src/
│   ├── main/                          # 主进程
│   │   ├── index.ts                   # 入口，创建窗口、托盘
│   │   ├── ipc-handlers.ts            # IPC 处理器注册
│   │   │
│   │   ├── database/                  # 数据层
│   │   │   ├── connection.ts          # SQLite 连接
│   │   │   ├── migrations/            # 数据库迁移
│   │   │   ├── repositories/
│   │   │   │   ├── task-repo.ts
│   │   │   │   ├── trigger-repo.ts
│   │   │   │   ├── action-repo.ts
│   │   │   │   ├── execution-log-repo.ts
│   │   │   │   ├── action-log-repo.ts
│   │   │   │   ├── system-log-repo.ts
│   │   │   │   └── vault-repo.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── engine/                    # 任务引擎
│   │   │   ├── scheduler.ts           # 调度器（Cron + 时间轮）
│   │   │   ├── executor.ts            # 执行器（执行 Actions）
│   │   │   ├── task-manager.ts        # 任务管理器（生命周期）
│   │   │   ├── variable-scope.ts      # 变量作用域管理
│   │   │   └── retry-handler.ts       # 重试处理
│   │   │
│   │   ├── plugin/                    # 插件系统
│   │   │   ├── plugin-manager.ts      # 插件管理器（注册、发现、生命周期）
│   │   │   ├── plugin-types.ts        # 插件类型定义（TriggerPlugin/ActionPlugin 接口）
│   │   │   ├── plugin-scanner.ts      # 插件目录扫描器（含静态安全检查）
│   │   │   └── plugin-worker.ts       # Worker 线程隔离执行（基础设施）
│   │   │
│   │   ├── triggers/                  # 内置触发器插件
│   │   │   ├── welink-poller/
│   │   │   │   ├── manifest.json
│   │   │   │   └── index.ts
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
│   │   ├── log/                       # 日志系统
│   │   │   ├── logger.ts              # 全局 Logger 工厂
│   │   │   ├── execution-logger.ts    # 执行日志记录器
│   │   │   ├── action-logger.ts       # 动作日志记录器
│   │   │   ├── system-logger.ts       # 系统日志记录器
│   │   │   ├── log-cleanup.ts         # 日志清理任务
│   │   │   └── file-log-writer.ts     # 文件日志写入器
│   │   │
│   │   ├── utils/                     # 工具函数
│   │   │   └── sanitize.ts            # 敏感数据脱敏（日志存储前）
│   │   │
│   │   ├── services/                  # 公共服务
│   │   │   ├── welink-client.ts       # Welink API 封装
│   │   │   ├── email-client.ts        # IMAP/SMTP 封装
│   │   │   ├── llm-client.ts          # 大模型 API 客户端
│   │   │   └── vault-service.ts       # 加密存储服务
│   │   │
│   │   └── tray.ts                    # 系统托盘
│   │
│   ├── renderer/                      # 渲染进程
│   │   ├── index.html
│   │   ├── main.tsx                   # React 入口
│   │   ├── App.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── TaskListPage.tsx       # 任务列表页
│   │   │   ├── TaskFormModal.tsx      # 新建/编辑任务弹窗（分步式）
│   │   │   ├── ExecutionHistoryPage.tsx # 执行历史页
│   │   │   ├── PluginManagePage.tsx   # 插件管理页（独立页面）
│   │   │   └── SettingsPage.tsx       # 设置页（账号/主题）
│   │   │
│   │   ├── components/
│   │   │   ├── SchemaForm.tsx         # JSON Schema 表单渲染器（核心组件）
│   │   │   ├── TriggerConfig.tsx      # 触发器配置组件（SchemaForm + 插件信息展示）
│   │   │   ├── ActionConfig.tsx       # 动作配置组件（SchemaForm + 执行选项）
│   │   │   ├── VirtualList.tsx        # 虚拟滚动列表（大数据量优化）
│   │   │   └── ...                    # 其他业务组件
│   │   │
│   │   ├── stores/
│   │   │   ├── taskStore.ts           # 任务状态（乐观更新）
│   │   │   ├── themeStore.ts          # 主题状态（暗色/亮色切换）
│   │   │   └── ...
│   │   │
│   │   ├── hooks/
│   │   │   ├── useTasks.ts
│   │   │   ├── useTaskForm.ts
│   │   │   ├── useHistory.ts
│   │   │   └── useSystemLog.ts
│   │   │
│   │   └── types/                     # 类型定义（与主进程共享）
│   │       └── index.ts
│   │
│   └── shared/                        # 主进程和渲染进程共享
│       ├── types.ts                   # 所有类型定义
│       └── ipc-channels.ts            # IPC 通道常量
│
├── plugins/                           # 用户自定义插件目录
│   ├── triggers/
│   └── actions/
│
├── logs/                              # 文件日志目录（运行时生成）
│
├── resources/
│   ├── icon.png                       # 应用图标
│   └── tray-icon.png                  # 托盘图标
│
└── test/
    ├── engine/
    ├── triggers/
    ├── actions/
    ├── plugin/
    └── log/
```