# 六、任务执行流程（v2）

## 6.1 任务生命周期

```
创建任务 (UI)
    │
    ├── 写入 SQLite
    │
    ▼
注册到调度器 (主进程)
    │
    ├── 单次-立即执行 → 直接入执行队列
    ├── 单次-定时执行 → 注册 setTimeout / 时间轮
    ├── 定时任务 → 注册 node-cron
    │
    ▼
注册触发器 (触发器引擎)
    │
    ├── Welink 轮询器 → 启动轮询间隔
    ├── 邮件轮询器 → 启动 IMAP 轮询
    ├── 文件轮询器 → 启动文件扫描
    ├── Webhook → 启动 HTTP 服务监听
    │
    ▼
等待触发 (idle 状态)
    │
    ├── 调度时间到 → 执行
    ├── 触发器条件满足 →
    │      ├── trigger_logic='or' → 直接执行
    │      └── trigger_logic='and' → 标记该触发器为"已触发"
    │              ├── 还有未触发的触发器 → 继续等待
    │              └── 全部已触发 → 执行
    ├── 用户点击"立即执行" → 执行
    │
    ▼
执行阶段 (running 状态)
    │
    ├── 1. 更新任务状态为 running
    ├── 2. 创建 execution_log 记录
    ├── 3. 初始化变量作用域
    │      ├── task 元信息
    │      ├── trigger 数据
    │      └── execution 上下文
    ├── 4. 按顺序执行每个 action
    │      ├── 替换模板变量（支持引用前序步骤输出）
    │      ├── 执行动作
    │      ├── 若配置了 output_var → 写入变量作用域
    │      ├── 记录结果到 execution_log.action_results
    │      └── 失败时根据 continue_on_error 决定
    ├── 5. 更新任务统计信息
    │
    ▼
执行完成
    │
    ├── 单次任务 → 状态变为 completed
    ├── 定时任务 → 重置调度，等待下一次
    │      └── 重置 AND 触发器的"已触发"状态
    └── 失败 → 状态变为 failed（可选重试）
```

## 6.2 调度引擎内部

```
┌─────────────────────────────────────────────┐
│              调度引擎                         │
│                                              │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │  Cron 调度器  │  │  单次任务调度器     │   │
│  │  (node-cron) │  │  (时间轮 + 定时器)  │   │
│  │              │  │                    │   │
│  │  0 9 * * *   │  │  2026-05-21T15:00 │   │
│  │  */30 * * * *│  │  2026-05-22T09:30 │   │
│  └──────┬───────┘  └────────┬───────────┘   │
│         │                   │               │
│         └───────┬───────────┘               │
│                 │                           │
│         ┌───────┴───────┐                   │
│         │  执行队列      │                   │
│         │  (FIFO + 并发) │                   │
│         └───────┬───────┘                   │
│                 │                           │
│         ┌───────┴───────┐                   │
│         │  执行器        │                   │
│         │  (执行 Actions)│                   │
│         └───────────────┘                   │
└─────────────────────────────────────────────┘
```

## 6.3 流程串接示例

### 示例 1：群消息 → 大模型分析 → 回复群聊

```
触发器: Welink 群消息检测
  ├── 群聊: "运维告警群"
  ├── 关键词: "故障"
  └── 发件人: "监控机器人"

动作序列:
  ① llm_call (分析告警)
     ├── provider: deepseek
     ├── messages: [system: 你是一级运维专家, user: 请分析以下告警并给出处理建议：{{trigger.data.text}}]
     └── output_var: analysis

  ② http_request (查询CMDB获取责任人)
     ├── url: https://cmdb.internal.com/api/asset?name={{trigger.data.text}}
     ├── output_var: owner_info
     └── 失败时继续: true (查不到也能发消息)

  ③ welink_message (回复群聊)
     ├── target_type: group
     ├── target_id: "运维告警群"
     └── content_template: |
          🤖 自动分析结果：
          {{steps.analysis}}

          责任人：{{steps.owner_info.owner_name | default('未找到')}}

  ④ send_email (发送详细报告给负责人)
     ├── to: ["{{steps.owner_info.owner_email}}"]
     └── subject_template: "故障分析报告 - {{task.name}}"
```

### 示例 2：定时轮询云空间文件 → Python 处理 → 发送汇总报告

```
调度: 每天 10:00

触发器: 文件检测
  ├── 监控目录: /shared/reports/
  └── 文件模式: "daily_*.csv"

动作序列:
  ① run_python (数据处理)
     ├── script_path: /scripts/process_report.py
     ├── args: ["{{trigger.data.file_path}}"]
     └── output_var: processed_data

  ② llm_call (生成摘要)
     ├── provider: glm
     ├── messages: [user: 请根据以下数据生成一段简洁的日报摘要：{{steps.processed_data}}]
     └── output_var: summary

  ③ welink_message (发送到日报群)
     ├── target_type: group
     ├── target_id: "日报群"
     └── content_template: "📊 日报摘要：\n{{steps.summary}}"

  ④ write_file (保存处理结果)
     ├── path: /archive/processed/{{execution.started_at}}.json
     └── content_template: "{{steps.processed_data}}"
```

### 示例 3：条件分支 — 根据 LLM 判断结果走不同流程

```
触发器: 邮件接收
  ├── 发件人: support@company.com
  └── 主题匹配: "客户反馈"

动作序列:
  ① llm_call (判断严重程度)
     ├── messages: [user: 判断以下客户反馈的严重程度(严重/一般/咨询)：{{trigger.data.email_body}}]
     └── output_var: severity

  ② condition (分支判断)
     ├── condition: "{{steps.severity}} contains '严重'"
     ├── if_true:
     │   ① welink_message (发到紧急群)
     │   ② send_email (通知主管)
     └── if_false:
         ① welink_message (发到普通反馈群)
         ② write_file (记录到日志)
```