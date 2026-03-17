'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Save, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, ToggleLeft, ToggleRight, Wifi,
  ChevronRight, ChevronLeft, KeyRound, Wrench
} from 'lucide-react';
import {
  AIProvider, AITool, AVAILABLE_MODELS,
  DEFAULT_TOOL_CONFIGS, getToolLabel, getProviderLabel
} from '@/lib/types/ai-config';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface ProviderState {
  provider: AIProvider;
  enabled: boolean;
  apiKey: string;
  hasKey: boolean;
  maskedKey: string;
  baseUrl?: string;
  organization?: string;
}

interface ToolState {
  tool: AITool;
  enabled: boolean;
  provider: AIProvider;
  model: string;
  modelManual: string;  // input de texto libre — si no está vacío, tiene prioridad
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  saveAsDoc: boolean;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

const ALL_PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'google', 'openrouter', 'azure', 'custom'];
const ALL_TOOLS: AITool[] = ['notebook', 'summary', 'missing-info', 'checklist', 'email', 'deep-search'];

const TOOL_EMOJI: Record<AITool, string> = {
  notebook:       '💬',
  summary:        '📋',
  'missing-info': '🔍',
  checklist:      '✅',
  email:          '✉️',
  'deep-search':  '🔎',
};

// Modelos sugeridos para el dropdown, incluyendo los más recientes
const SUGGESTED_MODELS: Record<AIProvider, { id: string; label: string }[]> = {
  openai: [
    { id: 'gpt-4.1',        label: 'GPT-4.1' },
    { id: 'gpt-4o',         label: 'GPT-4o' },
    { id: 'gpt-4o-mini',    label: 'GPT-4o mini' },
    { id: 'gpt-4-turbo',    label: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo',  label: 'GPT-3.5 Turbo' },
    { id: 'o1',             label: 'o1' },
    { id: 'o1-mini',        label: 'o1 mini' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-5',  label: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4',      label: 'Claude Opus 4' },
    { id: 'claude-3-5-sonnet',  label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-haiku',     label: 'Claude 3 Haiku' },
  ],
  google: [
    { id: 'gemini-2.5-pro',      label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash',    label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro',      label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash',    label: 'Gemini 1.5 Flash' },
  ],
  openrouter: [
    { id: 'auto',                                    label: 'Auto (mejor disponible)' },
    { id: 'openai/gpt-4.1',                          label: 'openai/gpt-4.1' },
    { id: 'anthropic/claude-sonnet-4-5',             label: 'anthropic/claude-sonnet-4-5' },
    { id: 'google/gemini-2.5-pro',                   label: 'google/gemini-2.5-pro' },
    { id: 'meta-llama/llama-3.1-405b-instruct',      label: 'meta-llama/llama-3.1-405b' },
    { id: 'mistralai/mistral-large',                 label: 'mistralai/mistral-large' },
  ],
  azure: [],
  custom: [],
};

interface AIConfigPanelProps {
  userId: string;
  workspaceType: 'expediente' | 'reunion';
  /** true = integrado dentro del panel (sin overlay/slide-out) */
  inline?: boolean;
  /** Solo necesario si inline=false */
  isOpen?: boolean;
  onClose?: () => void;
}

type ConfigView = 'main' | 'tool' | 'provider';

export default function AIConfigPanel({ userId, workspaceType, inline, isOpen, onClose }: AIConfigPanelProps) {
  const [view, setView] = useState<ConfigView>('main');
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyDirty, setKeyDirty] = useState(false);  // true = usuario tecleó algo nuevo
  const [savedFeedback, setSavedFeedback] = useState(false);

  const [providers, setProviders] = useState<ProviderState[]>(
    ALL_PROVIDERS.map(p => ({ provider: p, enabled: false, apiKey: '', hasKey: false, maskedKey: '' }))
  );

  const [tools, setTools] = useState<ToolState[]>(
    ALL_TOOLS.map(t => {
      const def = DEFAULT_TOOL_CONFIGS[t];
      return {
        tool: t,
        enabled: def.enabled ?? true,
        provider: (def.provider ?? 'openai') as AIProvider,
        model: def.model ?? '',
        modelManual: '',
        systemPrompt: def.systemPrompt ?? '',
        temperature: def.temperature ?? 0.7,
        maxTokens: def.maxTokens ?? 2000,
        saveAsDoc: ['summary', 'checklist', 'email'].includes(t),
      };
    })
  );

  const visible = inline || isOpen;

  const loadConfigs = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    try {
      const [provRes, toolRes] = await Promise.all([
        fetch('/api/ia/config/providers'),
        fetch(`/api/ia/config/tools?workspaceType=${workspaceType}`),
      ]);
      const provData = await provRes.json();
      const toolData = await toolRes.json();

      if (provData.providers) {
        setProviders(ALL_PROVIDERS.map(p => {
          const db = provData.providers.find((d: Record<string, unknown>) => d.provider === p);
          return {
            provider: p, enabled: db?.enabled ?? false,
            apiKey: '', hasKey: db?.has_key ?? false,
            maskedKey: db?.api_key ?? '',
            baseUrl: db?.base_url ?? '',
            organization: db?.organization ?? '',
          };
        }));
      }

      if (toolData.tools) {
        setTools(ALL_TOOLS.map(t => {
          const db = toolData.tools.find((d: Record<string, unknown>) => d.tool === t);
          const def = DEFAULT_TOOL_CONFIGS[t];
          const dbModel: string = db?.model ?? def.model ?? '';
          // Si el modelo de DB no está en la lista de sugeridos, lo ponemos en manual
          const inList = SUGGESTED_MODELS[(db?.provider ?? def.provider ?? 'openai') as AIProvider]?.some((m: {id: string}) => m.id === dbModel);
          return {
            tool: t,
            enabled: db?.enabled ?? def.enabled ?? true,
            provider: (db?.provider ?? def.provider ?? 'openai') as AIProvider,
            model: inList ? dbModel : (SUGGESTED_MODELS[(db?.provider ?? def.provider ?? 'openai') as AIProvider]?.[0]?.id ?? ''),
            modelManual: inList ? '' : dbModel,
            systemPrompt: db?.system_prompt ?? def.systemPrompt ?? '',
            temperature: db?.temperature ?? def.temperature ?? 0.7,
            maxTokens: db?.max_tokens ?? def.maxTokens ?? 2000,
            saveAsDoc: db?.config?.saveAsDoc ?? ['summary', 'checklist', 'email'].includes(t),
          };
        }));
      }
    } catch (e) {
      console.error('Error cargando config IA:', e);
    } finally {
      setLoading(false);
    }
  }, [visible, workspaceType]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const updateProvider = (field: Partial<ProviderState>) => {
    setProviders(prev => prev.map(p => p.provider === selectedProvider ? { ...p, ...field } : p));
  };

  const updateTool = (field: Partial<ToolState>) => {
    setTools(prev => prev.map(t => t.tool === selectedTool ? { ...t, ...field } : t));
  };

  // El modelo efectivo: si hay texto manual, usa ese; si no, el del dropdown
  const effectiveModel = (t: ToolState) => t.modelManual.trim() || t.model;

  const [saveError, setSaveError] = useState<string | null>(null);

  const saveProvider = async () => {
    if (!selectedProvider) return;
    setSaving(true);
    setSaveError(null);
    const p = providers.find(x => x.provider === selectedProvider)!;
    // Solo enviar apiKey si el usuario realmente la tecleó (keyDirty)
    // Si no es dirty, NO tocar la key guardada en BD
    const body: Record<string, unknown> = {
      provider: p.provider,
      baseUrl: p.baseUrl,
      organization: p.organization,
      enabled: p.enabled,
    };
    if (keyDirty && p.apiKey.trim()) {
      body.apiKey = p.apiKey.trim();
    }
    const res = await fetch('/api/ia/config/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error || `Error ${res.status} guardando`);
      return;
    }
    setKeyDirty(false);
    await loadConfigs();
    setView('main');
    showFeedback();
  };

  const saveTool = async () => {
    if (!selectedTool) return;
    setSaving(true);
    setSaveError(null);
    const t = tools.find(x => x.tool === selectedTool)!;
    const res = await fetch('/api/ia/config/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: t.tool, workspaceType,
        enabled: t.enabled,
        provider: t.provider,
        model: effectiveModel(t),
        systemPrompt: t.systemPrompt,
        temperature: t.temperature,
        maxTokens: t.maxTokens,
        config: { saveAsDoc: t.saveAsDoc },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error || `Error ${res.status} guardando`);
      return;
    }
    setView('main');
    showFeedback();
  };

  const testConnection = async () => {
    if (!selectedProvider) return;
    setTestStatus('testing');
    const p = providers.find(x => x.provider === selectedProvider)!;
    try {
      const res = await fetch('/api/ia/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, apiKey: p.apiKey || undefined }),
      });
      const data = await res.json();
      setTestStatus(data.ok ? 'ok' : 'error');
      setTestMessage(data.ok ? data.message : data.error);
    } catch {
      setTestStatus('error');
      setTestMessage('Error de red');
    }
  };

  const showFeedback = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  if (!visible) return null;

  // ─── Estilos base para inputs ──────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    border: '1px solid var(--border)', fontSize: '13px',
    background: 'var(--background)', color: 'var(--foreground)',
    boxSizing: 'border-box', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: '600', color: 'var(--muted-foreground)',
    display: 'block', marginBottom: '5px', letterSpacing: '0.01em',
  };

  const sectionTitle = (icon: React.ReactNode, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      {icon}
      <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
        {text}
      </span>
    </div>
  );

  // ═══ VISTA PRINCIPAL ═══════════════════════════════════════════════════════
  const renderMain = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {savedFeedback && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
          <span style={{ fontSize: '12px', color: '#16a34a' }}>Cambios guardados</span>
        </div>
      )}

      {/* Proveedores */}
      <section>
        {sectionTitle(<KeyRound size={13} style={{ color: 'var(--muted-foreground)' }} />, 'Proveedores')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {ALL_PROVIDERS.map(provId => {
            const p = providers.find(x => x.provider === provId)!;
            const statusColor = p.enabled && p.hasKey ? '#22c55e' : p.hasKey ? '#f59e0b' : 'var(--border)';
            return (
              <button key={provId}
                onClick={() => { setSelectedProvider(provId); setView('provider'); setTestStatus('idle'); setShowKey(false); setKeyDirty(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'var(--background)', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--foreground)' }}>{getProviderLabel(provId)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                      {p.hasKey ? (p.enabled ? 'Activo' : 'Clave guardada — inactivo') : 'Sin configurar'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={13} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            );
          })}
        </div>
      </section>

      {/* Herramientas */}
      <section>
        {sectionTitle(<Wrench size={13} style={{ color: 'var(--muted-foreground)' }} />, 'Herramientas')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {ALL_TOOLS.map(toolId => {
            const t = tools.find(x => x.tool === toolId)!;
            return (
              <button key={toolId}
                onClick={() => { setSelectedTool(toolId); setView('tool'); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'var(--background)', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '15px' }}>{TOOL_EMOJI[toolId]}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--foreground)' }}>{getToolLabel(toolId)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                      {getProviderLabel(t.provider)} · <span style={{ fontFamily: 'monospace' }}>{effectiveModel(t) || '—'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {!t.enabled && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--muted)', color: 'var(--muted-foreground)' }}>Off</span>}
                  <ChevronRight size={13} style={{ color: 'var(--muted-foreground)' }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  // ═══ VISTA PROVEEDOR ════════════════════════════════════════════════════════
  const renderProvider = () => {
    if (!selectedProvider) return null;
    const p = providers.find(x => x.provider === selectedProvider)!;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Estado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)' }}>{getProviderLabel(selectedProvider)}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '1px' }}>
              {p.hasKey ? '✓ API key guardada' : 'Sin configurar'}
            </div>
          </div>
          <button onClick={() => updateProvider({ enabled: !p.enabled })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.enabled ? '#22c55e' : 'var(--border)', padding: '2px' }}>
            {p.enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
          </button>
        </div>

        {/* API Key */}
        <div>
          <label style={labelStyle}>
            API Key {p.hasKey && <span style={{ color: '#22c55e', fontWeight: '400' }}>— guardada</span>}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={p.apiKey}
              autoComplete="new-password"
              name="api-key-field"
              onChange={e => { updateProvider({ apiKey: e.target.value }); setKeyDirty(true); }}
              placeholder={p.hasKey ? (keyDirty ? '' : p.maskedKey) : selectedProvider === 'openai' ? 'sk-...' : selectedProvider === 'anthropic' ? 'sk-ant-...' : 'API key'}
              style={{ ...inputStyle, paddingRight: '36px', fontFamily: 'monospace',
                background: keyDirty ? 'color-mix(in srgb, var(--primary) 4%, var(--background))' : 'var(--background)',
                borderColor: keyDirty ? 'var(--primary)' : undefined,
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
              onBlur={e => { if (!keyDirty) e.target.style.borderColor = 'var(--border)'; }}
            />
            <button onClick={() => setShowKey(v => !v)}
              style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <p style={{ fontSize: '11px', marginTop: '4px', margin: '4px 0 0 0',
            color: keyDirty ? 'var(--primary)' : 'var(--muted-foreground)' }}>
            {keyDirty ? '✏️ Nueva key — pulsa Guardar para aplicar' : p.hasKey ? '🔒 Key guardada. Escribe para reemplazarla.' : 'Introduce tu API key.'}
          </p>
        </div>

        {selectedProvider === 'openai' && (
          <div>
            <label style={labelStyle}>Organization ID <span style={{ fontWeight: '400' }}>(opcional)</span></label>
            <input type="text" value={p.organization ?? ''} onChange={e => updateProvider({ organization: e.target.value })}
              placeholder="org-..." style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            />
          </div>
        )}

        {(selectedProvider === 'custom' || selectedProvider === 'azure' || selectedProvider === 'openrouter') && (
          <div>
            <label style={labelStyle}>Base URL</label>
            <input type="text" value={p.baseUrl ?? ''} onChange={e => updateProvider({ baseUrl: e.target.value })}
              placeholder={selectedProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://...'}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            />
          </div>
        )}

        {/* Test conexión */}
        <div>
          <button onClick={testConnection} disabled={testStatus === 'testing' || (!p.apiKey && !p.hasKey)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 13px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--background)', cursor: testStatus === 'testing' ? 'wait' : 'pointer',
              fontSize: '12px', fontWeight: '500', color: 'var(--foreground)',
              opacity: (!p.apiKey && !p.hasKey) ? 0.5 : 1, transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
          >
            {testStatus === 'testing'
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Wifi size={13} />}
            {testStatus === 'testing' ? 'Probando...' : 'Probar conexión'}
          </button>
          {testStatus === 'ok' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px', padding: '7px 10px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
              <span style={{ fontSize: '12px', color: '#16a34a' }}>{testMessage}</span>
            </div>
          )}
          {testStatus === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px', padding: '7px 10px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca' }}>
              <XCircle size={13} style={{ color: '#dc2626' }} />
              <span style={{ fontSize: '12px', color: '#dc2626' }}>{testMessage}</span>
            </div>
          )}
        </div>

        {saveError && (
          <div style={{ padding: '8px 10px', borderRadius: '7px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '12px', color: '#dc2626' }}>
            ⚠️ {saveError}
          </div>
        )}

        <button onClick={saveProvider} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            width: '100%', padding: '9px', borderRadius: '8px',
            background: 'var(--primary)', color: 'white', border: 'none',
            fontSize: '13px', fontWeight: '600', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    );
  };

  // ═══ VISTA HERRAMIENTA ══════════════════════════════════════════════════════
  const renderTool = () => {
    if (!selectedTool) return null;
    const t = tools.find(x => x.tool === selectedTool)!;
    const suggestedList = SUGGESTED_MODELS[t.provider] ?? [];
    const enabledProviders = providers.filter(p => p.enabled || p.hasKey);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Cabecera herramienta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{TOOL_EMOJI[selectedTool]}</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{getToolLabel(selectedTool)}</span>
          </div>
          <button onClick={() => updateTool({ enabled: !t.enabled })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.enabled ? '#22c55e' : 'var(--border)', padding: '2px' }}>
            {t.enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
          </button>
        </div>

        {/* Proveedor */}
        <div>
          <label style={labelStyle}>Proveedor</label>
          <select value={t.provider}
            onChange={e => {
              const np = e.target.value as AIProvider;
              const firstModel = SUGGESTED_MODELS[np]?.[0]?.id ?? '';
              updateTool({ provider: np, model: firstModel, modelManual: '' });
            }}
            style={{ ...inputStyle, cursor: 'pointer' }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
          >
            {(enabledProviders.length > 0 ? enabledProviders : providers).map(p => (
              <option key={p.provider} value={p.provider}>{getProviderLabel(p.provider)}</option>
            ))}
          </select>
          {enabledProviders.length === 0 && (
            <p style={{ fontSize: '11px', color: '#92400e', marginTop: '4px', margin: '4px 0 0 0' }}>
              ⚠ Configura un proveedor en la pestaña Ajustes primero.
            </p>
          )}
        </div>

        {/* Modelo — dropdown de sugeridos + input manual */}
        <div>
          <label style={labelStyle}>Modelo</label>

          {suggestedList.length > 0 && (
            <select value={t.model}
              onChange={e => { updateTool({ model: e.target.value, modelManual: '' }); }}
              style={{ ...inputStyle, marginBottom: '7px', cursor: 'pointer' }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            >
              {suggestedList.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}

          {/* Input modelo manual — tiene prioridad si se rellena */}
          <div>
            <label style={{ ...labelStyle, fontWeight: '400', color: 'var(--muted-foreground)' }}>
              O escribe el modelo exacto
              {t.modelManual.trim() && (
                <span style={{ color: 'var(--primary)', fontWeight: '600', marginLeft: '4px' }}>← activo</span>
              )}
            </label>
            <input
              type="text"
              value={t.modelManual}
              onChange={e => updateTool({ modelManual: e.target.value })}
              placeholder={`Ej: gpt-4.1, claude-sonnet-4-5, gemini-2.5-pro, openrouter/…`}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            />
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: '4px 0 0 0' }}>
              Modelo activo: <code style={{ fontFamily: 'monospace', fontWeight: '600', color: 'var(--foreground)' }}>{effectiveModel(t) || '—'}</code>
            </p>
          </div>
        </div>

        {/* Temperatura */}
        <div>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
            <span>Temperatura</span>
            <span style={{ fontWeight: '700', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{t.temperature.toFixed(1)}</span>
          </label>
          <input type="range" min="0" max="1" step="0.1" value={t.temperature}
            onChange={e => updateTool({ temperature: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--primary)', marginBottom: '2px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted-foreground)' }}>
            <span>Preciso</span><span>Creativo</span>
          </div>
        </div>

        {/* Prompt del sistema */}
        <div>
          <label style={labelStyle}>Prompt del sistema</label>
          <textarea value={t.systemPrompt} onChange={e => updateTool({ systemPrompt: e.target.value })}
            rows={5} placeholder="Instrucciones base para esta herramienta..."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', fontSize: '12px' }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
          />
        </div>

        {/* Guardar como doc */}
        {(['summary', 'checklist', 'email', 'deep-search', 'missing-info'] as AITool[]).includes(selectedTool) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: '8px', background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--foreground)' }}>Guardar resultado como documento</div>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Ofrece guardar en el expediente</div>
            </div>
            <button onClick={() => updateTool({ saveAsDoc: !t.saveAsDoc })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.saveAsDoc ? '#22c55e' : 'var(--border)', padding: '2px' }}>
              {t.saveAsDoc ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
            </button>
          </div>
        )}

        {saveError && (
          <div style={{ padding: '8px 10px', borderRadius: '7px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '12px', color: '#dc2626' }}>
            ⚠️ {saveError}
          </div>
        )}

        <button onClick={saveTool} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            width: '100%', padding: '9px', borderRadius: '8px',
            background: 'var(--primary)', color: 'white', border: 'none',
            fontSize: '13px', fontWeight: '600', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    );
  };

  // ═══ RENDER ══════════════════════════════════════════════════════════════════
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cabecera con nav breadcrumb */}
      {view !== 'main' && (
        <div style={{ flexShrink: 0, padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => { setView('main'); setTestStatus('idle'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', padding: '2px' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
            {view === 'provider' && selectedProvider && getProviderLabel(selectedProvider)}
            {view === 'tool' && selectedTool && getToolLabel(selectedTool)}
          </span>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading && view === 'main' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--muted-foreground)' }} />
          </div>
        ) : (
          <>
            {view === 'main' && renderMain()}
            {view === 'provider' && renderProvider()}
            {view === 'tool' && renderTool()}
          </>
        )}
      </div>
    </div>
  );

  // Modo inline: solo el contenido
  if (inline) return (
    <>
      {content}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );

  // Modo overlay (slide-out panel)
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '400px', maxWidth: '100vw',
        background: 'var(--background)', borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.10)', zIndex: 50, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flexShrink: 0, padding: '15px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>Configuración IA</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex' }}>
            ✕
          </button>
        </div>
        {content}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
