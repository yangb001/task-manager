import React, { useEffect, useState } from 'react';
import { useTheme } from '../stores/themeStore';
import type { ExecutionLog } from '../../shared/types';

interface ExecutionHistoryPageProps {
  onNavigate: (page: 'tasks' | 'history' | 'settings') => void;
}

const STATUS_COLORS: Record<string, string> = {
  success: '#2da44e',
  failed: '#cf222e',
  running: '#1ea7fd',
  cancelled: '#dba642',
};

export const ExecutionHistoryPage: React.FC<ExecutionHistoryPageProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await (window as any).taskManager.executionLogs.list({ limit: 50 });
        setLogs(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const s: Record<string, React.CSSProperties> = {
    th: { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: `1px solid ${theme.borderColor}` },
    td: { padding: '8px 12px', fontSize: 12, color: theme.textPrimary, borderBottom: `1px solid ${theme.borderColor}` },
    badge: { fontSize: 11, padding: '2px 8px', borderRadius: 3, fontWeight: 500 },
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: `1px solid ${theme.borderColor}`,
        background: theme.contentBg, minHeight: 44,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>执行历史</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: theme.textMuted }}>加载中...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: theme.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div>暂无执行记录</div>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={s.th}>任务</th>
                  <th style={s.th}>状态</th>
                  <th style={s.th}>开始时间</th>
                  <th style={s.th}>耗时</th>
                  <th style={s.th}>触发方式</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}
                    style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                    onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                    onMouseEnter={e => { e.currentTarget.style.background = theme.hoverBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={s.td}>{log.task_id}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: `${STATUS_COLORS[log.status] || '#888'}18`, color: STATUS_COLORS[log.status] || '#888' }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={s.td}>{new Date(log.started_at).toLocaleString('zh-CN')}</td>
                    <td style={s.td}>{log.finished_at ? `${Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s` : '-'}</td>
                    <td style={s.td}>{log.trigger_data?.type || 'manual'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedLog && (
              <div style={{ marginTop: 16, padding: 16, borderRadius: 6, border: `1px solid ${theme.borderColor}`, background: theme.cardBg }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary, marginBottom: 12 }}>执行详情</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>任务 ID</div><div style={{ fontSize: 12, color: theme.textPrimary }}>{selectedLog.task_id}</div></div>
                  <div><div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>状态</div><div><span style={{ ...s.badge, background: `${STATUS_COLORS[selectedLog.status] || '#888'}18`, color: STATUS_COLORS[selectedLog.status] || '#888' }}>{selectedLog.status}</span></div></div>
                  <div><div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>开始</div><div style={{ fontSize: 12, color: theme.textPrimary }}>{new Date(selectedLog.started_at).toLocaleString('zh-CN')}</div></div>
                  <div><div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>结束</div><div style={{ fontSize: 12, color: theme.textPrimary }}>{selectedLog.finished_at ? new Date(selectedLog.finished_at).toLocaleString('zh-CN') : '-'}</div></div>
                  <div><div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>触发方式</div><div style={{ fontSize: 12, color: theme.textPrimary }}>{selectedLog.trigger_data?.type || 'manual'}</div></div>
                  <div><div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>错误信息</div><div style={{ fontSize: 12, color: theme.textPrimary }}>{selectedLog.error_message || '-'}</div></div>
                </div>
                {selectedLog.variables_snapshot && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>变量快照</div>
                    <pre style={{ fontSize: 11, background: theme.mode === 'dark' ? 'rgba(0,0,0,0.3)' : '#f5f5f5', padding: 10, borderRadius: 4, overflow: 'auto', maxHeight: 200, fontFamily: 'monospace', color: theme.textSecondary, margin: 0 }}>
                      {JSON.stringify(selectedLog.variables_snapshot, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};