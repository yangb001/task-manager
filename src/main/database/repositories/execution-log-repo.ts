import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../connection';
import type { ExecutionLog, ActionLog } from '../../../shared/types';

export class ExecutionLogRepository {
  list(filter?: { task_id?: string; status?: string; limit?: number; offset?: number }): ExecutionLog[] {
    let sql = 'SELECT * FROM execution_logs WHERE 1=1';
    const params: any[] = [];

    if (filter?.task_id) { sql += ' AND task_id = ?'; params.push(filter.task_id); }
    if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status); }

    sql += ' ORDER BY started_at DESC';
    if (filter?.limit) sql += ` LIMIT ${filter.limit}`;
    if (filter?.offset) sql += ` OFFSET ${filter.offset}`;

    return this.queryAll(sql, params);
  }

  get(id: string): ExecutionLog | null {
    const rows = this.queryAll('SELECT * FROM execution_logs WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  create(data: {
    task_id: string; trigger_id?: string; trigger_data?: any;
    status: string; started_at: string;
  }): ExecutionLog {
    const db = getDatabase();
    const id = uuidv4();
    db.run(
      'INSERT INTO execution_logs (id, task_id, trigger_id, trigger_data, status, started_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.task_id, data.trigger_id || null,
       data.trigger_data ? JSON.stringify(data.trigger_data) : null,
       data.status, data.started_at]
    );
    saveDatabase();
    return this.get(id)!;
  }

  update(id: string, data: Partial<{
    status: string; finished_at: string; duration_ms: number;
    error_message: string; variables_snapshot: any;
    action_count: number; success_count: number; failed_count: number;
  }>): void {
    const db = getDatabase();
    const fields: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.finished_at !== undefined) { fields.push('finished_at = ?'); params.push(data.finished_at); }
    if (data.duration_ms !== undefined) { fields.push('duration_ms = ?'); params.push(data.duration_ms); }
    if (data.error_message !== undefined) { fields.push('error_message = ?'); params.push(data.error_message); }
    if (data.variables_snapshot !== undefined) { fields.push('variables_snapshot = ?'); params.push(JSON.stringify(data.variables_snapshot)); }
    if (data.action_count !== undefined) { fields.push('action_count = ?'); params.push(data.action_count); }
    if (data.success_count !== undefined) { fields.push('success_count = ?'); params.push(data.success_count); }
    if (data.failed_count !== undefined) { fields.push('failed_count = ?'); params.push(data.failed_count); }

    if (fields.length === 0) return;
    params.push(id);
    db.run(`UPDATE execution_logs SET ${fields.join(', ')} WHERE id = ?`, params);
    saveDatabase();
  }

  private queryAll(sql: string, params: any[] = []): ExecutionLog[] {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows: ExecutionLog[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      rows.push({
        id: r.id,
        task_id: r.task_id,
        trigger_id: r.trigger_id,
        trigger_data: r.trigger_data ? JSON.parse(r.trigger_data) : null,
        status: r.status,
        started_at: r.started_at,
        finished_at: r.finished_at,
        duration_ms: r.duration_ms,
        error_message: r.error_message,
        variables_snapshot: r.variables_snapshot ? JSON.parse(r.variables_snapshot) : null,
        action_count: r.action_count || 0,
        success_count: r.success_count || 0,
        failed_count: r.failed_count || 0,
      });
    }
    stmt.free();
    return rows;
  }
}

export const executionLogRepo = new ExecutionLogRepository();