import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '../stores/themeStore';
import { VirtualList } from '../components/VirtualList';
import type { ExecutionLog } from '../../shared/types';

interface ExecutionHistoryPageProps {
  onNavigate: (page: 'tasks' | 'history' | 'plugins' | 'settings') => void;
}

const STATUS_COLORS: Record<string, string> = {
  success: '#2da44e',
  failed: '#cf222e',
  running: '#1ea7fd',
  cancelled: '#dba642',
};

const ROW_HEIGHT = 40;

export const ExecutionHistoryPage: React.FC<ExecutionHistoryPageProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await (window as any).taskManager.history.list();
        setLogs(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const s: Record<string, React.CSSProperties> = {
    th: { textAlign: 'left' as const, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.3px', borderBottom: `1px solid ${theme.borderColor}` },
    td: { padding: '8px 12px', fontSize: 12, color: theme.textPrimary, borderBottom: `1px solid ${theme.borderColor}`, display: 'flex', alignItems: 'center' },
    badge: { fontSize: 11, padding: '2px 8px', borderRadius: 3, fontWeight: 500 },
  };

  const gridCols = '2fr 1fr 2fr 1fr 1fr';

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: `1px solid ${theme.borderColor}`,
        background: theme.contentBg, minHeight: 44,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>执行历史</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: theme.textMuted }}>加载中...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: theme.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div>暂无执行记录</div>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: `1px solid ${theme.borderColor}`, flexShrink: 0 }}>
              <div style={s.th}>任务</div>
              <div style={s.th}>状态</div>
              <div style={s.th}>开始时间</div>
              <div style={s.th}>耗时</div>
              <div style={s.th}>触发方式</div>
            </div>

            {/* Virtual Scrolling Body */}
            <VirtualList
              items={logs}
              itemHeight={ROW_HEIGHT}
              style={{ flex: 1 }}
              renderItem={(log) => (
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: gridCols,
                    cursor: 'pointer', transition: 'background 0.1s',
                    borderBottom: `1px solid ${theme.borderColor}`,
                    background: selectedLog?.id === log.id ? theme.hoverBg : 'transparent',
                    height: ROW_HEIGHT,
                  }}
                  onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                  onMouseEnter={e => { e.currentTarget.style.background = theme.hoverBg; }}
                  onMouseLeave={e => { if (selectedLog?.id !== log.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={s.td}>{log.task_id}</div>
                  <div style={s.td}>
                    <span style={{ ...s.badge, background: `${STATUS_COLORS[log.status] || '#888'}18`, color: STATUS_COLORS[log.status] || '#888' }}>
                      {log.status}
                    </span>
                  </div>
                  <div style={s.td}>{new Date(log.started_at).toLocaleString('zh-CN')}</div>
                  <div style={s.td}>{log.finished_at ? `${Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s` : '-'}</div>
                  <div style={s.td}>{log.trigger_data?.type || 'manual'}</div>
                </div>
              )}
            />

            {/* Detail Panel */}
            {selectedLog && (
              <div style={{ padding: 16, borderTop: `1px solid ${theme.borderColor}`, background: theme.cardBg, flexShrink: 0, maxHeight: 240, overflow: 'auto' }}>
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
                    <pre style={{ fontSize: 11, background: theme.mode === 'dark' ? 'rgba(0,0,0,0.3)' : '#f5f5f5', padding: 10, borderRadius: 4, overflow: 'auto', maxHeight: 120, fontFamily: 'monospace', color: theme.textSecondary, margin: 0 }}>
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
