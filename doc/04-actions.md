# 五、动作详细设计（v2）

任务执行时，按 `sort_order` 顺序执行所有启用的动作。**任一动作失败**，后续动作是否继续执行由 `continue_on_error` 控制。

## 5.1 动作类型总览

| 类型 | 说明 |
|---|---|
| `welink_message` | 发送 Welink 消息 |
| `send_email` | 发送邮件 |
| `http_request` | HTTP/HTTPS 远程调用（GET/POST/PUT/DELETE） |
| `llm_call` | 调用大模型 API（支持多厂商） |
| `run_python` | 执行本地 Python 脚本 |
| `run_command` | 执行任意本地命令 |
| `write_file` | 写入文件 |
| `webhook_callback` | Webhook 回调 |
| `transform` | 数据转换/处理（JSON 提取、模板渲染等） |
| `condition` | 条件分支（if/else） |

## 5.2 动作详细配置

### Welink 消息动作

```json
{
  "type": "welink_message",
  "name": "发送日报提醒",
  "continue_on_error": false,
  "config": {
    "target_type": "user | group",
    "target_id": "string",
    "message_type": "text | markdown | rich",
    "content_template": "string"
  }
}
```

### 发送邮件动作

```json
{
  "type": "send_email",
  "name": "发送告警邮件",
  "continue_on_error": false,
  "config": {
    "smtp_host": "string",
    "smtp_port": 465,
    "username": "string",
    "from": "string",
    "to": ["string"],
    "cc": ["string"],
    "subject_template": "string",
    "body_template": "string",
    "attachments": [
      { "type": "file | inline", "path_template": "string" }
    ]
  }
}
```

### HTTP/HTTPS 远程调用动作

```json
{
  "type": "http_request",
  "name": "调用内部API",
  "continue_on_error": false,
  "config": {
    "url": "string",
    "method": "GET | POST | PUT | PATCH | DELETE",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer {{vault:api_token}}"
    },
    "body_template": "string",
    "query_params": { "key": "value" },
    "timeout_sec": 30,
    "retry": { "max_retries": 3, "delay_sec": 5 },
    "output_var": "api_response"   // 将响应存入变量，供后续动作引用
  }
}
```

- `output_var`：将 HTTP 响应体存入指定变量名，后续动作可通过 `{{steps.api_response}}` 引用
- 响应自动解析 JSON，支持 `{{steps.api_response.data.id}}` 链式访问

### 大模型 API 调用动作

```json
{
  "type": "llm_call",
  "name": "调用DeepSeek分析消息",
  "continue_on_error": false,
  "config": {
    "provider": "openai | deepseek | glm | custom",
    "base_url": "string",
    "model": "deepseek-chat",
    "api_key_var": "llm_deepseek_key",   // 引用 vault 中的 key
    "messages": [
      { "role": "system", "content": "你是一个数据分析助手" },
      { "role": "user", "content": "请分析以下内容：{{trigger.data.text}}" }
    ],
    "temperature": 0.7,
    "max_tokens": 2000,
    "response_format": { "type": "text" },
    "output_var": "llm_result"           // 将 LLM 响应存入变量
  }
}
```

- `provider`：预置 OpenAI 兼容接口、DeepSeek、GLM 等，也支持自定义 `base_url`
- `api_key_var`：API Key 存在 vault 中，不明文存储
- `messages`：支持模板变量，可引用 `{{trigger.data}}`、`{{steps.xxx}}` 等
- `output_var`：将 LLM 响应（`content` 字段）存入变量

### 本地 Python 脚本执行动作

```json
{
  "type": "run_python",
  "name": "执行数据处理脚本",
  "continue_on_error": false,
  "config": {
    "script_path": "C:\\scripts\\process.py",
    "script_content": "string",          // 与 script_path 二选一，直接写代码
    "args": ["{{trigger.data.file_path}}"],
    "python_path": "python",
    "working_dir": "string",
    "timeout_sec": 300,
    "env": { "MY_VAR": "value" },
    "capture_output": true,
    "output_var": "py_result"            // 将 stdout 存入变量
  }
}
```

- `script_path` 与 `script_content` 二选一
- `output_var`：将脚本 stdout 存入变量

### 执行命令动作

```json
{
  "type": "run_command",
  "name": "执行部署脚本",
  "continue_on_error": false,
  "config": {
    "command": "bash deploy.sh",
    "args": ["{{trigger.data.branch}}"],
    "working_dir": "/opt/deploy",
    "timeout_sec": 300,
    "env": { "DEPLOY_ENV": "production" },
    "capture_output": true,
    "output_var": "cmd_output"
  }
}
```

### 写入文件动作

```json
{
  "type": "write_file",
  "name": "保存分析结果",
  "continue_on_error": false,
  "config": {
    "path": "C:\\reports\\{{task.name}}_{{execution.started_at}}.md",
    "content_template": "string",
    "append": false,
    "encoding": "utf8"
  }
}
```

### Webhook 回调动作

```json
{
  "type": "webhook_callback",
  "name": "通知外部系统",
  "continue_on_error": false,
  "config": {
    "url": "string",
    "method": "POST",
    "headers": { "X-Signature": "sha256=..." },
    "body_template": "string",
    "timeout_sec": 30
  }
}
```

### 数据转换动作（新增）

```json
{
  "type": "transform",
  "name": "提取消息中的关键信息",
  "continue_on_error": false,
  "config": {
    "input_var": "llm_result",
    "operations": [
      { "op": "json_extract", "path": "$.choices[0].message.content" },
      { "op": "regex_extract", "pattern": "【告警】(.*?)【", "group": 1 },
      { "op": "template", "template": "处理结果：{{value}}" }
    ],
    "output_var": "transformed_data"
  }
}
```

- 用于在动作之间做数据清洗、格式转换
- 支持 JSON 提取、正则提取、模板渲染等

### 条件分支动作（新增）

```json
{
  "type": "condition",
  "name": "判断是否需要告警",
  "continue_on_error": true,
  "config": {
    "condition": "{{steps.llm_result}} contains '严重'",
    "if_true": [
      { "type": "welink_message", "config": { ... } }
    ],
    "if_false": [
      { "type": "write_file", "config": { ... } }
    ]
  }
}
```

- 根据条件判断走不同分支
- `condition` 支持简单的表达式：`contains`、`equals`、`gt`、`lt`、`regex_match` 等
- 分支内可以嵌套任意动作（包括另一个 condition）

## 5.3 变量系统

所有动作的字符串配置都支持模板变量替换。变量来源：

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

### 变量作用域

- 一次任务执行中，所有动作共享同一个变量作用域
- 每个动作通过 `output_var` 将结果写入作用域
- 后序动作通过 `{{steps.<output_var>}}` 读取

## 5.4 动作执行引擎

```
执行开始
    │
    ▼
初始化变量作用域
    ├── 注入 task 元信息
    ├── 注入 trigger 数据
    ├── 注入 execution 上下文
    └── 注入 vault 引用（惰性加载）
    │
    ▼
遍历 actions（按 sort_order）
    │
    ├── 替换配置中的模板变量
    ├── 执行动作
    ├── 若配置了 output_var → 将结果写入变量作用域
    ├── 若失败 → 根据 continue_on_error 决定
    │      ├── true → 记录错误，继续下一个
    │      └── false → 终止，任务标记 failed
    │
    ▼
执行完成
    ├── 全部成功 → 任务标记 success
    └── 有失败 → 任务标记 failed（含错误信息）
```