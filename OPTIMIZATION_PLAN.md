# Task Manager 架构优化计划

## 一、问题总览

| 优先级 | 领域 | 问题数 | 风险等级 |
|--------|------|--------|----------|
| P0 | 并发安全 | 3 | 高 — 数据不一致 |
| P0 | IPC 接口不匹配 | 2 | 高 — 运行时报错 |
| P1 | 数据库性能 | 4 | 中 — 写放大/缺索引 |
| P1 | 执行引擎可靠性 | 3 | 中 — 任务卡死/无重试 |
| P1 | 前端状态与性能 | 4 | 中 — 频繁全量刷新 |
| P2 | 插件安全 | 2 | 中 — 主进程崩溃风险 |
| P2 | 错误处理 | 3 | 低 — 用户体验差 |
| P3 | 代码质量 | 3 | 低 — 可维护性 |

---

## 二、逐项深入分析

### 2.1 【P0】并发安全 — 执行器无锁

**现状：**

`executor.executeTask()` 没有任何并发保护。同一任务可被以下路径同时触发：
- 用户点击"立即执行"（手动触发）
- Cron 定时到达（调度器触发）
- 外部条件满足（触发器触发）

`taskRepo.update` 仅设置 `status: 'running'`，但执行前不检查当前状态。SQLite 虽然是进程级锁，但 sql.js 运行在内存中，没有数据库级的并发控制。

**风险场景：**

```
时间线：
  T1: 定时触发 → executeTask(taskA) → 开始执行 action1
  T2: 用户手动触发 → executeTask(taskA) → 开始执行 action1（重复！）
  T3: 两个执行流同时写 execution_log → 产生两条重复记录
  T4: 两个执行流同时更新 task 统计 → 计数翻倍
```

**影响：**
- 执行日志重复/混乱
- 任务统计不准确
- 变量作用域互相污染（两个执行流共享内存中的变量）

**优化方案：**

```typescript
// executor.ts 增加执行锁
class Executor {
  private runningTasks = new Set<string>();

  async executeTask(taskId: string, triggerData?: TriggerData): Promise<void> {
    if (this.runningTasks.has(taskId)) {
      throw new Error(`Task ${taskId} is already running`);
    }
    this.runningTasks.add(taskId);
    try {
      // ... 原有执行逻辑
    } finally {
      this.runningTasks.delete(taskId);
    }
  }
}
```

同时在 `task-manager.ts` 的 `executeNow` 方法中增加状态检查：

```typescript
async executeNow(taskId: string): Promise<void> {
  const task = taskRepo.get(taskId);
  if (task.status === 'running') {
    throw new Error('Task is already running');
  }
  // ...
}
```

---

### 2.2 【P0】IPC 接口不匹配

**现状（代码实际 vs 渲染进程调用）：**

| 渲染进程调用 | preload 暴露 | 状态 |
|-------------|-------------|------|
| `window.taskManager.settings.get/set` | 未暴露 `settings` 命名空间 | **运行时报错** |
| `window.taskManager.executionLogs.list` | 实际为 `history.list` | **运行时报错** |

**优化方案：**

方案 A（推荐）：修改渲染进程代码，统一使用 preload 暴露的接口名。
方案 B：在 preload 中补充 `settings` 和 `executionLogs` 命名空间。

同时建议统一 preload 中的类型定义，消除 `any`：

```typescript
// preload.ts
contextBridge.exposeInMainWorld('taskManager', {
  tasks: {
    list: (filter?: TaskFilter): Promise<Task[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_LIST, filter),
    // ...
  } as TaskManagerAPI['tasks'],  // 类型约束
  // ...
});
```

---

### 2.3 【P1】数据库写放大

**现状：**

sql.js 在内存中运行 SQLite，每次写操作后调用 `saveDatabase()`：

```typescript
// connection.ts
export function saveDatabase(): void {
  const data = db.export();        // 导出整个数据库为 Uint8Array
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer); // 全量写入文件
}
```

每个 repository 的 create/update/delete 方法末尾都调用 `saveDatabase()`。批量操作（如清理日志、批量导入）时，N 次写操作 = N 次全量写盘。

**量化影响：**

假设数据库 10MB，单次 `export() + writeFileSync` 约 50ms。清理 1000 条旧日志 = 50 秒。

**优化方案：引入写缓冲 + 定时刷盘**

```typescript
// connection.ts
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000; // 5秒

export function markDirty(): void {
  dirty = true;
  if (!flushTimer) {
    flushTimer = setTimeout(flushToDisk, FLUSH_INTERVAL);
  }
}

export function flushToDisk(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (dirty) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    dirty = false;
  }
}

// 进程退出时强制刷盘
export function closeDatabase(): void {
  flushToDisk();
  db.close();
}
```

所有 repository 的写操作改为调用 `markDirty()` 代替 `saveDatabase()`。应用退出时调用 `flushToDisk()` 确保数据不丢失。

---

### 2.4 【P1】缺少索引

**现状：**

已建索引：system_logs(timestamp/level/module)、execution_logs(task_id)、action_logs(execution_id)、triggers/actions(task_id)。

**缺失索引：**

| 表 | 缺失索引 | 影响的查询 |
|----|---------|-----------|
| execution_logs | `started_at DESC` | `list()` 按时间排序，全表扫描 |
| execution_logs | `status` | 按状态筛选时全表扫描 |
| tasks | `status` | 任务列表按状态过滤 |
| tasks | `group_name` | 按分组过滤 |

**优化方案：**

```sql
CREATE INDEX idx_execution_logs_started_at ON execution_logs(started_at DESC);
CREATE INDEX idx_execution_logs_status ON execution_logs(status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_group_name ON tasks(group_name);
```

---

### 2.5 【P1】执行引擎 — 无超时机制

**现状：**

`executor.executeTask` 串行执行 actions，每个 action 直接 `await plugin.execute()`。如果插件挂起（网络超时、死循环、外部进程不退出），整个任务永久阻塞。

**风险：**
- `run_command` 执行的外部命令不退出
- `http_request` 目标服务器不响应（虽有 timeout 配置，但依赖插件自身实现）
- `llm_call` API 无响应
- 用户自定义插件 bug

**优化方案：Promise.race 超时包装**

```typescript
// executor.ts
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// 执行单个动作时
const timeoutMs = (action.config.timeout_sec || 300) * 1000;
const result = await withTimeout(
  plugin.execute(config, context),
  timeoutMs,
  `Action ${action.type}:${action.id}`
);
```

任务级超时：在 `task.schedule` 中增加 `timeout_sec` 字段，整个任务执行超过该时间则强制终止。

---

### 2.6 【P1】执行引擎 — 无重试机制

**现状：**

动作失败后直接记录错误，根据 `continue_on_error` 决定是否继续。文档中提到"可选重试"但代码未实现。

**优化方案：指数退避重试**

```typescript
// executor.ts
interface RetryConfig {
  max_retries: number;     // 最大重试次数
  delay_sec: number;       // 初始延迟
  backoff: 'fixed' | 'exponential';  // 退避策略
}

async function executeWithRetry(
  plugin: ActionPlugin,
  config: Record<string, any>,
  context: ActionContext,
  retry?: RetryConfig
): Promise<ActionResult> {
  let lastError: Error | undefined;
  const maxAttempts = (retry?.max_retries || 0) + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await plugin.execute(config, context);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxAttempts - 1 && retry) {
        const delay = retry.backoff === 'exponential'
          ? retry.delay_sec * Math.pow(2, attempt)
          : retry.delay_sec;
        context.logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}s...`);
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }
  }
  return { status: 'failed', error: lastError?.message };
}
```

在 action 配置中增加 `retry` 字段（文档中 http_request 已有此字段定义，但未实现）。

---

### 2.7 【P1】前端 — 全量刷新 Store

**现状：**

`taskStore.ts` 中每个写操作都调用 `fetchTasks()` 全量刷新：

```typescript
createTask: async (data) => {
  await window.taskManager.tasks.create(data);
  await get().fetchTasks();  // 全量重新拉取
},
```

每次 create/update/delete/start/pause/resume 都触发一次完整的 IPC 查询 + 状态替换。

**优化方案：乐观更新 + 增量同步**

```typescript
// taskStore.ts
createTask: async (data) => {
  const tempId = crypto.randomUUID();
  // 乐观更新：先插入本地状态
  set(state => ({
    tasks: [...state.tasks, { ...data, id: tempId, status: 'idle' } as Task]
  }));
  try {
    const created = await window.taskManager.tasks.create(data);
    // 用服务端返回的真实数据替换临时数据
    set(state => ({
      tasks: state.tasks.map(t => t.id === tempId ? created : t)
    }));
  } catch (err) {
    // 回滚：移除乐观插入的数据
    set(state => ({
      tasks: state.tasks.filter(t => t.id !== tempId)
    }));
    throw err;
  }
},
```

对于状态变更类操作（start/pause/resume），可通过 IPC 事件订阅 (`onTaskStatusChange`) 接收增量更新，而非全量刷新。

---

### 2.8 【P1】前端 — 缺少列表虚拟化

**现状：**

`TaskListPage` 和 `ExecutionHistoryPage` 直接 `.map()` 渲染全部列表项。执行历史可能达万条级别。

**优化方案：**

使用 `react-window` 或 `@tanstack/react-virtual` 实现虚拟滚动：

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function ExecutionHistoryPage({ logs }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,  // 每行预估高度
    overscan: 10,
  });

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(vItem => (
          <LogRow key={vItem.key} log={logs[vItem.index]} />
        ))}
      </div>
    </div>
  );
}
```

---

### 2.9 【P2】插件安全 — 无隔离

**现状：**

插件通过 `dynamic import()` 直接加载到主进程中，运行在同一个 V8 isolate。恶意或有缺陷的插件可以：
- 访问所有 Node.js API
- 读写任意文件
- 访问 Electron 主进程对象
- 阻塞事件循环

**优化方案（分阶段）：**

**阶段 1 — 快速加固（不改架构）：**
- 对用户自定义插件的入口文件做静态检查（禁止 `require('child_process')` 等危险模块）
- 在 `PluginManager.executeAction` 中增加执行时间上限
- 插件 manifest 增加 `permissions` 字段声明所需权限

**阶段 2 — Worker 隔离（推荐）：**

```typescript
// plugin-worker.ts
import { parentPort, workerData } from 'worker_threads';

// 在 Worker 中加载和执行插件
const plugin = await import(workerData.entryPath);

parentPort?.on('message', async ({ action, config, context }) => {
  try {
    const result = await plugin.execute(config, context);
    parentPort?.postMessage({ type: 'result', data: result });
  } catch (err) {
    parentPort?.postMessage({ type: 'error', error: err.message });
  }
});
```

主进程通过 `Worker` 创建隔离线程，插件崩溃不会影响主进程。同时可以设置 Worker 的资源限制（内存、执行时间）。

---

### 2.10 【P2】错误处理薄弱

**现状：**

| 层 | 错误处理 |
|----|---------|
| Repository | 无 try-catch，异常直接冒泡 |
| IPC Handler | 无 try-catch，主进程异常直接传回渲染进程 |
| taskStore | 仅 `console.error`，无用户提示 |
| TaskFormModal | 仅 `console.error`，保存失败无提示 |

**优化方案：分层错误处理**

**主进程 — IPC Handler 层统一捕获：**

```typescript
// ipc-handlers.ts
function wrapHandler<T>(handler: (...args: any[]) => Promise<T>) {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: any[]) => {
    try {
      return { success: true, data: await handler(...args) };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  };
}

ipcMain.handle(IPC_CHANNELS.TASK_LIST, wrapHandler(async (filter) => {
  return taskRepo.list(filter);
}));
```

**渲染进程 — 统一处理 IPC 响应：**

```typescript
// utils/ipc.ts
async function invokeIPC<T>(channel: string, ...args: any[]): Promise<T> {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}
```

**UI 层 — 使用 Ant Design 的 message/notification 组件展示错误：**

```typescript
try {
  await taskStore.createTask(data);
  message.success('任务创建成功');
} catch (err) {
  message.error(`创建失败: ${err.message}`);
}
```

---

### 2.11 【P2】敏感信息泄露风险

**现状：**

- `execution_logs.action_logs.input_config` 存储了模板替换后的实际配置，可能包含 `{{vault:token}}` 解密后的明文
- `execution_logs.variables_snapshot` 可能包含 vault 解密后的值
- 系统日志如果记录了请求/响应，也可能泄露 token

**优化方案：**

在写入日志前，对敏感字段进行脱敏：

```typescript
function sanitizeForLog(obj: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'api_key', 'secret', 'authorization'];
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      result[key] = '***REDACTED***';
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = sanitizeForLog(result[key]);
    }
  }
  return result;
}
```

---

### 2.12 【P2】LIMIT/OFFSET 字符串拼接

**现状（execution-log-repo.ts）：**

```typescript
// 直接拼接数字到 SQL 字符串
const sql = `SELECT * FROM execution_logs ${whereClause} ORDER BY started_at DESC LIMIT ${limit} OFFSET ${offset}`;
```

虽然 `limit` 和 `offset` 来自代码内部（非用户输入），但违反参数化查询最佳实践。

**优化方案：改为参数绑定**

```typescript
const sql = `SELECT * FROM execution_logs ${whereClause} ORDER BY started_at DESC LIMIT ? OFFSET ?`;
const stmt = db.prepare(sql);
// ... bind params 中加入 limit 和 offset
```

---

### 2.13 【P3】代码质量问题

| 问题 | 位置 | 修复方案 |
|------|------|---------|
| 全局 `any` 类型 | connection.ts `getDatabase()` | 返回 `Database` 类型（sql.js 导出） |
| 内联样式对象 | TaskListPage/AppLayout 渲染函数内 | 移至模块级别常量或使用 CSS-in-JS |
| 未使用的 prop | ExecutionHistoryPage `onNavigate` | 移除或实现跳转逻辑 |
| 占位代码 | ipc-handlers 配置类 handler 返回 `[]` | 实现或标注 TODO |
| 未绑定的表单 | TaskFormModal 高级设置 input | 绑定到 form state |
| TriggerConfig/ActionConfig | 仅 JSON.stringify 展示 | 后续迭代实现 Schema 驱动的表单 |

---

## 三、实施路线图

### 阶段 1：止血（1-2 周）

解决会直接导致运行时报错或数据不一致的问题。

| 序号 | 任务 | 工作量 | 优先级 |
|------|------|--------|--------|
| 1.1 | 修复 IPC 接口不匹配（settings/executionLogs） | 0.5d | P0 |
| 1.2 | 执行器增加并发锁（runningTasks Set） | 0.5d | P0 |
| 1.3 | IPC Handler 层统一错误包装 | 1d | P0 |
| 1.4 | 渲染进程统一 IPC 响应处理 + 错误提示 | 1d | P1 |
| 1.5 | 添加缺失的数据库索引 | 0.5d | P1 |

### 阶段 2：加固（2-3 周）

提升执行引擎的可靠性和数据库性能。

| 序号 | 任务 | 工作量 | 优先级 |
|------|------|--------|--------|
| 2.1 | 执行器增加超时机制（动作级 + 任务级） | 2d | P1 |
| 2.2 | 实现重试机制（指数退避） | 2d | P1 |
| 2.3 | 数据库写缓冲（markDirty + 定时刷盘） | 1.5d | P1 |
| 2.4 | LIMIT/OFFSET 参数化 | 0.5d | P2 |
| 2.5 | 敏感信息日志脱敏 | 1d | P2 |
| 2.6 | taskStore 乐观更新 | 1.5d | P1 |

### 阶段 3：优化（2-3 周）

提升用户体验和代码质量。

| 序号 | 任务 | 工作量 | 优先级 |
|------|------|--------|--------|
| 3.1 | 列表虚拟滚动（执行历史/任务列表） | 2d | P1 |
| 3.2 | 内联样式重构 | 1d | P3 |
| 3.3 | preload 类型安全（消除 any） | 1d | P3 |
| 3.4 | TaskFormModal 高级设置表单绑定 | 0.5d | P3 |
| 3.5 | 移除占位代码 / 标注 TODO | 0.5d | P3 |

### 阶段 4：安全加固（3-4 周）

插件隔离和安全防护。

| 序号 | 任务 | 工作量 | 优先级 |
|------|------|--------|--------|
| 4.1 | 插件 manifest 增加 permissions 字段 | 1d | P2 |
| 4.2 | 用户插件静态安全检查 | 2d | P2 |
| 4.3 | 插件 Worker 线程隔离 | 5d | P2 |
| 4.4 | run_command 命令白名单/沙箱 | 2d | P2 |

---

## 四、总结

本项目架构设计合理（主进程/渲染进程分离、插件化、变量作用域），但在工程健壮性上有明显短板。核心问题是：

1. **执行器无并发保护** — 最高优先级修复，否则生产环境必然出数据问题
2. **IPC 接口不匹配** — 直接导致运行时报错，属于 bug 级别
3. **数据库写放大** — 当前可用，但随数据增长会成为性能瓶颈
4. **无超时/重试** — 任务可能永久卡死，影响系统可用性

建议按阶段 1 → 2 → 3 → 4 的顺序推进，每个阶段完成后进行回归测试。
