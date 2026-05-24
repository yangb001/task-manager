# Task Manager — 桌面任务管理 App

一个基于 Electron + React + TypeScript 的桌面任务管理应用，支持**定时/单次任务调度**、**多类型触发器**（Welink 消息、邮件接收、文件检测、Webhook）、**动作流程串接**（HTTP 请求、LLM 调用、执行脚本、发送消息等），以及**插件化扩展**。

---

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 桌面框架 | **Electron 33** | 主进程常驻托盘，渲染进程纯 UI |
| 前端 | **React 18 + TypeScript** | 组件化开发 |
| UI 库 | **Ant Design** | 表单/表格/弹窗开箱即用 |
| 状态管理 | **Zustand** | 轻量无 boilerplate |
| 本地数据库 | **SQLite (sql.js)** | 零配置嵌入式，单人够用 |
| 任务调度 | **node-cron** + 自建时间轮 | Cron 定时 + 单次精确调度 |
| 构建打包 | **Vite** + **electron-builder** | 快速开发 + NSIS 安装包 |
| 加密存储 | Electron safeStorage | 系统级 AES-256-GCM 加密密码/Token |

---

## 项目结构

```
task-manager/
├── package.json                 # 项目配置
├── tsconfig.json                # TypeScript 配置
├── tsconfig.main.json           # 主进程 TS 配置
├── vite.config.ts               # Vite 构建配置
│
├── src/
│   ├── main/                    # 主进程（所有业务逻辑）
│   │   ├── index.ts             # 入口，创建窗口、托盘
│   │   ├── ipc-handlers.ts      # IPC 处理器注册
│   │   ├── preload.ts           # contextBridge 暴露 API
│   │   │
│   │   ├── database/            # 数据访问层
│   │   │   ├── connection.ts    # SQLite 连接
│   │   │   ├── repositories/    # Repository 模式
│   │   │   └── index.ts
│   │   │
│   │   ├── engine/              # 任务引擎
│   │   │   ├── scheduler.ts     # 调度器（Cron + 时间轮）
│   │   │   ├── executor.ts      # 执行器（执行 Actions）
│   │   │   ├── task-manager.ts  # 任务管理器（生命周期）
│   │   │   └── index.ts
│   │   │
│   │   ├── plugin/              # 插件系统
│   │   │   ├── plugin-manager.ts
│   │   │   ├── plugin-types.ts
│   │   │   ├── plugin-scanner.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── triggers/            # 内置触发器插件
│   │   │   ├── manual/          # 手动触发
│   │   │   └── webhook/         # Webhook 监听
│   │   │
│   │   ├── actions/             # 内置动作插件
│   │   │   ├── welink-message/  # 发送 Welink 消息
│   │   │   └── http-request/    # HTTP 远程调用
│   │   │
│   │   ├── log/                 # 日志系统
│   │   ├── services/            # 公共服务
│   │   └── tray.ts              # 系统托盘
│   │
│   ├── renderer/                # 渲染进程（纯 UI）
│   │   ├── index.html
│   │   ├── main.tsx             # React 入口
│   │   ├── App.tsx
│   │   │
│   │   ├── pages/               # 页面
│   │   │   ├── TaskListPage.tsx
│   │   │   ├── TaskFormModal.tsx
│   │   │   ├── ExecutionHistoryPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── AppLayout.tsx
│   │   │
│   │   ├── components/          # 通用组件
│   │   ├── stores/              # Zustand 状态管理
│   │   │   ├── taskStore.ts
│   │   │   └── themeStore.tsx
│   │   └── hooks/               # 自定义 Hooks
│   │
│   ├── shared/                  # 主进程和渲染进程共享
│   │   ├── types.ts             # 类型定义
│   │   └── index.ts
│   │
│   └── types/                   # 额外类型声明
│
├── plugins/                     # 用户自定义插件目录
│   ├── triggers/
│   └── actions/
│
├── resources/                   # 图标资源
├── dist/                        # 编译输出
├── release/                     # 打包输出
└── logs/                        # 运行时日志（自动生成）
```

---

## 环境要求

| 依赖 | 版本要求 | 说明 |
|---|---|---|
| **Node.js** | >= 18.x | 推荐 22.x LTS |
| **npm** | >= 9.x | 随 Node 安装 |
| **Python** | >= 3.8 | 仅 `run_python` 动作需要 |
| 操作系统 | Windows 10+ | 目前仅支持 Windows 打包 |

---

## 启动步骤

### 1. 安装依赖

```bash
cd task-manager
npm install

# yixia
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
pnpm install --no-frozen-lockfile
```

### 2. 开发模式运行

```bash
npm run dev
```

该命令会同时启动：
- 主进程 TypeScript 编译（watch 模式）
- 渲染进程 Vite 开发服务器（热更新）

### 3. 构建生产版本

```bash
pnpm run build
```

编译主进程和渲染进程到 `dist/` 目录。

### 4. 打包安装包

```bash
pnpm run pack
```

输出 NSIS 安装包到 `release/` 目录，产物：`TaskManager-{version}-setup.exe`

### 5. 直接启动（构建后）

```bash
npm start
```

或双击 `release/TaskManager-{version}-setup.exe` 安装后启动。

---

## 使用说明

### 访问方式

安装后通过桌面快捷方式或开始菜单启动，应用运行后会在系统托盘常驻。关闭窗口不会退出应用，主进程继续在托盘运行。

### 主要功能

| 功能 | 说明 |
|---|---|
| **任务管理** | 创建/编辑/删除任务，支持单次执行和定时调度 |
| **触发器** | 配置 Welink 消息监听、邮件接收、文件检测、Webhook、手动触发 |
| **动作流程** | 按顺序执行多个动作：HTTP 请求、LLM 调用、发 Welink 消息、发邮件、执行脚本、写入文件等 |
| **条件分支** | 根据条件判断走不同动作分支（if/else） |
| **变量传递** | 前序动作输出通过 `output_var` 传递给后续动作引用 |
| **执行历史** | 查看每次执行的详细记录，包括每个动作的输入/输出/耗时/错误 |
| **系统日志** | 应用运行状态日志，支持按级别/模块/时间筛选 |
| **主题设置** | 亮色/暗色双主题，毛玻璃质感，支持自定义背景和卡片样式 |
| **账号管理** | 管理 Welink、邮箱、LLM Provider 等外部服务的账号凭证（加密存储） |
| **插件管理** | 内置插件 + 用户自定义插件目录扫描 |

### 任务类型

- **单次任务**：立即执行 或 指定时间执行一次
- **定时任务**：Cron 表达式设定周期执行，支持开始/结束时间和最大执行次数

### 触发器关系

- **OR 模式**（默认）：任一触发器满足条件即执行
- **AND 模式**：所有触发器都满足条件后才执行

---

## 配置说明

### 关键配置文件

| 文件 | 说明 |
|---|---|
| `package.json` | 项目元信息、依赖、构建配置 |
| `tsconfig.json` | TypeScript 编译配置 |
| `tsconfig.main.json` | 主进程专用编译配置 |
| `vite.config.ts` | 渲染进程 Vite 构建配置 |

### 构建配置（package.json 中的 `build` 字段）

```json
{
  "appId": "com.taskmanager.app",
  "productName": "Task Manager",
  "win": {
    "target": ["nsis"],
    "artifactName": "TaskManager-${version}-setup.${ext}"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true
  },
  "asarUnpack": ["node_modules/sql.js/dist/sql-wasm.wasm"]
}
```

### 数据库

- **位置**：运行时在用户数据目录自动创建
- **引擎**：SQLite（通过 `sql.js` 库）
- **表结构**：`tasks`、`triggers`、`actions`、`execution_logs`、`action_logs`、`system_logs`、`vault`
- **敏感数据**：密码/Token 通过 Electron safeStorage 加密后存入 `vault` 表

### 日志

| 日志类型 | 存储位置 | 保留策略 |
|---|---|---|
| 执行日志 | SQLite `execution_logs` + `action_logs` | 30 天 / 10000 条 |
| 系统日志 | SQLite `system_logs` | 7 天 / 50000 条 |
| 文件日志（可选） | `logs/` 目录 JSON Lines | 按天轮转 |

### 插件

- **内置插件**：位于 `src/main/triggers/` 和 `src/main/actions/`
- **用户自定义插件**：位于 `plugins/triggers/` 和 `plugins/actions/`
- **插件格式**：每个插件一个目录，包含 `manifest.json` 声明文件和 `index.ts` 实现

---

## 开发命令速查

```bash
npm run dev              # 开发模式
npm run build            # 构建
npm run pack             # 打包 NSIS 安装包
npm run pack:dir         # 打包为目录（不压缩）
npm start                # 启动已构建的应用
```