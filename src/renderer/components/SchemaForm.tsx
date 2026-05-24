import React from 'react';
import { useTheme, ThemeConfig } from '../stores/themeStore';

interface SchemaFormProps {
  schema: Record<string, any>;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  required?: string[];
}

export const SchemaForm: React.FC<SchemaFormProps> = ({ schema, value, onChange, required = [] }) => {
  const { theme } = useTheme();

  if (!schema || schema.type !== 'object' || !schema.properties) {
    return <div style={{ fontSize: 12, color: theme.textMuted }}>无可配置项</div>;
  }

  const properties = schema.properties as Record<string, any>;
  const requiredFields = schema.required || required;

  const updateField = (key: string, fieldValue: any) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
      {Object.entries(properties).map(([key, prop]) => (
        <SchemaField
          key={key}
          name={key}
          schema={prop}
          value={value?.[key]}
          onChange={(v) => updateField(key, v)}
          required={requiredFields.includes(key)}
          theme={theme}
        />
      ))}
    </div>
  );
};

interface SchemaFieldProps {
  name: string;
  schema: Record<string, any>;
  value: any;
  onChange: (value: any) => void;
  required: boolean;
  theme: ThemeConfig;
}

const SchemaField: React.FC<SchemaFieldProps> = ({ name, schema, value, onChange, required, theme }) => {
  const title = schema.title || name;
  const description = schema.description || '';
  const defaultValue = schema.default;

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: theme.textSecondary, marginBottom: 4, display: 'block',
  };
  const descStyle: React.CSSProperties = {
    fontSize: 11, color: theme.textMuted, marginTop: 2,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 4,
    border: `1px solid ${theme.borderColor}`, fontSize: 13, outline: 'none',
    boxSizing: 'border-box', background: theme.cardBg, color: theme.textPrimary,
  };

  // enum → select
  if (schema.enum) {
    return (
      <div>
        <label style={labelStyle}>
          {title}{required && <span style={{ color: '#cf222e' }}> *</span>}
        </label>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={value ?? defaultValue ?? ''}
          onChange={e => onChange(e.target.value)}
        >
          {!required && <option value="">--</option>}
          {schema.enum.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {description && <div style={descStyle}>{description}</div>}
      </div>
    );
  }

  // number
  if (schema.type === 'number' || schema.type === 'integer') {
    return (
      <div>
        <label style={labelStyle}>
          {title}{required && <span style={{ color: '#cf222e' }}> *</span>}
        </label>
        <input
          type="number"
          style={inputStyle}
          value={value ?? defaultValue ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          min={schema.minimum}
          max={schema.maximum}
          step={schema.type === 'integer' ? 1 : 'any'}
          placeholder={defaultValue !== undefined ? String(defaultValue) : ''}
        />
        {description && <div style={descStyle}>{description}</div>}
      </div>
    );
  }

  // boolean
  if (schema.type === 'boolean') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={value ?? defaultValue ?? false}
          onChange={e => onChange(e.target.checked)}
        />
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          {title}{required && <span style={{ color: '#cf222e' }}> *</span>}
        </label>
        {description && <span style={descStyle}>{description}</span>}
      </div>
    );
  }

  // object (nested)
  if (schema.type === 'object' && schema.properties) {
    const nestedProps = schema.properties as Record<string, any>;
    const entries = Object.entries(nestedProps);
    return (
      <div style={{ padding: '8px 12px', borderRadius: 4, border: `1px solid ${theme.borderColor}`, background: theme.mode === 'dark' ? 'rgba(0,0,0,0.15)' : '#fafafa' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 8 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {entries.map(([subKey, subSchema]) => (
            <SchemaField
              key={subKey}
              name={subKey}
              schema={subSchema}
              value={value?.[subKey]}
              onChange={(v) => onChange({ ...(value || {}), [subKey]: v })}
              required={(schema.required || []).includes(subKey)}
              theme={theme}
            />
          ))}
        </div>
        {description && <div style={descStyle}>{description}</div>}
      </div>
    );
  }

  // string (default) — textarea or text
  const isTextarea = schema.format === 'textarea' || (value?.length > 100);
  return (
    <div>
      <label style={labelStyle}>
        {title}{required && <span style={{ color: '#cf222e' }}> *</span>}
      </label>
      {isTextarea ? (
        <textarea
          style={{ ...inputStyle, resize: 'vertical' as const, minHeight: 60, fontFamily: 'inherit' }}
          value={value ?? defaultValue ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={description || defaultValue}
          rows={3}
        />
      ) : (
        <input
          type="text"
          style={inputStyle}
          value={value ?? defaultValue ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={description || (defaultValue !== undefined ? String(defaultValue) : '')}
        />
      )}
      {description && !isTextarea && <div style={descStyle}>{description}</div>}
    </div>
  );
};
