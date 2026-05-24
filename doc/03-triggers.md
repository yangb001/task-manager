# 四、触发器详细设计

每个任务可以配置 **0 到多个触发器**。0 个触发器 = 手动执行或按调度时间执行。

多个触发器之间的关系由任务的 `trigger_logic` 字段控制：
- **`or`**（默认）：任一触发器满足条件即执行任务
- **`and`**：所有触发器都满足条件后才执行任务

> `and` 模式下，每个触发器触发时不会立即执行任务，而是标记为"已触发"，直到所有触发器都被触发后才真正执行。
> 定时调度和手动触发不受 `trigger_logic` 影响，始终可以触发执行。

### Welink 消息轮询触发器

```json
{
  "type": "welink_message",
  "config": {
    "chat_id": "string",
    "sender_ids": ["string"],
    "keyword": "string",
    "match_mode": "contains | regex | exact",
    "poll_interval_sec": 30,
    "last_check_message_id": "string"
  }
}
```

- `chat_id`：群聊 ID（可选，不指定则监听所有）
- `sender_ids`：指定发送人（可选）
- `keyword`：关键词匹配
- `match_mode`：匹配模式
- `poll_interval_sec`：轮询间隔（秒），最小 10
- `last_check_message_id`：内部使用，记录上次检查到的位置

### 邮件接收触发器

```json
{
  "type": "email_received",
  "config": {
    "imap_host": "string",
    "imap_port": 993,
    "username": "string",
    "sender_filter": ["string"],
    "subject_match": "string",
    "body_match": "string",
    "folder": "INBOX",
    "poll_interval_sec": 60,
    "last_check_uid": 0
  }
}
```

- `username`：邮箱用户名，密码存在 vault 中
- `sender_filter`：指定发件人列表（可选）
- `subject_match`：主题匹配（可选）
- `body_match`：正文匹配（可选）
- `folder`：监听的文件夹
- `poll_interval_sec`：轮询间隔
- `last_check_uid`：内部使用

### 文件检测触发器

```json
{
  "type": "file_detected",
  "config": {
    "watch_dir": "string",
    "file_pattern": "string",
    "min_size_bytes": 0,
    "max_age_sec": 0,
    "poll_interval_sec": 30,
    "action_on": "new | modified",
    "known_files": ["string"]
  }
}
```

- `watch_dir`：监控目录
- `file_pattern`：文件名通配符，如 `*.csv`、`report_*.xlsx`
- `min_size_bytes`：最小文件大小（可选）
- `max_age_sec`：文件最大存在时间（可选，避免刚创建的临时文件）
- `poll_interval_sec`：轮询间隔
- `action_on`：新文件还是文件修改
- `known_files`：内部使用，已处理文件列表

### Webhook 触发器

```json
{
  "type": "webhook",
  "config": {
    "port": 0,
    "path": "/webhook/task-xxx",
    "method": "POST",
    "secret": "string",
    "response_body": "string"
  }
}
```

- `port`：本地监听端口，默认 0（随机分配）
- `path`：URL 路径
- `method`：HTTP 方法
- `secret`：可选，验证签名
- `response_body`：可选，返回给调用方的内容

### 手动触发器

```json
{
  "type": "manual",
  "config": {}
}
```

无配置，通过 UI 点击"立即执行"触发。