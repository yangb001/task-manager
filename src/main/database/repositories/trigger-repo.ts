import { v4 as uuidv4 } from 'uuid';
import { getDatabase, markDirty } from '../connection';
import type { Trigger } from '../../../shared/types';

export class TriggerRepository {
  listByTask(taskId: string): Trigger[] {
    return this.queryAll('SELECT * FROM triggers WHERE task_id = ? ORDER BY sort_order', [taskId]);
  }

  get(id: string): Trigger | null {
    const rows = this.queryAll('SELECT * FROM triggers WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  create(data: { task_id: string; type: string; config: any; enabled?: boolean; sort_order?: number }): Trigger {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();
    db.run(
      'INSERT INTO triggers (id, task_id, type, config, enabled, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.task_id, data.type, JSON.stringify(data.config), data.enabled !== false ? 1 : 0, data.sort_order || 0, now]
    );
    markDirty();
    return this.get(id)!;
  }

  delete(id: string): void {
    const db = getDatabase();
    db.run('DELETE FROM triggers WHERE id = ?', [id]);
    markDirty();
  }

  deleteByTask(taskId: string): void {
    const db = getDatabase();
    db.run('DELETE FROM triggers WHERE task_id = ?', [taskId]);
    markDirty();
  }

  private queryAll(sql: string, params: any[] = []): Trigger[] {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows: Trigger[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      rows.push({
        id: r.id,
        task_id: r.task_id,
        type: r.type,
        config: JSON.parse(r.config || '{}'),
        enabled: !!r.enabled,
        sort_order: r.sort_order,
        created_at: r.created_at,
      });
    }
    stmt.free();
    return rows;
  }
}

export const triggerRepo = new TriggerRepository();