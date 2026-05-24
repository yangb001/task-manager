import React, { useState, useEffect } from 'react';
import { useTheme } from '../stores/themeStore';

interface SettingsPageProps {
  onNavigate: (page: 'tasks' | 'history' | 'plugins' | 'settings') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { theme, toggleMode, setPrimaryColor } = useTheme();
  const [welinkConfig, setWelinkConfig] = useState({ appKey: '', appSecret: '', baseUrl: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await (window as any).taskManager.settings.get('welink');
        if (cfg) setWelinkConfig(cfg);
      } catch {}
    })();
  }, []);

  const saveWelink = async () => {
    setSaving(true);
    try {
      await (window as any).taskManager.settings.set('welink', welinkConfig);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 4,
    border: `1px solid ${theme.borderColor}`, fontSize: 13, outline: 'none',
    boxSizing: 'border-box', background: theme.cardBg, color: theme.textPrimary,
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: `1px solid ${theme.borderColor}`,
        background: theme.contentBg, minHeight: 44,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>设置</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Appearance */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${theme.borderColor}` }}>
            外观
          </div>
          <div style={{ borderRadius: 6, border: `1px solid ${theme.borderColor}`, overflow: 'hidden' }}>
            <SettingRow theme={theme} label="主题模式" desc="切换亮色/暗色">
              <button
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: theme.mode === 'dark' ? theme.primaryColor : '#d0d0d0',
                  position: 'relative', transition: 'all 0.15s',
                }}
                onClick={toggleMode}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 9, background: '#fff',
                  position: 'absolute', top: 2,
                  left: theme.mode === 'dark' ? 20 : 2,
                  transition: 'all 0.15s',
                }} />
              </button>
            </SettingRow>
            <SettingRow theme={theme} label="主题色" desc="自定义主色调">
              <input type="color" style={{ width: 32, height: 24, padding: 0, border: 'none', cursor: 'pointer', background: 'transparent' }}
                value={theme.primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
            </SettingRow>
          </div>
        </div>

        {/* WeLink */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${theme.borderColor}` }}>
            WeLink 集成
          </div>
          <div style={{ borderRadius: 6, border: `1px solid ${theme.borderColor}`, padding: 16, background: theme.cardBg }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>App Key</label>
              <input style={inputStyle} value={welinkConfig.appKey} onChange={e => setWelinkConfig({ ...welinkConfig, appKey: e.target.value })} placeholder="WeLink 应用 AppKey" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>App Secret</label>
              <input style={inputStyle} type="password" value={welinkConfig.appSecret} onChange={e => setWelinkConfig({ ...welinkConfig, appSecret: e.target.value })} placeholder="WeLink 应用 AppSecret" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>API 地址</label>
              <input style={inputStyle} value={welinkConfig.baseUrl} onChange={e => setWelinkConfig({ ...welinkConfig, baseUrl: e.target.value })} placeholder="https://open.welink.huawei.com" />
            </div>
            <button
              style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: theme.primaryColor, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              onClick={saveWelink} disabled={saving}
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>

        {/* About */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${theme.borderColor}` }}>
            关于
          </div>
          <div style={{ borderRadius: 6, border: `1px solid ${theme.borderColor}`, overflow: 'hidden' }}>
            <SettingRow theme={theme} label="版本" desc="Task Manager">
              <span style={{ fontSize: 12, color: theme.textMuted }}>v0.1.0</span>
            </SettingRow>
            <SettingRow theme={theme} label="引擎状态" desc="任务调度引擎运行状态">
              <span style={{ fontSize: 12, color: '#2da44e', fontWeight: 500 }}>● 运行中</span>
            </SettingRow>
          </div>
        </div>
      </div>
    </>
  );
};

const SettingRow: React.FC<{ theme: any; label: string; desc: string; children: React.ReactNode }> = ({ theme, label, desc, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: `1px solid ${theme.borderColor}`,
    background: theme.cardBg,
  }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: theme.textPrimary }}>{label}</div>
      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{desc}</div>
    </div>
    {children}
  </div>
);