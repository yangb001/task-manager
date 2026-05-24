# 三、数据模型

## 3.1 任务表 (tasks)

```sql
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,          -- UUID
  name          TEXT NOT NULL,             -- 任务名称
  description   TEXT DEFAULT '',           -- 描述
  type          TEXT NOT NULL,             -- 'one_shot' | 'scheduled'
  status        TEXT NOT NULL DEFAULT 'idle',
  -- idle | running | paused | completed | failed

  -- 调度配置 (JSON)
  schedule      TEXT NOT NULL DEFAULT '{}',
  -- one_shot: { "mode": "immediate" | "scheduled", "execute_at": "ISO8601" }
  -- scheduled: { "cron": "0 9 * * *", "start_at": "ISO8601", "end_at": "ISO8601", "max_executions": 0 }

  -- 触发器关系: 'or' | 'and'
  trigger_logic TEXT NOT NULL DEFAULT 'or',

  -- 标签/分组
  tags          TEXT DEFAULT '[]',          -- JSON array, e.g. ["运维", "日报"]
  group_name    TEXT DEFAULT '',            -- 分组名称

  created_at    TEXT NOT NULL,             -- ISO8601
  updated_at    TEXT NOT NULL,

  -- 统计
  total_runs    INTEGER DEFAULT 0,
  last_run_at   TEXT,
  last_run_status TEXT                     -- 'success' | 'failed'
);
```

## 3.2 触发器表 (triggers)

```sql
CREATE TABLE triggers (
  id            TEXT PRIMARY KEY,          -- UUID
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  -- 插件 id，如 'welink_message' | 'email_received' | 'file_detected' | 'webhook' | 'manual'

  config        TEXT NOT NULL DEFAULT '{}', -- JSON 配置
  enabled       INTEGER NOT NULL DEFAULT 1,

  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
```

## 3.3 动作表 (actions)

```sql
CREATE TABLE actions (
  id            TEXT PRIMARY KEY,          -- UUID
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  -- 插件 id，如 'welink_message' | 'send_email' | 'http_request' | 'llm_call'
  -- | 'run_python' | 'run_command' | 'write_file' | 'webhook_callback'
  -- | 'transform' | 'condition'

  name          TEXT DEFAULT '',            -- 动作名称（用户自定义）
  config        TEXT NOT NULL DEFAULT '{}', -- JSON 配置
  enabled       INTEGER NOT NULL DEFAULT 1,
  continue_on_error INTEGER NOT NULL DEFAULT 0, -- 失败时是否继续

  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
```

## 3.4 执行记录表 (execution_logs)

```sql
CREATE TABLE execution_logs (
  id            TEXT PRIMARY KEY,          -- UUID
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  trigger_id    TEXT,                      -- 哪个触发器触发的
  trigger_data  TEXT,                      -- 触发时的原始数据快照 (JSON)

  status        TEXT NOT NULL,             -- 'running' | 'success' | 'failed'
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  duration_ms   INTEGER,                   -- 执行耗时（毫秒）
  error_message TEXT,

  -- 变量作用域快照（执行开始时的初始变量）
  variables_snapshot TEXT,                 -- JSON

  -- 汇总
  action_count     INTEGER DEFAULT 0,
  success_count    INTEGER DEFAULT 0,
  failed_count     INTEGER DEFAULT 0
);
```

## 3.5 动作日志表 (action_logs)

```sql
CREATE TABLE action_logs (
  id            TEXT PRIMARY KEY,          -- UUID
  execution_id  TEXT NOT NULL REFERENCES execution_logs(id) ON DELETE CASCADE,
  task_id       TEXT NOT NULL,

  sort_order    INTEGER NOT NULL,          -- 动作执行顺序
  action_id     TEXT,                      -- 动作配置 ID
  action_type   TEXT NOT NULL,             -- 动作类型（插件 id）
  action_name   TEXT,                      -- 动作名称

  status        TEXT NOT NULL,             -- 'running' | 'success' | 'failed' | 'skipped'
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  duration_ms   INTEGER,

  -- 输入输出
  input_config  TEXT,                      -- 模板变量替换后的实际配置 (JSON)
  output_data   TEXT,                      -- 动作输出数据 (JSON)
  error_message TEXT,
  error_stack   TEXT,                      -- 错误堆栈（如有）

  -- 日志内容
  log_content   TEXT,                      -- 动作执行过程中的详细日志文本
  log_level     TEXT DEFAULT 'info',       -- 'debug' | 'info' | 'warn' | 'error'

  -- 条件分支相关
  parent_action_id TEXT,                   -- 父动作 ID（用于 condition 嵌套）
  branch        TEXT                       -- 'if_true' | 'if_false'（条件分支标识）
);
```

## 3.6 系统日志表 (system_logs)

```sql
CREATE TABLE system_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp     TEXT NOT NULL,
  level         TEXT NOT NULL,             -- 'debug' | 'info' | 'warn' | 'error'
  module        TEXT NOT NULL,             -- 'scheduler' | 'trigger' | 'plugin' | 'db' | 'ipc' | 'app'
  message       TEXT NOT NULL,
  details       TEXT,                      -- 详细数据 (JSON)

  -- 关联（可选）
  task_id       TEXT,
  execution_id  TEXT
);

CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_module ON system_logs(module);
```

## 3.7 加密存储表 (vault)

```sql
CREATE TABLE vault (
  key           TEXT PRIMARY KEY,          -- 例如 'welink_token', 'email_password_xxx', 'llm_deepseek_key'
  value         TEXT NOT NULL,             -- 加密后的值
  created_at    TEXT NOT NULL
);
```