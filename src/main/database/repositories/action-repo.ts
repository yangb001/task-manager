import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../connection';
import type { Action } from '../../../shared/types';

export class ActionRepository {
  listByTask(taskId: string): Action[] {
    return this.queryAll('SELECT * FROM actions WHERE task_id = ? ORDER BY sort_order', [taskId]);
  }

  get(id: string): Action | null {
    const rows = this.queryAll('SELECT * FROM actions WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  create(data: { task_id: string; type: string; name?: string; config: any; enabled?: boolean; continue_on_error?: boolean; sort_order?: number }): Action {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();
    db.run(
      'INSERT INTO actions (id, task_id, type, name, config, enabled, continue_on_error, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.task_id, data.type, data.name || '', JSON.stringify(data.config),
       data.enabled !== false ? 1 : 0, data.continue_on_error ? 1 : 0, data.sort_order || 0, now]
    );
    saveDatabase();
    return this.get(id)!;
  }

  delete(id: string): void {
    const db = getDatabase();
    db.run('DELETE FROM actions WHERE id = ?', [id]);
    saveDatabase();
  }

  deleteByTask(taskId: string): void {
    const db = getDatabase();
    db.run('DELETE FROM actions WHERE task_id = ?', [taskId]);
    saveDatabase();
  }

  private queryAll(sql: string, params: any[] = []): Action[] {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows: Action[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      rows.push({
        id: r.id,
        task_id: r.task_id,
        type: r.type,
        name: r.name,
        config: JSON.parse(r.config || '{}'),
        enabled: !!r.enabled,
        continue_on_error: !!r.continue_on_error,
        sort_order: r.sort_order,
        created_at: r.created_at,
      });
    }
    stmt.free();
    return rows;
  }
}

export const actionRepo = new ActionRepository();