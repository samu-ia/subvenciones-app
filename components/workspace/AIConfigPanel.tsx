'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, X, Save, ChevronRight, ChevronLeft,
  CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Zap, Wrench, KeyRound, ToggleLeft, ToggleRight, Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AIProvider,
  AITool,
  AVAILABLE_MODELS,
  DEFAULT_TOOL_CONFIGS,
  getToolLabel,
  getProviderLabel
} from '@/lib/types/ai-config';

// ─── tipos locales ──────────────────────────────────────────────────────────

interface ProviderState {
  provider: AIProvider;
  enabled: boolean;
  apiKey: string;        // plain text mientras edita
  hasKey: boolean;       // si ya tiene key guardada en DB
  maskedKey: string;     // "sk-ab...cdef"
  baseUrl?: string;
  organization?: string;
}

interface ToolState {
  tool: AITool;
  enabled: boolean;
  provider: AIProvider;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  streamEnabled: boolean;
  saveAsDoc: boolean;    // nuevo: guardar resultado como documento
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

const ALL_PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'google', 'openrouter', 'azure', 'custom'];
const ALL_TOOLS: AITool[] = ['notebook', 'summary', 'missing-info', 'checklist', 'email', 'deep-search'];

const PROVIDER_COLORS: Record<AIProvider, string> = {
  openai:     '#10a37f',
  anthropic:  '#d97757',
  google:     '#4285f4',
  openrouter: '#7c3aed',
  azure:      '#0078d4',
  custom:     '#64748b',
};

const TOOL_ICONS: Record<AITool, string> = {
  notebook:     '📓',
  summary:      '📄',
  'missing-info': '🔍',
  checklist:    '✅',
  email:        '📧',
  'deep-search': '🌐',
};

interface AIConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  workspaceType: 'expediente' | 'reunion';
}

type ConfigView = 'main' | 'tool' | 'provider';

export default function AIConfigPanel({
  isOpen,
  onClose,
  userId,
  workspaceType
}: AIConfigPanelProps) {
  const [currentView, setCurrentView] = useState<ConfigView>('main');
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [providers, setProviders] = useState<ProviderState[]>(
    ALL_PROVIDERS.map(p => ({
      provider: p, enabled: false, apiKey: '', hasKey: false, maskedKey: '',
    }))
  );

  const [tools, setTools] = useState<ToolState[]>(
    ALL_TOOLS.map(t => {
      const def = DEFAULT_TOOL_CONFIGS[t];
      return {
        tool: t,
        enabled: def.enabled ?? true,
        provider: (def.provider ?? 'openai') as AIProvider,
        model: def.model ?? 'gpt-4-turbo',
        systemPrompt: def.systemPrompt ?? '',
        temperature: def.temperature ?? 0.7,
        maxTokens: def.maxTokens ?? 2000,
        streamEnabled: def.streamEnabled ?? true,
        saveAsDoc: ['summary', 'checklist', 'email'].includes(t),
      };
    })
  );

  // ─── cargar configuraciones desde DB ──────────────────────────────────────
  const loadConfigs = useCallback(async () => {
    if (!isOpen) return;
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
          const db = provData.providers.find((d: any) => d.provider === p);
          return {
            provider: p,
            enabled: db?.enabled ?? false,
            apiKey: '',
            hasKey: db?.has_key ?? false,
            maskedKey: db?.api_key ?? '',
            baseUrl: db?.base_url ?? '',
            organization: db?.organization ?? '',
          };
        }));
      }

      if (toolData.tools) {
        setTools(ALL_TOOLS.map(t => {
          const db = toolData.tools.find((d: any) => d.tool === t);
          const def = DEFAULT_TOOL_CONFIGS[t];
          return {
            tool: t,
            enabled: db?.enabled ?? def.enabled ?? true,
            provider: (db?.provider ?? def.provider ?? 'openai') as AIProvider,
            model: db?.model ?? def.model ?? 'gpt-4-turbo',
            systemPrompt: db?.system_prompt ?? def.systemPrompt ?? '',
            temperature: db?.temperature ?? def.temperature ?? 0.7,
            maxTokens: db?.max_tokens ?? def.maxTokens ?? 2000,
            streamEnabled: db?.stream_enabled ?? def.streamEnabled ?? true,
            saveAsDoc: db?.config?.saveAsDoc ?? ['summary', 'checklist', 'email'].includes(t),
          };
        }));
      }
    } catch (e) {
      console.error('Error cargando config IA:', e);
    } finally {
      setLoading(false);
    }
  }, [isOpen, workspaceType]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  // ─── guardar proveedor ─────────────────────────────────────────────────────
  const saveProvider = async () => {
    if (!selectedProvider) return;
    setSaving(true);
    const p = providers.find(x => x.provider === selectedProvider)!;
    await fetch('/api/ia/config/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: p.provider,
        apiKey: p.apiKey || undefined,
        baseUrl: p.baseUrl,
        organization: p.organization,
        enabled: p.enabled,
      }),
    });
    setSaving(false);
    // Recargar para obtener key enmascarada
    await loadConfigs();
    setCurrentView('main');
  };

  // ─── guardar herramienta ───────────────────────────────────────────────────
  const saveTool = async () => {
    if (!selectedTool) return;
    setSaving(true);
    const t = tools.find(x => x.tool === selectedTool)!;
    await fetch('/api/ia/config/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: t.tool,
        workspaceType,
        enabled: t.enabled,
        provider: t.provider,
        model: t.model,
        systemPrompt: t.systemPrompt,
        temperature: t.temperature,
        maxTokens: t.maxTokens,
        streamEnabled: t.streamEnabled,
        config: { saveAsDoc: t.saveAsDoc },
      }),
    });
    setSaving(false);
    setCurrentView('main');
  };

  // ─── test de conexión ──────────────────────────────────────────────────────
  const testConnection = async () => {
    if (!selectedProvider) return;
    setTestStatus('testing');
    setTestMessage('');
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

  const updateProvider = (field: Partial<ProviderState>) => {
    setProviders(prev => prev.map(p => p.provider === selectedProvider ? { ...p, ...field } : p));
  };

  const updateTool = (field: Partial<ToolState>) => {
    setTools(prev => prev.map(t => t.tool === selectedTool ? { ...t, ...field } : t));
  };
  if (!isOpen) return null;

  // ─── VISTA PRINCIPAL ───────────────────────────────────────────────────────
  const renderMain = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <KeyRound size={14} style={{ color: 'var(--muted-foreground)' }} />
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
            Proveedores
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {ALL_PROVIDERS.map(provId => {
            const p = providers.find(x => x.provider === provId)!;
            return (
              <button key={provId}
                onClick={() => { setSelectedProvider(provId); setCurrentView('provider'); setTestStatus('idle'); setShowKey(false); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.enabled && p.hasKey ? '#22c55e' : p.enabled ? '#f59e0b' : '#d1d5db', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>{getProviderLabel(provId)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{p.hasKey ? (p.enabled ? 'Activo' : 'Clave guardada — inactivo') : 'Sin configurar'}</div>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <Wrench size={14} style={{ color: 'var(--muted-foreground)' }} />
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
            Herramientas
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {ALL_TOOLS.map(toolId => {
            const t = tools.find(x => x.tool === toolId)!;
            return (
              <button key={toolId}
                onClick={() => { setSelectedTool(toolId); setCurrentView('tool'); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '15px' }}>{TOOL_ICONS[toolId]}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>{getToolLabel(toolId)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: PROVIDER_COLORS[t.provider], fontWeight: '600' }}>{getProviderLabel(t.provider)}</span>
                      <span>·</span>
                      <span>{t.model}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {!t.enabled && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#f3f4f6', color: '#6b7280' }}>Off</span>}
                  <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  // ─── VISTA PROVEEDOR ───────────────────────────────────────────────────────
  const renderProvider = () => {
    if (!selectedProvider) return null;
    const p = providers.find(x => x.provider === selectedProvider)!;
    const color = PROVIDER_COLORS[selectedProvider];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', background: `${color}12`, border: `1px solid ${color}30` }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.enabled && p.hasKey ? '#22c55e' : '#d1d5db' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>{getProviderLabel(selectedProvider)}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{p.hasKey ? '✓ API key guardada' : 'Sin configurar'}</div>
          </div>
          <button onClick={() => updateProvider({ enabled: !p.enabled })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.enabled ? '#22c55e' : '#d1d5db' }}>
            {p.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>
            API Key {p.hasKey && <span style={{ color: '#22c55e', fontWeight: '400' }}>— guardada</span>}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={p.apiKey}
              onChange={e => updateProvider({ apiKey: e.target.value })}
              placeholder={p.hasKey ? p.maskedKey : selectedProvider === 'openai' ? 'sk-...' : selectedProvider === 'anthropic' ? 'sk-ant-...' : 'API key'}
              style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'monospace', background: 'white', boxSizing: 'border-box' }}
            />
            <button onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>Guardada de forma segura.</p>
        </div>

        {selectedProvider === 'openai' && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>Organization ID <span style={{ fontWeight: '400' }}>(opcional)</span></label>
            <input type="text" value={p.organization || ''} onChange={e => updateProvider({ organization: e.target.value })} placeholder="org-..." style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
        )}

        {(selectedProvider === 'custom' || selectedProvider === 'azure' || selectedProvider === 'openrouter') && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>Base URL</label>
            <input type="text" value={p.baseUrl || ''} onChange={e => updateProvider({ baseUrl: e.target.value })} placeholder={selectedProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://...'} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
        )}

        <div>
          <button onClick={testConnection} disabled={testStatus === 'testing' || (!p.apiKey && !p.hasKey)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: testStatus === 'testing' ? 'wait' : 'pointer', fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', opacity: (!p.apiKey && !p.hasKey) ? 0.5 : 1 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'white')}
          >
            {testStatus === 'testing' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wifi size={14} />}
            {testStatus === 'testing' ? 'Probando...' : 'Probar conexión'}
          </button>
          {testStatus === 'ok' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '8px 10px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
              <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '500' }}>{testMessage}</span>
            </div>
          )}
          {testStatus === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '8px 10px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca' }}>
              <XCircle size={14} style={{ color: '#dc2626' }} />
              <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500' }}>{testMessage}</span>
            </div>
          )}
        </div>

        <button onClick={saveProvider} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', fontSize: '13px', fontWeight: '600', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    );
  };

  // ─── VISTA HERRAMIENTA ─────────────────────────────────────────────────────
  const renderTool = () => {
    if (!selectedTool) return null;
    const t = tools.find(x => x.tool === selectedTool)!;
    const availableModels = AVAILABLE_MODELS[t.provider] || [];
    const enabledProviders = providers.filter(p => p.enabled || p.hasKey);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', background: 'var(--accent)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '22px' }}>{TOOL_ICONS[selectedTool]}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: '15px', fontWeight: '700' }}>{getToolLabel(selectedTool)}</div></div>
          <button onClick={() => updateTool({ enabled: !t.enabled })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.enabled ? '#22c55e' : '#d1d5db' }}>
            {t.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>Proveedor</label>
          <select value={t.provider} onChange={e => { const np = e.target.value as AIProvider; updateTool({ provider: np, model: AVAILABLE_MODELS[np]?.[0]?.id || '' }); }}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', background: 'white' }}>
            {(enabledProviders.length > 0 ? enabledProviders : providers).map(p => (
              <option key={p.provider} value={p.provider}>{getProviderLabel(p.provider)}</option>
            ))}
          </select>
          {enabledProviders.length === 0 && <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>⚠ Configura un proveedor primero.</p>}
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>Modelo</label>
          <select value={t.model} onChange={e => updateTool({ model: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', background: 'white' }}>
            {availableModels.map(m => <option key={m.id} value={m.id}>{m.name} — {m.contextWindow.toLocaleString()}k tokens</option>)}
            {availableModels.length === 0 && <option value={t.model}>{t.model}</option>}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>Temperatura</span><span style={{ fontWeight: '700', color: 'var(--foreground)' }}>{t.temperature.toFixed(1)}</span>
          </label>
          <input type="range" min="0" max="1" step="0.1" value={t.temperature} onChange={e => updateTool({ temperature: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: 'var(--primary)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
            <span>Preciso</span><span>Creativo</span>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>Prompt del sistema</label>
          <textarea value={t.systemPrompt} onChange={e => updateTool({ systemPrompt: e.target.value })} rows={5} placeholder="Instrucciones base..."
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', lineHeight: '1.5', boxSizing: 'border-box' }} />
        </div>

        {['summary', 'checklist', 'email', 'deep-search', 'missing-info'].includes(selectedTool) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: 'var(--accent)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>Guardar resultado como documento</div>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Ofrece guardar el resultado en el expediente</div>
            </div>
            <button onClick={() => updateTool({ saveAsDoc: !t.saveAsDoc })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.saveAsDoc ? '#22c55e' : '#d1d5db' }}>
              {t.saveAsDoc ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>
        )}

        <button onClick={saveTool} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', fontSize: '13px', fontWeight: '600', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    );
  };

  // ─── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '400px', maxWidth: '100vw', background: 'white', borderLeft: '1px solid var(--border)', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'white', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentView !== 'main' && (
              <button onClick={() => { setCurrentView('main'); setTestStatus('idle'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', padding: '2px' }}>
                <ChevronLeft size={18} />
              </button>
            )}
            <Zap size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '15px', fontWeight: '700' }}>
              {currentView === 'main' && 'Configuración IA'}
              {currentView === 'provider' && selectedProvider && getProviderLabel(selectedProvider)}
              {currentView === 'tool' && selectedTool && getToolLabel(selectedTool)}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading && currentView === 'main' ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--muted-foreground)' }} />
            </div>
          ) : (
            <>
              {currentView === 'main' && renderMain()}
              {currentView === 'provider' && renderProvider()}
              {currentView === 'tool' && renderTool()}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}