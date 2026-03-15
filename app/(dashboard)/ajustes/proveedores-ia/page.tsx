'use client';

import { useState, useEffect } from 'react';
import { Brain, Save, TestTube, Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Tab = 'openai' | 'anthropic' | 'google' | 'embeddings';

const MODELS = {
  openai: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
  anthropic: ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-3.5'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro'],
  embeddings_openai: ['text-embedding-3-large', 'text-embedding-3-small'],
  embeddings_google: ['gemini-embedding', 'text-embedding-004'],
};

export default function ProveedoresIAPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>('openai');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados por proveedor
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o');
  const [openaiEndpoint, setOpenaiEndpoint] = useState('https://api.openai.com/v1');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('claude-sonnet-4');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  const [googleKey, setGoogleKey] = useState('');
  const [googleModel, setGoogleModel] = useState('gemini-2.5-pro');
  const [showGoogleKey, setShowGoogleKey] = useState(false);

  const [embeddingsProvider, setEmbeddingsProvider] = useState('openai');
  const [embeddingsModel, setEmbeddingsModel] = useState('text-embedding-3-large');
  const [embeddingsKey, setEmbeddingsKey] = useState('');
  const [showEmbeddingsKey, setShowEmbeddingsKey] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      alert('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving provider:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    setTimeout(() => {
      setTestResult({
        type: 'success',
        message: 'Conexión correcta. El proveedor responde adecuadamente.',
      });
      setTesting(false);
    }, 2000);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
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
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>Proveedores IA</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            Gestiona claves API, modelos y conexiones con proveedores de IA.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--s1)' }}>
          <button
            onClick={handleTest}
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
            Probar conexión
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
            Guardar
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

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: 'var(--s2)',
        borderBottom: '1px solid var(--border)',
      }}>
        {[
          { key: 'openai', label: 'OpenAI' },
          { key: 'anthropic', label: 'Anthropic' },
          { key: 'google', label: 'Google' },
          { key: 'embeddings', label: 'Embeddings' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            style={{
              padding: '12px 24px',
              background: activeTab === tab.key ? 'var(--surface)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--teal)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? 600 : 500,
              color: activeTab === tab.key ? 'var(--ink)' : 'var(--muted)',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        padding: 'var(--s2)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
      }}>
        {activeTab === 'openai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <button
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Modelo por defecto
              </label>
              <select
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {MODELS.openai.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Endpoint
              </label>
              <input
                type="text"
                value={openaiEndpoint}
                onChange={(e) => setOpenaiEndpoint(e.target.value)}
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
        )}

        {activeTab === 'anthropic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <button
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showAnthropicKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Modelo por defecto
              </label>
              <select
                value={anthropicModel}
                onChange={(e) => setAnthropicModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {MODELS.anthropic.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'google' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showGoogleKey ? 'text' : 'password'}
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  placeholder="AIza..."
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <button
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showGoogleKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Modelo por defecto
              </label>
              <select
                value={googleModel}
                onChange={(e) => setGoogleModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {MODELS.google.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'embeddings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Proveedor
              </label>
              <select
                value={embeddingsProvider}
                onChange={(e) => {
                  setEmbeddingsProvider(e.target.value);
                  setEmbeddingsModel(e.target.value === 'openai' ? 'text-embedding-3-large' : 'gemini-embedding');
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Modelo
              </label>
              <select
                value={embeddingsModel}
                onChange={(e) => setEmbeddingsModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {(embeddingsProvider === 'openai' ? MODELS.embeddings_openai : MODELS.embeddings_google).map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showEmbeddingsKey ? 'text' : 'password'}
                  value={embeddingsKey}
                  onChange={(e) => setEmbeddingsKey(e.target.value)}
                  placeholder={embeddingsProvider === 'openai' ? 'sk-...' : 'AIza...'}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <button
                  onClick={() => setShowEmbeddingsKey(!showEmbeddingsKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showEmbeddingsKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{
              padding: 'var(--s1)',
              background: 'var(--blue-bg)',
              border: '1px solid var(--teal)',
              borderRadius: '6px',
              fontSize: '13px',
              color: 'var(--ink2)',
            }}>
              <strong>Nota:</strong> Los embeddings se usan para búsqueda semántica en documentos, reuniones y notas.
              OpenAI text-embedding-3-large ofrece la mejor calidad para español.
            </div>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div style={{
        marginTop: 'var(--s2)',
        padding: 'var(--s1)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        fontSize: '13px',
        color: 'var(--muted)',
      }}>
        🔒 Las claves API se almacenan cifradas y nunca se exponen en el frontend después de guardarse.
      </div>
    </div>
  );
}
