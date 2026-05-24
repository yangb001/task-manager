import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../stores/themeStore';
import type { PluginInfo } from '../../shared/types';

interface PluginWithStats extends PluginInfo {
  usageCount: number;
  usedByTasks: { id: string; name: string }[];
}

interface PluginManagePageProps {
  onNavigate: (page: 'tasks' | 'history' | 'settings' | 'plugins') => void;
}

export const PluginManagePage: React.FC<PluginManagePageProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const [tab, setTab] = useState<'trigger' | 'action'>('trigger');
  const [plugins, setPlugins] = useState<PluginWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const data = await (window as any).taskManager.plugins.listAll();
      setPlugins(data || []);
    } catch (err) {
      console.error('Failed to load plugins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlugins(); }, []);

  const filtered = useMemo(() => {
    return plugins.filter(p => p.manifest.type === tab);
  }, [plugins, tab]);

  const tabCounts = useMemo(() => ({
    trigger: plugins.filter(p => p.manifest.type === 'trigger').length,
    action: plugins.filter(p => p.manifest.type === 'action').length,
  }), [plugins]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await (window as any).taskManager.plugins.scanUser();
      await loadPlugins();
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    if (!confirm(`确定要卸载插件 "${pluginId}" 吗？此操作不可恢复。`)) return;
    try {
      await (window as any).taskManager.plugins.uninstall(pluginId);
      await loadPlugins();
    } catch (err) {
      console.error('Uninstall failed:', err);
    }
  };

  const cardBg = theme.cardBg;
  const borderColor = theme.borderColor;

  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: `1px solid ${borderColor}`,
        background: theme.contentBg, minHeight: 44,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>插件管理</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              padding: '5px 14px', borderRadius: 4, border: `1px solid ${borderColor}`,
              background: cardBg, color: theme.textPrimary, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? '扫描中...' : '扫描插件'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, padding: '0 24px',
        borderBottom: `1px solid ${borderColor}`, background: theme.contentBg,
      }}>
        {(['trigger', 'action'] as const).map(t => {
          const active = tab === t;
          return (
            <div
              key={t}
              onClick={() => { setTab(t); setExpandedId(null); }}
              style={{
                padding: '10px 16px', fontSize: 13, cursor: 'pointer',
                color: active ? theme.primaryColor : theme.textSecondary,
                fontWeight: active ? 600 : 400,
                borderBottom: active ? `2px solid ${theme.primaryColor}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {t === 'trigger' ? '触发器' : '动作'} ({tabCounts[t]})
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 13 }}>加载中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 13 }}>
            暂无{tab === 'trigger' ? '触发器' : '动作'}插件
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(plugin => {
              const key = plugin.manifest.id;
              const expanded = expandedId === key;
              return (
                <div
                  key={key}
                  style={{
                    borderRadius: 6, border: `1px solid ${borderColor}`,
                    background: cardBg, overflow: 'hidden',
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', cursor: 'pointer',
                    }}
                    onClick={() => setExpandedId(expanded ? null : key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{plugin.manifest.icon || (tab === 'trigger' ? '⚡' : '⚙️')}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>{plugin.manifest.name}</span>
                          <span style={{ fontSize: 11, color: theme.textMuted }}>v{plugin.manifest.version}</span>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 3,
                            background: plugin.source === 'builtin'
                              ? (theme.mode === 'dark' ? 'rgba(96,205,255,0.15)' : 'rgba(0,120,212,0.1)')
                              : (theme.mode === 'dark' ? 'rgba(255,180,0,0.15)' : 'rgba(200,120,0,0.1)'),
                            color: plugin.source === 'builtin' ? theme.primaryColor : '#b45309',
                          }}>
                            {plugin.source === 'builtin' ? '系统内置' : '用户插件'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {plugin.manifest.description}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 12 }}>
                      {plugin.manifest.category && (
                        <span style={{ fontSize: 11, color: theme.textMuted }}>{plugin.manifest.category}</span>
                      )}
                      <span style={{
                        fontSize: 11, color: plugin.usageCount > 0 ? theme.primaryColor : theme.textMuted,
                        fontWeight: plugin.usageCount > 0 ? 500 : 400,
                      }}>
                        {plugin.usageCount > 0 ? `使用中: ${plugin.usageCount} 个任务` : '未使用'}
                      </span>
                      <span style={{ fontSize: 12, color: theme.textMuted, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div style={{
                      borderTop: `1px solid ${borderColor}`,
                      padding: '12px 16px',
                      background: theme.mode === 'dark' ? 'rgba(0,0,0,0.1)' : '#f9f9f9',
                    }}>
                      {/* Description */}
                      {plugin.manifest.description && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>描述</div>
                          <div style={{ fontSize: 12, color: theme.textPrimary }}>{plugin.manifest.description}</div>
                        </div>
                      )}

                      {/* Permissions */}
                      {plugin.manifest.permissions && plugin.manifest.permissions.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>权限</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {plugin.manifest.permissions.map(perm => (
                              <span key={perm} style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 3,
                                background: theme.mode === 'dark' ? 'rgba(255,100,100,0.15)' : 'rgba(200,0,0,0.08)',
                                color: theme.mode === 'dark' ? '#f87171' : '#b91c1c',
                              }}>
                                {perm}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Config Schema preview */}
                      {plugin.manifest.config_schema?.properties && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>配置 Schema</div>
                          <pre style={{
                            fontSize: 11, color: theme.textPrimary, margin: 0,
                            padding: '8px 12px', borderRadius: 4,
                            background: theme.mode === 'dark' ? 'rgba(0,0,0,0.2)' : '#fff',
                            border: `1px solid ${borderColor}`,
                            overflow: 'auto', maxHeight: 200,
                            fontFamily: 'Consolas, Monaco, monospace',
                          }}>
                            {JSON.stringify(plugin.manifest.config_schema, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Used by tasks */}
                      {plugin.usedByTasks.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>关联任务</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {plugin.usedByTasks.map(task => (
                              <div
                                key={task.id}
                                style={{
                                  fontSize: 12, color: theme.primaryColor, cursor: 'pointer',
                                  padding: '4px 8px', borderRadius: 4,
                                  background: theme.mode === 'dark' ? 'rgba(96,205,255,0.08)' : 'rgba(0,120,212,0.05)',
                                }}
                                onClick={() => onNavigate('tasks')}
                              >
                                {task.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {plugin.source === 'user' && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            style={{
                              padding: '5px 14px', borderRadius: 4, border: '1px solid #cf222e',
                              background: 'transparent', color: '#cf222e', fontSize: 12, cursor: 'pointer',
                            }}
                            onClick={(e) => { e.stopPropagation(); handleUninstall(key); }}
                          >
                            卸载插件
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
