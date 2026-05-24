import React, { useState, useEffect } from 'react';
import type { Task, OneShotSchedule, CronSchedule, PluginInfo } from '../../shared/types';
import { TriggerConfig } from '../components/TriggerConfig';
import { ActionConfig } from '../components/ActionConfig';

export interface TaskFormData {
  name: string;
  description: string;
  tags: string[];
  group_name: string;
  type: 'one_shot' | 'scheduled';
  schedule: OneShotSchedule | CronSchedule;
  trigger_logic: 'or' | 'and';
  triggers: { type: string; config: Record<string, any> }[];
  actions: { type: string; name: string; config: Record<string, any>; output_var?: string; continue_on_error?: boolean }[];
  timeout_sec: number;
  max_retries: number;
  retry_delay_sec: number;
}

const emptyForm: TaskFormData = {
  name: '', description: '', tags: [], group_name: '',
  type: 'one_shot', schedule: { mode: 'immediate' },
  trigger_logic: 'or', triggers: [], actions: [],
  timeout_sec: 300, max_retries: 0, retry_delay_sec: 60,
};

interface TaskFormModalProps {
  visible: boolean;
  editingTask?: Task | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

const s = {
  overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 16, width: 720, maxHeight: '85vh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  header: { padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 600, color: '#333' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', padding: '4px 8px', borderRadius: 6 },
  body: { flex: 1, overflow: 'auto', padding: '20px 24px' },
  label: { fontSize: 14, fontWeight: 500, color: '#555', marginBottom: 6, display: 'block' as const },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d9d9d9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d9d9d9', fontSize: 14, outline: 'none', resize: 'vertical' as const, minHeight: 80, boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  formGroup: { marginBottom: 16 },
  btn: { padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#666', border: '1px solid #d9d9d9' },
  card: { padding: 16, borderRadius: 10, border: '1px solid #f0f0f0', marginBottom: 12, background: '#fafafa' },
  radio: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 },
  addBtn: { padding: '8px 16px', borderRadius: 8, border: '1px dashed #1677ff', background: 'transparent', color: '#1677ff', fontSize: 13, cursor: 'pointer' },
  deleteBtn: { padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fff1f0', color: '#ff4d4f', fontSize: 12, cursor: 'pointer' },
  select: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d9d9d9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, cursor: 'pointer', background: '#fff' },
};

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ visible, editingTask, onClose, onSave }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<TaskFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState('');
  const [triggerPlugins, setTriggerPlugins] = useState<PluginInfo[]>([]);
  const [actionPlugins, setActionPlugins] = useState<PluginInfo[]>([]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const [triggers, actions] = await Promise.all([
          (window as any).taskManager.plugins.listTriggers(),
          (window as any).taskManager.plugins.listActions(),
        ]);
        setTriggerPlugins(triggers || []);
        setActionPlugins(actions || []);
      } catch (err) {
        console.error('加载插件列表失败', err);
      }
    })();
  }, [visible]);

  useEffect(() => {
    if (editingTask) {
      setForm({
        name: editingTask.name, description: editingTask.description,
        tags: editingTask.tags, group_name: editingTask.group_name,
        type: editingTask.type, schedule: editingTask.schedule,
        trigger_logic: editingTask.trigger_logic, triggers: [], actions: [],
        timeout_sec: 300, max_retries: 0, retry_delay_sec: 60,
      });
    } else { setForm(emptyForm); }
    setStep(1);
    setError('');
  }, [editingTask, visible]);

  const update = (p: Partial<TaskFormData>) => setForm(prev => ({ ...prev, ...p }));
  const addTag = () => {
    const t = newTag.trim();
    if (t && !form.tags.includes(t)) { update({ tags: [...form.tags, t] }); setNewTag(''); }
  };

  const getPluginById = (id: string, list: PluginInfo[]) => list.find(p => p.manifest.id === id);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try { await onSave(form); onClose(); }
    catch (err: any) { setError(err.message || '保存失败'); }
    finally { setSaving(false); }
  };

  if (!visible) return null;

  const StepDot = ({ n, active, done }: { n: number; active: boolean; done: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, background: active ? '#1677ff' : done ? '#52c41a' : '#f0f0f0', color: active || done ? '#fff' : '#999' }}>{n}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{n === 1 ? '基本信息' : n === 2 ? '调度与触发' : '动作与输出'}</div>
    </div>
  );
  const StepLine = ({ done }: { done: boolean }) => <div style={{ flex: 1, height: 2, background: done ? '#52c41a' : '#f0f0f0', margin: '0 4px' }} />;

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>{editingTask ? '编辑任务' : '新建任务'}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', padding: '20px 24px 0', gap: 8, alignItems: 'center' }}>
          <StepDot n={1} active={step === 1} done={step > 1} />
          <StepLine done={step > 1} />
          <StepDot n={2} active={step === 2} done={step > 2} />
          <StepLine done={step > 2} />
          <StepDot n={3} active={step === 3} done={step > 3} />
        </div>
        <div style={s.body}>
          {/* Step 1: 基本信息 */}
          {step === 1 && (
            <div>
              <div style={s.formGroup}>
                <label style={s.label}>任务名称 *</label>
                <input style={s.input} value={form.name} onChange={e => update({ name: e.target.value })} placeholder="输入任务名称" autoFocus />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>描述</label>
                <textarea style={s.textarea} value={form.description} onChange={e => update({ description: e.target.value })} placeholder="任务描述（可选）" />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>标签</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {form.tags.map(tag => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: '#f0f5ff', color: '#1677ff', fontSize: 13 }}>
                      {tag}
                      <span style={{ cursor: 'pointer', marginLeft: 2 }} onClick={() => update({ tags: form.tags.filter(t => t !== tag) })}>✕</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...s.input, flex: 1 }} value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="输入标签" />
                  <button style={{ ...s.btn, ...s.btnGhost, padding: '10px 16px' }} onClick={addTag}>添加</button>
                </div>
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>分组</label>
                <input style={s.input} value={form.group_name} onChange={e => update({ group_name: e.target.value })} placeholder="分组名称（可选）" />
              </div>
            </div>
          )}

          {/* Step 2: 调度与触发 */}
          {step === 2 && (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                {(['one_shot', 'scheduled'] as const).map(t => (
                  <div key={t} style={{ ...s.card, flex: 1, cursor: 'pointer', borderColor: form.type === t ? '#1677ff' : '#f0f0f0', background: form.type === t ? '#f0f5ff' : '#fafafa' }}
                    onClick={() => update({ type: t, schedule: t === 'one_shot' ? { mode: 'immediate' } : { cron: '0 9 * * *', max_executions: 0 } })}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{t === 'one_shot' ? '📅' : '🔄'}</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t === 'one_shot' ? '单次任务' : '定时任务'}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{t === 'one_shot' ? '立即执行或指定时间' : 'Cron 表达式周期执行'}</div>
                  </div>
                ))}
              </div>
              {form.type === 'one_shot' ? (
                <div style={s.card}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <label style={s.radio}><input type="radio" checked={(form.schedule as OneShotSchedule).mode === 'immediate'} onChange={() => update({ schedule: { mode: 'immediate' } })} /> 立即执行</label>
                    <label style={s.radio}><input type="radio" checked={(form.schedule as OneShotSchedule).mode === 'scheduled'} onChange={() => update({ schedule: { mode: 'scheduled', execute_at: new Date(Date.now() + 3600000).toISOString().slice(0, 16) } })} /> 指定时间</label>
                  </div>
                  {(form.schedule as OneShotSchedule).mode === 'scheduled' && (
                    <input type="datetime-local" style={s.input} value={((form.schedule as OneShotSchedule).execute_at || '').slice(0, 16)} onChange={e => update({ schedule: { mode: 'scheduled', execute_at: e.target.value } })} />
                  )}
                </div>
              ) : (
                <div style={s.card}>
                  <div style={s.formGroup}>
                    <label style={s.label}>Cron 表达式</label>
                    <input style={{ ...s.input, fontFamily: 'monospace' }} value={(form.schedule as CronSchedule).cron || ''} onChange={e => update({ schedule: { ...form.schedule, cron: e.target.value } })} placeholder="0 9 * * 1-5" />
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>格式: 分 时 日 月 周 · 例如 "0 9 * * 1-5" = 工作日 09:00</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label style={s.label}>开始时间</label><input type="datetime-local" style={s.input} value={((form.schedule as CronSchedule).start_at || '').slice(0, 16)} onChange={e => update({ schedule: { ...form.schedule, start_at: e.target.value || undefined } })} /></div>
                    <div style={{ flex: 1 }}><label style={s.label}>结束时间（可选）</label><input type="datetime-local" style={s.input} value={((form.schedule as CronSchedule).end_at || '').slice(0, 16)} onChange={e => update({ schedule: { ...form.schedule, end_at: e.target.value || undefined } })} /></div>
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>最大执行次数（0=不限）</label>
                    <input type="number" style={s.input} value={(form.schedule as CronSchedule).max_executions || 0} onChange={e => update({ schedule: { ...form.schedule, max_executions: parseInt(e.target.value) || 0 } })} min={0} />
                  </div>
                </div>
              )}

              {/* 触发器配置 */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, color: '#333' }}>触发器</span>
                  <label style={s.radio}><input type="radio" checked={form.trigger_logic === 'or'} onChange={() => update({ trigger_logic: 'or' })} /> OR（任一触发）</label>
                  <label style={s.radio}><input type="radio" checked={form.trigger_logic === 'and'} onChange={() => update({ trigger_logic: 'and' })} /> AND（全部触发）</label>
                </div>
                {form.triggers.map((tr, i) => {
                  const plugin = getPluginById(tr.type, triggerPlugins);
                  return (
                    <div key={i} style={s.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{plugin?.manifest.icon || '⚡'} {plugin?.manifest.name || tr.type}</span>
                        <button style={s.deleteBtn} onClick={() => update({ triggers: form.triggers.filter((_, j) => j !== i) })}>删除</button>
                      </div>
                      {plugin ? (
                        <TriggerConfig
                          plugin={plugin}
                          config={tr.config}
                          onChange={(config) => {
                            const triggers = [...form.triggers];
                            triggers[i] = { ...triggers[i], config };
                            update({ triggers });
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: 13, color: '#888' }}>配置: {JSON.stringify(tr.config)}</div>
                      )}
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    style={{ ...s.select, flex: 1 }}
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        update({ triggers: [...form.triggers, { type: e.target.value, config: {} }] });
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">+ 添加触发器...</option>
                    {triggerPlugins.map(p => (
                      <option key={p.manifest.id} value={p.manifest.id}>
                        {p.manifest.icon || '⚡'} {p.manifest.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 动作与输出 */}
          {step === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, color: '#333' }}>动作序列</span>
              </div>
              {form.actions.map((ac, i) => {
                const plugin = getPluginById(ac.type, actionPlugins);
                return (
                  <div key={i} style={s.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>步骤 {i + 1}: {plugin?.manifest.icon || '⚙️'} {plugin?.manifest.name || ac.type}</span>
                      <button style={s.deleteBtn} onClick={() => update({ actions: form.actions.filter((_, j) => j !== i) })}>删除</button>
                    </div>
                    {plugin ? (
                      <ActionConfig
                        plugin={plugin}
                        config={ac.config}
                        onChange={(config) => {
                          const actions = [...form.actions];
                          actions[i] = { ...actions[i], config };
                          update({ actions });
                        }}
                        outputVar={ac.output_var}
                        onOutputVarChange={(output_var) => {
                          const actions = [...form.actions];
                          actions[i] = { ...actions[i], output_var };
                          update({ actions });
                        }}
                        continueOnError={ac.continue_on_error}
                        onContinueOnErrorChange={(continue_on_error) => {
                          const actions = [...form.actions];
                          actions[i] = { ...actions[i], continue_on_error };
                          update({ actions });
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 13, color: '#888' }}>配置: {JSON.stringify(ac.config)}</div>
                    )}
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  style={{ ...s.select, flex: 1 }}
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      update({ actions: [...form.actions, { type: e.target.value, name: '', config: {}, output_var: '', continue_on_error: false }] });
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ 添加动作...</option>
                  {actionPlugins.map(p => (
                    <option key={p.manifest.id} value={p.manifest.id}>
                      {p.manifest.icon || '⚙️'} {p.manifest.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 高级设置 */}
              <div style={{ ...s.card, marginTop: 20, background: '#f5f5f5' }}>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>高级设置</div>
                <div style={s.formGroup}>
                  <label style={s.label}>超时时间（秒）</label>
                  <input type="number" style={s.input} value={form.timeout_sec} onChange={e => update({ timeout_sec: parseInt(e.target.value) || 300 })} min={0} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>重试次数</label>
                  <input type="number" style={s.input} value={form.max_retries} onChange={e => update({ max_retries: parseInt(e.target.value) || 0 })} min={0} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>重试间隔（秒）</label>
                  <input type="number" style={s.input} value={form.retry_delay_sec} onChange={e => update({ retry_delay_sec: parseInt(e.target.value) || 60 })} min={0} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #e0e0e0',
          display: 'flex', justifyContent: 'space-between', flexDirection: 'column' as const,
        }}>
          {error && (
            <div style={{ padding: '6px 12px', marginBottom: 8, borderRadius: 4, background: '#fff2f0', border: '1px solid #ffccc7', color: '#cf222e', fontSize: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {step > 1 && (
                <button style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setStep(step - 1)}>上一步</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onClick={onClose}>取消</button>
              {step < 3 ? (
                <button style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: '#0078d4', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setStep(step + 1)}>下一步</button>
              ) : (
                <button style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: '#0078d4', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={handleSave} disabled={saving || !form.name.trim()}>
                  {saving ? '保存中...' : editingTask ? '保存修改' : '创建任务'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
