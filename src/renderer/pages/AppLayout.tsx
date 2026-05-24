import React, { useState } from 'react';
import { useTheme } from '../stores/themeStore';
import { TaskListPage } from './TaskListPage';
import { ExecutionHistoryPage } from './ExecutionHistoryPage';
import { SettingsPage } from './SettingsPage';

type Page = 'tasks' | 'history' | 'settings';

const NAV_ITEMS: { key: Page; label: string; icon: string }[] = [
  { key: 'tasks', label: '任务列表', icon: '📋' },
  { key: 'history', label: '执行历史', icon: '📊' },
  { key: 'settings', label: '设置', icon: '⚙️' },
];

export const AppLayout: React.FC = () => {
  const { theme, toggleMode } = useTheme();
  const [page, setPage] = useState<Page>('tasks');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const s: Record<string, React.CSSProperties> = {
    root: {
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: theme.fontFamily,
      fontSize: 13,
      color: theme.textPrimary,
      background: theme.contentBg,
      userSelect: 'none',
    },
    titlebar: {
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 32,
      background: theme.headerBg,
      borderBottom: `1px solid ${theme.borderColor}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      // @ts-ignore
      WebkitAppRegion: 'drag' as any,
      zIndex: 100,
      fontSize: 12,
      color: theme.textSecondary,
    },
    titlebarTitle: {
      fontWeight: 600,
      color: theme.textPrimary,
      marginRight: 8,
    },
    sidebar: {
      width: sidebarCollapsed ? 48 : 200,
      minWidth: sidebarCollapsed ? 48 : 200,
      background: theme.sidebarBg,
      borderRight: `1px solid ${theme.borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 32,
      transition: 'width 0.15s ease',
      overflow: 'hidden',
    },
    sidebarHeader: {
      padding: '16px 16px 12px',
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      color: theme.textMuted,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
    },
    navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', margin: '1px 8px', borderRadius: theme.borderRadius, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', transition: 'all 0.1s' },
    navIcon: {
      fontSize: 16,
      width: 20,
      textAlign: 'center' as const,
      flexShrink: 0,
    },
    sidebarBottom: {
      marginTop: 'auto',
      borderTop: `1px solid ${theme.borderColor}`,
      padding: '8px 8px',
    },
    content: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 32,
      overflow: 'hidden',
    },
    pageHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      borderBottom: `1px solid ${theme.borderColor}`,
      background: theme.contentBg,
      minHeight: 44,
    },
    pageTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: theme.textPrimary,
    },
    pageActions: {
      display: 'flex',
      gap: 6,
    },
    pageBody: {
      flex: 1,
      overflow: 'auto',
      padding: 16,
    },
    iconBtn: {
      width: 28,
      height: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      fontSize: 14,
      color: theme.textSecondary,
    },
  };

  const renderPage = () => {
    const commonProps = { onNavigate: setPage };
    switch (page) {
      case 'tasks': return <TaskListPage {...commonProps} />;
      case 'history': return <ExecutionHistoryPage {...commonProps} />;
      case 'settings': return <SettingsPage {...commonProps} />;
    }
  };

  return (
    <div style={s.root}>
      {/* Title Bar */}
      <div style={s.titlebar}>
        <span style={s.titlebarTitle}>Task Manager</span>
        <span style={{ fontSize: 11 }}>v0.1.0</span>
      </div>

      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          {sidebarCollapsed ? '' : '导航'}
        </div>
        {NAV_ITEMS.map(item => {
          const active = page === item.key;
          return (
            <div
              key={item.key}
              style={{ ...s.navItem, color: active ? theme.primaryColor : theme.textSecondary, background: active ? (theme.mode === 'dark' ? 'rgba(96,205,255,0.1)' : 'rgba(0,120,212,0.08)') : 'transparent', fontWeight: active ? 600 : 400 }}
              onClick={() => setPage(item.key)}
            >
              <span style={s.navIcon}>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </div>
          );
        })}
        <div style={s.sidebarBottom}>
          <div
            style={s.navItem}
            onClick={toggleMode}
          >
            <span style={s.navIcon}>{theme.mode === 'light' ? '🌙' : '☀️'}</span>
            {!sidebarCollapsed && <span>{theme.mode === 'light' ? '暗色模式' : '亮色模式'}</span>}
          </div>
          <div
            style={s.navItem}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <span style={s.navIcon}>{sidebarCollapsed ? '▶' : '◀'}</span>
            {!sidebarCollapsed && <span>收起侧栏</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {renderPage()}
      </div>
    </div>
  );
};