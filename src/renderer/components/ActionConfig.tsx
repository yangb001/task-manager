import React from 'react';
import { useTheme } from '../stores/themeStore';
import { SchemaForm } from './SchemaForm';
import type { PluginInfo } from '../../shared/types';

interface ActionConfigProps {
  plugin: PluginInfo;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  outputVar?: string;
  onOutputVarChange?: (v: string) => void;
  continueOnError?: boolean;
  onContinueOnErrorChange?: (v: boolean) => void;
}

export const ActionConfig: React.FC<ActionConfigProps> = ({
  plugin, config, onChange, outputVar, onOutputVarChange, continueOnError, onContinueOnErrorChange,
}) => {
  const { theme } = useTheme();
  const schema = plugin.manifest.config_schema;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 4,
    border: `1px solid ${theme.borderColor}`, fontSize: 13, outline: 'none',
    boxSizing: 'border-box' as const, background: theme.cardBg, color: theme.textPrimary,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{plugin.manifest.icon || '⚙️'}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>{plugin.manifest.name}</div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>{plugin.manifest.description}</div>
        </div>
      </div>

      {schema?.properties && Object.keys(schema.properties).length > 0 ? (
        <SchemaForm
          schema={schema}
          value={config}
          onChange={onChange}
        />
      ) : (
        <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>该动作无需配置</div>
      )}

      {/* 额外字段 */}
      <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 4, border: `1px solid ${theme.borderColor}`, background: theme.mode === 'dark' ? 'rgba(0,0,0,0.15)' : '#fafafa' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 8 }}>执行选项</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>输出变量名</label>
            <input
              type="text"
              style={inputStyle}
              value={outputVar || ''}
              onChange={e => onOutputVarChange?.(e.target.value)}
              placeholder="如 api_response，后续可通过 {{steps.api_response}} 引用"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={continueOnError || false}
              onChange={e => onContinueOnErrorChange?.(e.target.checked)}
            />
            <label style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 0 }}>失败时继续执行后续动作</label>
          </div>
        </div>
      </div>
    </div>
  );
};
