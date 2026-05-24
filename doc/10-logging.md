# 十、日志系统设计

## 10.1 日志体系总览

日志系统分为三层：

- **执行日志（Execution Log）**：每次任务执行的完整记录，包含每个动作的输入、输出、耗时、错误
- **系统日志（System Log）**：应用运行状态，插件加载、调度事件、轮询状态、DB 操作、错误警告
- **存储层**：SQLite（结构化记录）+ 文件系统（详细日志文件）+ 内存环形缓冲区（实时推送）

## 10.2 数据模型

### 执行记录表 (execution_logs) — 已有，增强

```sql
CREATE TABLE execution_logs (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  trigger_id    TEXT,
  trigger_data  TEXT,              -- 触发数据快照 (JSON)
  status        TEXT NOT NULL,     -- 'running' | 'success' | 'failed'
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  duration_ms   INTEGER,
  error_message TEXT,
  variables_snapshot TEXT,         -- 初始变量快照 (JSON)
  action_count     INTEGER DEFAULT 0,
  success_count    INTEGER DEFAULT 0,
  failed_count     INTEGER DEFAULT 0
);
```

### 动作日志表 (action_logs) — 新增

```sql
CREATE TABLE action_logs (
  id            TEXT PRIMARY KEY,
  execution_id  TEXT NOT NULL REFERENCES execution_logs(id) ON DELETE CASCADE,
  task_id       TEXT NOT NULL,
  sort_order    INTEGER NOT NULL,
  action_id     TEXT,
  action_type   TEXT NOT NULL,     -- 插件 id
  action_name   TEXT,
  status        TEXT NOT NULL,     -- 'running' | 'success' | 'failed' | 'skipped'
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  duration_ms   INTEGER,
  input_config  TEXT,              -- 模板替换后的实际配置 (JSON)
  output_data   TEXT,              -- 动作输出 (JSON)
  error_message TEXT,
  error_stack   TEXT,
  log_content   TEXT,              -- 动作执行过程中的详细日志文本
  log_level     TEXT DEFAULT 'info',
  parent_action_id TEXT,           -- 父动作 ID（condition 嵌套）
  branch        TEXT               -- 'if_true' | 'if_false'
);
```

### 系统日志表 (system_logs) — 新增

```sql
CREATE TABLE system_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp     TEXT NOT NULL,
  level         TEXT NOT NULL,     -- 'debug' | 'info' | 'warn' | 'error'
  module        TEXT NOT NULL,     -- 'scheduler' | 'trigger' | 'plugin' | 'db' | 'ipc' | 'app'
  message       TEXT NOT NULL,
  details       TEXT,              -- (JSON)
  task_id       TEXT,
  execution_id  TEXT
);

CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_module ON system_logs(module);
```

## 10.3 日志记录流程

### 任务执行日志

```
任务触发执行
    │
    ▼
创建 execution_log (status=running)
    ├── 记录 trigger_data 快照
    ├── 记录 variables_snapshot
    └── 记录 started_at
    │
    ▼
遍历 actions → 每个动作创建 action_log
    ├── 记录 input_config（模板替换后）
    ├── 执行动作，动作内部通过 logger 追加到 log_content
    ├── 成功 → status=success, output_data
    ├── 失败 → status=failed, error_message, error_stack
    ├── condition 分支 → 记录 parent_action_id + branch
    └── 记录 finished_at, duration_ms
    │
    ▼
更新 execution_log
    ├── status, finished_at, duration_ms
    ├── action_count, success_count, failed_count
    └── error_message
```

### 系统日志

```
应用启动   → system_log (module=app, level=info)
插件加载   → system_log (module=plugin, level=info)
插件失败   → system_log (module=plugin, level=error)
调度器事件 → system_log (module=scheduler, level=info)
轮询器状态 → system_log (module=trigger, level=debug)
DB 错误   → system_log (module=db, level=error)
```

### 日志级别

| 级别 | 用途 | 存储 |
|---|---|---|
| debug | 插件内部调试、轮询每次检查 | 按配置开关 |
| info | 正常流程 | 始终存储 |
| warn | 可恢复异常（重试、超时） | 始终存储 |
| error | 不可恢复错误 | 始终存储 |

## 10.4 日志存储与清理

### SQLite 保留策略

- execution_logs：保留最近 30 天 或 10000 条
- action_logs：随 execution_log 级联删除
- system_logs：保留最近 7 天 或 50000 条

### 文件日志（可选）

```
logs/
├── executions/2026-05-20/
│   ├── exec_abc123.json
│   └── exec_def456.json
├── system/system-2026-05-20.log
└── plugins/welink-poller.log
```

文件格式为 JSON Lines，按天轮转。

### 清理策略

- 应用启动时执行一次
- 之后每 24 小时执行一次
- 清理前记录 system_log

## 10.5 UI 日志查看

### 执行历史页面

顶部状态筛选 Tab（全部/成功/失败/运行中），列表展示每次执行记录：任务名、时间、状态、耗时、触发来源、动作摘要。点击 [详情] 打开执行详情弹窗。

### 执行详情弹窗

分三个区域：

1. **基本信息**：任务名、状态、起止时间、触发方式、触发数据
2. **动作执行步骤**：每个动作一个卡片，显示配置、输出、错误、耗时。可展开查看详细日志时间线
3. **变量作用域**：可展开查看整个变量作用域的 JSON 快照

底部操作：[重试此任务] [导出日志] [删除此记录]

### 系统日志页面

筛选条件：级别、模块、时间范围、关键词搜索。列表展示每条系统日志的时间、级别、模块、消息。

## 10.6 项目目录结构更新

```
src/main/
├── log/
│   ├── logger.ts                  # 全局 Logger 工厂
│   ├── execution-logger.ts        # 执行日志记录器
│   ├── action-logger.ts           # 动作日志记录器
│   ├── system-logger.ts           # 系统日志记录器
│   ├── log-cleanup.ts             # 日志清理任务
│   └── file-log-writer.ts         # 文件日志写入器
```

## 10.7 插件 Logger 接口

插件开发时通过 Logger 输出日志，自动关联到当前执行上下文：

```typescript
interface PluginLogger {
  debug(message: string, data?: Record<string, any>): void;
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, error?: Error, data?: Record<string, any>): void;
}
```

插件无需关心日志写到哪里，Logger 自动：
- 追加到当前 action_log 的 log_content
- 写入 system_logs（warn/error 级别）
- 写入文件日志（如启用）
- 推送到 UI 实时显示