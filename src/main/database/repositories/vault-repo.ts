import { getDatabase, saveDatabase } from '../connection';

export class VaultRepository {
  get(key: string): any {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value FROM vault WHERE key = ?');
    stmt.bind([key]);
    if (stmt.step()) {
      const r = stmt.getAsObject();
      stmt.free();
      try { return JSON.parse(r.value); } catch { return r.value; }
    }
    stmt.free();
    return null;
  }

  set(key: string, value: any): void {
    const db = getDatabase();
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    db.run(
      'INSERT OR REPLACE INTO vault (key, value, updated_at) VALUES (?, ?, ?)',
      [key, str, new Date().toISOString()]
    );
    saveDatabase();
  }

  delete(key: string): void {
    const db = getDatabase();
    db.run('DELETE FROM vault WHERE key = ?', [key]);
    saveDatabase();
  }
}

export const vaultRepo = new VaultRepository();