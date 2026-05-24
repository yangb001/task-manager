import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: any = null;
let dbPath: string = '';

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'task-manager.db');
}

export function getDatabase(): any {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  dbPath = getDbPath();

  // sql.js 的 wasm 文件位置
  const SQL: any = await initSqlJs({
    locateFile: (file: string) => {
      // 在 asar 包中，wasm 文件在 node_modules/sql.js/dist/
      return require('path').join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', file);
    }
  });

  // 尝试加载已有数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 建表
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT DEFAULT '',
      type          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'idle',
      schedule      TEXT NOT NULL DEFAULT '{}',
      trigger_logic TEXT NOT NULL DEFAULT 'or',
      tags          TEXT DEFAULT '[]',
      group_name    TEXT DEFAULT '',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      total_runs    INTEGER DEFAULT 0,
      last_run_at   TEXT,
      last_run_status TEXT
    );

    CREATE TABLE IF NOT EXISTS triggers (
      id            TEXT PRIMARY KEY,
      task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      type          TEXT NOT NULL,
      config        TEXT NOT NULL DEFAULT '{}',
      enabled       INTEGER NOT NULL DEFAULT 1,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id            TEXT PRIMARY KEY,
      task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      type          TEXT NOT NULL,
      name          TEXT DEFAULT '',
      config        TEXT NOT NULL DEFAULT '{}',
      enabled       INTEGER NOT NULL DEFAULT 1,
      continue_on_error INTEGER NOT NULL DEFAULT 0,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS execution_logs (
      id            TEXT PRIMARY KEY,
      task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      trigger_id    TEXT,
      trigger_data  TEXT,
      status        TEXT NOT NULL,
      started_at    TEXT NOT NULL,
      finished_at   TEXT,
      duration_ms   INTEGER,
      error_message TEXT,
      variables_snapshot TEXT,
      action_count     INTEGER DEFAULT 0,
      success_count    INTEGER DEFAULT 0,
      failed_count     INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS action_logs (
      id            TEXT PRIMARY KEY,
      execution_id  TEXT NOT NULL REFERENCES execution_logs(id) ON DELETE CASCADE,
      task_id       TEXT NOT NULL,
      sort_order    INTEGER NOT NULL,
      action_id     TEXT,
      action_type   TEXT NOT NULL,
      action_name   TEXT,
      status        TEXT NOT NULL,
      started_at    TEXT NOT NULL,
      finished_at   TEXT,
      duration_ms   INTEGER,
      input_config  TEXT,
      output_data   TEXT,
      error_message TEXT,
      error_stack   TEXT,
      log_content   TEXT,
      log_level     TEXT DEFAULT 'info',
      parent_action_id TEXT,
      branch        TEXT
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp     TEXT NOT NULL,
      level         TEXT NOT NULL,
      module        TEXT NOT NULL,
      message       TEXT NOT NULL,
      details       TEXT,
      task_id       TEXT,
      execution_id  TEXT
    );
  `);

  // 创建索引
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)',
    'CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs(module)',
    'CREATE INDEX IF NOT EXISTS idx_execution_logs_task ON execution_logs(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_action_logs_execution ON action_logs(execution_id)',
    'CREATE INDEX IF NOT EXISTS idx_triggers_task ON triggers(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_actions_task ON actions(task_id)',
  ];
  for (const idx of indexes) {
    db.run(idx);
  }

  // 保存到文件
  saveDatabase();
}

export function saveDatabase(): void {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}