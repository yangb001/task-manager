import React from 'react';
import { useTheme } from '../stores/themeStore';
import { SchemaForm } from './SchemaForm';
import type { PluginInfo } from '../../shared/types';

interface TriggerConfigProps {
  plugin: PluginInfo;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export const TriggerConfig: React.FC<TriggerConfigProps> = ({ plugin, config, onChange }) => {
  const { theme } = useTheme();
  const schema = plugin.manifest.config_schema;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{plugin.manifest.icon || '⚡'}</span>
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
        <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>该触发器无需配置</div>
      )}
    </div>
  );
};
