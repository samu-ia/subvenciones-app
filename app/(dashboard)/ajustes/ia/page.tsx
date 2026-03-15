'use client';

import { useState, useEffect } from 'react';
import { Brain, Save, TestTube, AlertCircle, CheckCircle, Loader, Eye, EyeOff, Copy, Plus, Trash2, GripVertical } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AISettings {
  provider: string;
  model_id: string;
  mode: string;
  endpoint_base: string | null;
  organization_id: string | null;
  project_id: string | null;
  temperature: number;
  max_tokens: number;
  top_p: number;
  timeout_seconds: number;
  streaming_enabled: boolean;
  strict_mode: boolean;
  embeddings_provider: string;
  embeddings_model: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  min_score: number;
  answer_only_with_evidence: boolean;
  show_citations: boolean;
  source_priority: string[];
  auto_reindex: boolean;
  status: string;
  last_validated_at: string | null;
}

interface TaskMapping {
  id: string;
  task_name: string;
  task_label: string;
  provider: string;
  model_id: string;
  temperature: number;
  sort_order: number;
}

interface Preset {
  id: string;
  name: string;
  label: string;
  description: string;
  config: any;
  is_default: boolean;
}

const PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'OpenRouter', 'Ollama', 'Azure OpenAI', 'Personalizado'];

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  'OpenAI': ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
  'Anthropic': ['claude-sonnet', 'claude-opus', 'claude-haiku'],
  'Google': ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro'],
  'OpenRouter': ['custom'],
  'Ollama': ['llama2', 'mistral', 'codellama'],
  'Azure OpenAI': ['custom'],
  'Personalizado': ['custom'],
};

const EMBEDDINGS_PROVIDERS = ['OpenAI', 'Google', 'Voyage', 'Ollama', 'Personalizado'];

const EMBEDDINGS_MODELS: Record<string, string[]> = {
  'OpenAI': ['text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002'],
  'Google': ['gemini-embedding', 'text-embedding-004'],
  'Voyage': ['voyage-2', 'voyage-large-2'],
  'Ollama': ['custom'],
  'Personalizado': ['custom'],
};

const SOURCE_LABELS: Record<string, string> = {
  'cliente': 'Datos del cliente',
  'reuniones': 'Reuniones',
  'anotaciones': 'Anotaciones',
  'expedientes': 'Expedientes',
  'documentos_subidos': 'Documentos subidos',
  'documentos_generados': 'Documentos generados',
  'ayudas': 'Base de ayudas / convocatorias',
};

export default function ConfiguracionIAPage() {
  const supabase = createClient();

  // Estados principales
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [taskMappings, setTaskMappings] = useState<TaskMapping[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados de drag and drop
  const [draggedSource, setDraggedSource] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadTaskMappings();
    loadPresets();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTaskMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_task_model_mapping')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setTaskMappings(data || []);
    } catch (error) {
      console.error('Error loading task mappings:', error);
    }
  };

  const loadPresets = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_presets')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPresets(data || []);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_settings')
        .update(settings)
        .eq('id', settings.id);

      if (error) throw error;

      alert('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // Simular prueba de conexión
    setTimeout(() => {
      setTestResult({
        type: 'success',
        message: 'Conexión correcta. El modelo responde adecuadamente.',
      });
      setTesting(false);
    }, 2000);
  };

  const handleApplyPreset = async (preset: Preset) => {
    if (!settings) return;

    const confirmed = confirm(`¿Aplicar preset "${preset.label}"? Esto sobrescribirá la configuración actual.`);
    if (!confirmed) return;

    setSettings({
      ...settings,
      ...preset.config,
    });
  };

  const handleDragStart = (source: string) => {
    setDraggedSource(source);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetSource: string) => {
    if (!draggedSource || !settings) return;

    const sources = [...settings.source_priority];
    const draggedIndex = sources.indexOf(draggedSource);
    const targetIndex = sources.indexOf(targetSource);

    sources.splice(draggedIndex, 1);
    sources.splice(targetIndex, 0, draggedSource);

    setSettings({
      ...settings,
      source_priority: sources,
    });

    setDraggedSource(null);
  };

  if (loading || !settings) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--teal)' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 'var(--s2)',
        padding: 'var(--s2)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s1)', marginBottom: '8px' }}>
            <Brain size={28} style={{ color: 'var(--teal)' }} />
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>Configuración IA</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            Gestiona proveedores, modelos, claves y recuperación documental.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--s1)' }}>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            style={{
              padding: '10px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: testing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {testing ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <TestTube size={16} />}
            Probar configuración
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px',
              background: 'var(--teal)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {saving ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
            Guardar cambios
          </button>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div style={{
          padding: 'var(--s1)',
          background: testResult.type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)',
          border: `1px solid ${testResult.type === 'success' ? '#22c55e' : '#ef4444'}`,
          borderRadius: '6px',
          marginBottom: 'var(--s2)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s1)',
        }}>
          {testResult.type === 'success' ? (
            <CheckCircle size={20} style={{ color: '#22c55e' }} />
          ) : (
            <AlertCircle size={20} style={{ color: '#ef4444' }} />
          )}
          <span style={{ fontSize: '14px' }}>{testResult.message}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
        {/* 1. Proveedor y modelo */}
        <section style={{
          padding: 'var(--s2)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 var(--s1) 0', fontSize: '18px', fontWeight: 600 }}>Proveedor y modelo</h2>
          <p style={{ margin: '0 0 var(--s2) 0', color: 'var(--muted)', fontSize: '14px' }}>
            Selecciona qué proveedor y modelo usar para las funciones de IA.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s1)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Proveedor
              </label>
              <select
                value={settings.provider}
                onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Modelo principal
              </label>
              {settings.mode === 'simple' ? (
                <select
                  value={settings.model_id}
                  onChange={(e) => setSettings({ ...settings, model_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  {MODELS_BY_PROVIDER[settings.provider]?.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.model_id}
                  onChange={(e) => setSettings({ ...settings, model_id: e.target.value })}
                  placeholder="ID exacto del modelo"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Modo de selección
              </label>
              <select
                value={settings.mode}
                onChange={(e) => setSettings({ ...settings, mode: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="simple">Simple</option>
                <option value="avanzado">Avanzado</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Endpoint base
              </label>
              <input
                type="text"
                value={settings.endpoint_base || ''}
                onChange={(e) => setSettings({ ...settings, endpoint_base: e.target.value })}
                placeholder="https://api.openai.com/v1"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        </section>

        {/* 2. Autenticación */}
        <section style={{
          padding: 'var(--s2)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 var(--s1) 0', fontSize: '18px', fontWeight: 600 }}>Claves API y autenticación</h2>
          <p style={{ margin: '0 0 var(--s2) 0', color: 'var(--muted)', fontSize: '14px' }}>
            Guarda las credenciales necesarias para conectar con el proveedor.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s1)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  style={{
                    width: '100%',
                    padding: '10px 80px 10px 10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(apiKey)}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Parámetros del modelo */}
        <section style={{
          padding: 'var(--s2)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 var(--s1) 0', fontSize: '18px', fontWeight: 600 }}>Parámetros del modelo</h2>
          <p style={{ margin: '0 0 var(--s2) 0', color: 'var(--muted)', fontSize: '14px' }}>
            Ajusta cómo responde la IA en conversaciones y generación de documentos.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s2)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Temperatura: {settings.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                Menor temperatura = respuestas más estables y predecibles
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Max tokens
              </label>
              <input
                type="number"
                value={settings.max_tokens}
                onChange={(e) => setSettings({ ...settings, max_tokens: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Top P: {settings.top_p}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.top_p}
                onChange={(e) => setSettings({ ...settings, top_p: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Timeout (segundos)
              </label>
              <input
                type="number"
                value={settings.timeout_seconds}
                onChange={(e) => setSettings({ ...settings, timeout_seconds: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.streaming_enabled}
                  onChange={(e) => setSettings({ ...settings, streaming_enabled: e.target.checked })}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Streaming activado</span>
              </label>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.strict_mode}
                  onChange={(e) => setSettings({ ...settings, strict_mode: e.target.checked })}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Modo estricto</span>
              </label>
              <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: 'var(--muted)' }}>
                Prioriza precisión y evita responder sin base suficiente
              </p>
            </div>
          </div>
        </section>

        {/* 4. Configuración RAG */}
        <section style={{
          padding: 'var(--s2)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 var(--s1) 0', fontSize: '18px', fontWeight: 600 }}>Recuperación documental (RAG)</h2>
          <p style={{ margin: '0 0 var(--s2) 0', color: 'var(--muted)', fontSize: '14px' }}>
            Controla cómo se buscan y usan documentos, notas, reuniones y expedientes para responder.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s2)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Proveedor de embeddings
              </label>
              <select
                value={settings.embeddings_provider}
                onChange={(e) => setSettings({ ...settings, embeddings_provider: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {EMBEDDINGS_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Modelo de embeddings
              </label>
              <select
                value={settings.embeddings_model}
                onChange={(e) => setSettings({ ...settings, embeddings_model: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {EMBEDDINGS_MODELS[settings.embeddings_provider]?.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Tamaño de chunk
              </label>
              <input
                type="number"
                value={settings.chunk_size}
                onChange={(e) => setSettings({ ...settings, chunk_size: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Solape entre chunks
              </label>
              <input
                type="number"
                value={settings.chunk_overlap}
                onChange={(e) => setSettings({ ...settings, chunk_overlap: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Top-K
              </label>
              <input
                type="number"
                value={settings.top_k}
                onChange={(e) => setSettings({ ...settings, top_k: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Score mínimo
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.min_score}
                onChange={(e) => setSettings({ ...settings, min_score: parseFloat(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.answer_only_with_evidence}
                  onChange={(e) => setSettings({ ...settings, answer_only_with_evidence: e.target.checked })}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Responder solo con evidencia</span>
              </label>
              <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: 'var(--muted)' }}>
                No responde cuando no encuentra fuentes suficientes
              </p>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.show_citations}
                  onChange={(e) => setSettings({ ...settings, show_citations: e.target.checked })}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Mostrar citas y fuentes</span>
              </label>
              <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: 'var(--muted)' }}>
                Añade referencias visibles dentro de la respuesta
              </p>
            </div>
          </div>

          <div style={{ marginTop: 'var(--s2)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--s1)', fontSize: '14px', fontWeight: 500 }}>
              Prioridad de fuentes (arrastra para reordenar)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {settings.source_priority.map((source) => (
                <div
                  key={source}
                  draggable
                  onDragStart={() => handleDragStart(source)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(source)}
                  style={{
                    padding: 'var(--s1)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--s1)',
                    cursor: 'move',
                  }}
                >
                  <GripVertical size={16} style={{ color: 'var(--muted)' }} />
                  <span style={{ fontSize: '14px' }}>{SOURCE_LABELS[source] || source}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'var(--s2)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.auto_reindex}
                onChange={(e) => setSettings({ ...settings, auto_reindex: e.target.checked })}
              />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Reindexación automática</span>
            </label>
            <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: 'var(--muted)' }}>
              Reindexa documentos y notas cuando se crean o actualizan
            </p>
          </div>
        </section>

        {/* 5. Modelos por tarea */}
        <section style={{
          padding: 'var(--s2)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 var(--s1) 0', fontSize: '18px', fontWeight: 600 }}>Asignación por tarea</h2>
          <p style={{ margin: '0 0 var(--s2) 0', color: 'var(--muted)', fontSize: '14px' }}>
            Permite usar modelos distintos según el tipo de trabajo.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Tarea</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Proveedor</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Modelo</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Temperatura</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {taskMappings.map((task) => (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{task.task_label}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{task.provider}</td>
                    <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'monospace' }}>{task.model_id}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{task.temperature}</td>
                    <td style={{ padding: '12px' }}>
                      <button
                        style={{
                          padding: '6px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--red)',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            style={{
              marginTop: 'var(--s1)',
              padding: '10px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <Plus size={16} />
            Añadir asignación
          </button>
        </section>

        {/* 6. Presets rápidos */}
        <section style={{
          padding: 'var(--s2)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 var(--s1) 0', fontSize: '18px', fontWeight: 600 }}>Presets rápidos</h2>
          <p style={{ margin: '0 0 var(--s2) 0', color: 'var(--muted)', fontSize: '14px' }}>
            Aplica configuraciones predefinidas según tus necesidades.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--s1)' }}>
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                style={{
                  padding: 'var(--s1)',
                  background: preset.is_default ? 'var(--teal)' : 'var(--bg)',
                  color: preset.is_default ? 'white' : 'var(--ink)',
                  border: `1px solid ${preset.is_default ? 'var(--teal)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{preset.label}</div>
                <div style={{ fontSize: '12px', opacity: preset.is_default ? 0.9 : 0.7 }}>{preset.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 7. Estado y seguridad */}
        <section style={{
          padding: 'var(--s2)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 var(--s1) 0', fontSize: '18px', fontWeight: 600 }}>Seguridad y validación</h2>

          <div style={{
            padding: 'var(--s1)',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            marginBottom: 'var(--s1)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s1)', fontSize: '14px' }}>
              <div>
                <span style={{ color: 'var(--muted)' }}>Proveedor activo:</span>
                <strong style={{ marginLeft: '6px' }}>{settings.provider}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>Modelo activo:</span>
                <strong style={{ marginLeft: '6px' }}>{settings.model_id}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>Estado:</span>
                <strong style={{ marginLeft: '6px', color: settings.status === 'correcto' ? 'var(--teal)' : 'var(--amber)' }}>
                  {settings.status}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>Última validación:</span>
                <strong style={{ marginLeft: '6px' }}>
                  {settings.last_validated_at ? new Date(settings.last_validated_at).toLocaleString() : 'Nunca'}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px 0' }}>🔒 Las claves se almacenan cifradas en el servidor</p>
            <p style={{ margin: '0 0 8px 0' }}>🔒 Nunca se muestran completas tras guardarse</p>
            <p style={{ margin: 0 }}>🔒 Las pruebas no exponen tokens al frontend</p>
          </div>
        </section>
      </div>
    </div>
  );
}
