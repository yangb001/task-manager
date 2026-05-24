import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '../stores/themeStore';
import { useTaskStore } from '../stores/taskStore';
import { TaskFormModal } from './TaskFormModal';
import type { Task } from '../../shared/types';

interface TaskListPageProps {
  onNavigate: (page: 'tasks' | 'history' | 'plugins' | 'settings') => void;
}

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'running', label: '运行中' },
  { key: 'paused', label: '已暂停' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  idle: '#888',
  running: '#1ea7fd',
  paused: '#dba642',
  completed: '#2da44e',
  failed: '#cf222e',
};

const btnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 4, border: '1px solid #d0d0d0',
  background: 'transparent', color: '#666', fontSize: 12, cursor: 'pointer',
  fontWeight: 500, transition: 'all 0.1s',
};

const Btn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button style={btnStyle} onClick={onClick}>{label}</button>
);

export const TaskListPage: React.FC<TaskListPageProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const { tasks, loading, fetchTasks, setFilter, startTask, pauseTask, resumeTask, deleteTask, createTask, updateTask } = useTaskStore();
  const [activeTab, setActiveTab] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => { fetchTasks(); }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setFilter(key ? { status: key as any } : {});
  };

  const filteredTasks = useMemo(
    () => activeTab ? tasks.filter(t => t.status === activeTab) : tasks,
    [tasks, activeTab],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { '': tasks.length };
    for (const t of tasks) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  return (
    <>
      {/* Page Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: `1px solid ${theme.borderColor}`,
        background: theme.contentBg, minHeight: 44,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>任务列表</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              padding: '5px 14px', borderRadius: theme.borderRadius, border: 'none',
              background: theme.primaryColor, color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => { setEditingTask(null); setShowForm(true); }}
          >
            + 新建任务
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: 0 }}>
          {STATUS_TABS.map(tab => {
            const count = tabCounts[tab.key] || 0;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                style={{
                  padding: '6px 14px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 13, color: active ? theme.primaryColor : theme.textSecondary,
                  fontWeight: active ? 600 : 400,
                  borderBottom: active ? `2px solid ${theme.primaryColor}` : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.1s',
                }}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label} <span style={{ fontSize: 11, color: theme.textMuted }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Task List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: theme.textMuted }}>加载中...</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: theme.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div>暂无任务</div>
            <button
              style={{
                marginTop: 12, padding: '6px 16px', borderRadius: theme.borderRadius,
                border: 'none', background: theme.primaryColor, color: '#fff',
                fontSize: 12, cursor: 'pointer',
              }}
              onClick={() => { setEditingTask(null); setShowForm(true); }}
            >
              创建第一个任务
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Column Headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 120px',
              gap: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600,
              color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px',
            }}>
              <span>任务名称</span>
              <span>类型</span>
              <span>调度</span>
              <span>上次执行</span>
              <span style={{ textAlign: 'right' }}>操作</span>
            </div>

            {filteredTasks.map(task => (
              <div
                key={task.id}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 120px',
                  gap: 8, padding: '10px 12px', borderRadius: theme.borderRadius,
                  border: `1px solid ${theme.borderColor}`,
                  background: theme.cardBg,
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = theme.hoverBg; }}
                onMouseLeave={e => { e.currentTarget.style.background = theme.cardBg; }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: theme.textPrimary, marginBottom: 2 }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: 4,
                      background: STATUS_COLORS[task.status] || '#888',
                      marginRight: 8, verticalAlign: 'middle',
                    }} />
                    {task.name}
                  </div>
                  {task.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
                      {task.tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          background: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          color: theme.textMuted,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: theme.textSecondary }}>
                  {task.type === 'scheduled' ? '定时' : '单次'}
                </div>
                <div style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'monospace' }}>
                  {task.type === 'scheduled'
                    ? (task.schedule as any).cron || '-'
                    : (task.schedule as any).mode === 'immediate' ? '立即' : '定时'
                  }
                </div>
                <div style={{ fontSize: 12, color: theme.textSecondary }}>
                  {task.last_run_at
                    ? new Date(task.last_run_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '从未执行'}
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  {task.status === 'idle' && <Btn label="▶ 执行" onClick={() => startTask(task.id)} />}
                  {task.status === 'running' && <Btn label="⏸ 暂停" onClick={() => pauseTask(task.id)} />}
                  {task.status === 'paused' && <Btn label="▶ 恢复" onClick={() => resumeTask(task.id)} />}
                  <Btn label="✏" onClick={() => { setEditingTask(task); setShowForm(true); }} />
                  <Btn label="🗑" onClick={() => { if (confirm(`删除「${task.name}」？`)) deleteTask(task.id); }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskFormModal
        visible={showForm}
        editingTask={editingTask}
        onClose={() => { setShowForm(false); setEditingTask(null); }}
        onSave={async (data) => {
          if (editingTask) await updateTask(editingTask.id, data);
          else await createTask(data);
        }}
      />
    </>
  );
};