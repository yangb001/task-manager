import { v4 as uuidv4 } from 'uuid';
import { getDatabase, markDirty } from '../connection';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilter } from '../../../shared/types';

export class TaskRepository {
  list(filter?: TaskFilter): Task[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter?.search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }
    if (filter?.group_name) {
      sql += ' AND group_name = ?';
      params.push(filter.group_name);
    }

    sql += ' ORDER BY created_at DESC';
    return this.queryAll(sql, params);
  }

  get(id: string): Task | null {
    const rows = this.queryAll('SELECT * FROM tasks WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  create(input: CreateTaskInput): Task {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    db.run(
      'INSERT INTO tasks (id, name, description, type, status, schedule, trigger_logic, tags, group_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, input.name, input.description || '', input.type, 'idle',
       JSON.stringify(input.schedule), input.trigger_logic || 'or',
       JSON.stringify(input.tags || []), input.group_name || '', now, now]
    );
    markDirty();
    return this.get(id)!;
  }

  update(id: string, input: UpdateTaskInput): Task | null {
    const existing = this.get(id);
    if (!existing) return null;

    const db = getDatabase();
    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) { fields.push('name = ?'); params.push(input.name); }
    if (input.description !== undefined) { fields.push('description = ?'); params.push(input.description); }
    if (input.type !== undefined) { fields.push('type = ?'); params.push(input.type); }
    if (input.status !== undefined) { fields.push('status = ?'); params.push(input.status); }
    if (input.schedule !== undefined) { fields.push('schedule = ?'); params.push(JSON.stringify(input.schedule)); }
    if (input.trigger_logic !== undefined) { fields.push('trigger_logic = ?'); params.push(input.trigger_logic); }
    if (input.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(input.tags)); }
    if (input.group_name !== undefined) { fields.push('group_name = ?'); params.push(input.group_name); }

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    db.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);
    markDirty();
    return this.get(id);
  }

  updateStats(id: string, stats: { total_runs: number; last_run_at: string; last_run_status: string }): void {
    const db = getDatabase();
    db.run('UPDATE tasks SET total_runs = ?, last_run_at = ?, last_run_status = ? WHERE id = ?',
      [stats.total_runs, stats.last_run_at, stats.last_run_status, id]);
    markDirty();
  }

  delete(id: string): void {
    const db = getDatabase();
    db.run('DELETE FROM tasks WHERE id = ?', [id]);
    markDirty();
  }

  private queryAll(sql: string, params: any[] = []): Task[] {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows: Task[] = [];
    while (stmt.step()) {
      rows.push(this.mapRow(stmt.getAsObject()));
    }
    stmt.free();
    return rows;
  }

  private mapRow(row: any): Task {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      status: row.status,
      schedule: JSON.parse(row.schedule || '{}'),
      trigger_logic: row.trigger_logic,
      tags: JSON.parse(row.tags || '[]'),
      group_name: row.group_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      total_runs: row.total_runs || 0,
      last_run_at: row.last_run_at,
      last_run_status: row.last_run_status,
    };
  }
}

export const taskRepo = new TaskRepository();