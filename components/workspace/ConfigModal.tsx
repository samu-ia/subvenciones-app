'use client';

import { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff } from 'lucide-react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConfigModal({ isOpen, onClose }: ConfigModalProps) {
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Cargar configuración actual
      const saved = localStorage.getItem('openai_api_key');
      if (saved) setOpenaiKey(saved);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      // Guardar en localStorage
      if (openaiKey.trim()) {
        localStorage.setItem('openai_api_key', openaiKey.trim());
        setMessage('✓ Configuración guardada correctamente');
      } else {
        localStorage.removeItem('openai_api_key');
        setMessage('✓ API Key eliminada');
      }

      setTimeout(() => {
        setMessage('');
      }, 3000);
    } catch (error) {
      setMessage('✗ Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>⚙️ Configuración de IA</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--muted-foreground)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>
            OpenAI API Key
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                width: '100%',
                padding: '10px 40px 10px 12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--muted-foreground)',
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '6px', marginBottom: 0 }}>
            Esta clave se guarda localmente en tu navegador. Obtén una en{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'underline' }}
            >
              platform.openai.com
            </a>
          </p>
        </div>

        {/* Info adicional */}
        <div
          style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '12px',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>💡 Funciones de IA:</p>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Chat contextual sobre expedientes y reuniones</li>
            <li>Generación automática de resúmenes</li>
            <li>Detección de información faltante</li>
            <li>Creación de checklists</li>
            <li>Generación de emails profesionales</li>
            <li>Búsqueda profunda con investigación</li>
          </ul>
        </div>

        {/* Message */}
        {message && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              backgroundColor: message.startsWith('✓') ? '#d4edda' : '#f8d7da',
              color: message.startsWith('✓') ? '#155724' : '#721c24',
              border: `1px solid ${message.startsWith('✓') ? '#c3e6cb' : '#f5c6cb'}`,
            }}
          >
            {message}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
