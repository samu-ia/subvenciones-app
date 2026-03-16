'use client';

import { useState } from 'react';
import { Search, X, Sparkles } from 'lucide-react';

interface DeepSearchModalProps {
  contextoId: string;
  contextoTipo: 'reunion' | 'expediente';
  clienteNombre?: string;
  isOpen: boolean;
  onClose: () => void;
  onGenerar: (nombreDoc: string, contenido: string, prompt: string) => void;
}

export default function DeepSearchModal({
  contextoId,
  contextoTipo,
  clienteNombre,
  isOpen,
  onClose,
  onGenerar
}: DeepSearchModalProps) {
  const [prompt, setPrompt] = useState(
    `Realiza una investigación profunda sobre oportunidades de financiación, subvenciones y ayudas públicas relevantes para ${clienteNombre || 'este cliente'}.\n\nAnaliza:\n- Subvenciones activas o próximas a abrirse\n- Requisitos y criterios de elegibilidad\n- Plazos y documentación necesaria\n- Cuantías y porcentajes de financiación\n- Recomendaciones específicas`
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerar = async () => {
    if (!prompt.trim()) {
      setError('El prompt no puede estar vacío');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ia/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextoId,
          contextoTipo,
          tipo: 'busqueda_profunda',
          prompt,
          nombreDocumento: `Búsqueda profunda - ${new Date().toLocaleDateString('es-ES')}`
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al generar búsqueda');
      }

      const data = await response.json();
      
      // Notificar al componente padre
      onGenerar(data.documento.nombre, data.contenido, prompt);
      
      // Cerrar modal
      onClose();
      
      // Reset
      setPrompt('');
      
    } catch (err: any) {
      console.error('Error en búsqueda profunda:', err);
      setError(err.message || 'Error al generar la búsqueda');
    } finally {
      setLoading(false);
    }
  };

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
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--card)',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Search size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                Búsqueda en Profundidad
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '4px 0 0 0' }}>
                Investigación avanzada con IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          flex: 1,
          overflowY: 'auto'
        }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            marginBottom: '8px',
            color: 'var(--foreground)'
          }}>
            Instrucciones para la IA
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            placeholder="Describe qué tipo de información necesitas investigar..."
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '14px',
              lineHeight: '1.6',
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none'
            }}
          />

          {error && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: 'var(--destructive)',
              color: 'white',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          <div style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: 'var(--accent)',
            fontSize: '12px',
            lineHeight: '1.5',
            color: 'var(--muted-foreground)'
          }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
              <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>La IA investigará:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                  <li>Oportunidades de financiación relevantes</li>
                  <li>Requisitos y criterios de elegibilidad</li>
                  <li>Plazos y documentación necesaria</li>
                  <li>Recomendaciones personalizadas</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--foreground)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: loading ? 0.5 : 1
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerar}
            disabled={loading || !prompt.trim()}
            style={{
              padding: '10px 24px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: 'white',
              cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: loading || !prompt.trim() ? 0.5 : 1
            }}
          >
            {loading ? (
              <>
                <div className="spinner" />
                Generando...
              </>
            ) : (
              <>
                <Search size={16} />
                Generar Búsqueda
              </>
            )}
          </button>
        </div>

        <style jsx>{`
          .spinner {
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
