'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, FileText, CheckSquare, Search, Mail, AlertCircle } from 'lucide-react';
import DeepSearchModal from './DeepSearchModal';

interface Mensaje {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  documentos?: string[];
  timestamp: Date;
}

interface AccionRapida {
  id: string;
  nombre: string;
  descripcion: string;
  icono: React.ReactNode;
  prompt: string;
}

interface AIPanelProps {
  contextoId: string;
  contextoTipo: 'reunion' | 'expediente';
  documentos: Array<{ id: string; nombre: string }>;
  clienteNombre?: string;
  onGenerarDocumento?: (nombre: string, contenido: string, prompt: string) => void;
}

const ACCIONES_RAPIDAS: AccionRapida[] = [
  {
    id: 'resumen',
    nombre: 'Resumen',
    descripcion: 'Resume el expediente/reunión',
    icono: <FileText size={16} />,
    prompt: 'Resume toda la información disponible de forma estructurada y clara.'
  },
  {
    id: 'info-faltante',
    nombre: 'Info faltante',
    descripcion: 'Detecta qué información falta',
    icono: <AlertCircle size={16} />,
    prompt: 'Analiza qué información o documentación importante falta o debería completarse.'
  },
  {
    id: 'checklist',
    nombre: 'Checklist',
    descripcion: 'Genera lista de tareas',
    icono: <CheckSquare size={16} />,
    prompt: 'Genera un checklist detallado con todas las tareas pendientes y pasos a seguir.'
  },
  {
    id: 'email',
    nombre: 'Email',
    descripcion: 'Borrador de seguimiento',
    icono: <Mail size={16} />,
    prompt: 'Redacta un email profesional de seguimiento al cliente con los próximos pasos.'
  }
];

export default function AIPanel({
  contextoId,
  contextoTipo,
  documentos,
  clienteNombre,
  onGenerarDocumento
}: AIPanelProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBusquedaProfunda, setShowBusquedaProfunda] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  const procesarReferencias = (texto: string) => {
    // Detectar @documento y mostrar sugerencias
    const matches = texto.match(/@(\w+)/g);
    return matches || [];
  };

  const enviarMensaje = async (mensaje?: string) => {
    const textoFinal = mensaje || input;
    if (!textoFinal.trim() || loading) return;

    const referencias = procesarReferencias(textoFinal);
    const docsReferenciados = documentos
      .filter(doc => referencias.some(ref => doc.nombre.toLowerCase().includes(ref.substring(1).toLowerCase())))
      .map(doc => doc.id);

    const nuevoMensaje: Mensaje = {
      id: Date.now().toString(),
      role: 'user',
      content: textoFinal,
      documentos: docsReferenciados,
      timestamp: new Date()
    };

    setMensajes(prev => [...prev, nuevoMensaje]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextoId,
          contextoTipo,
          mensaje: textoFinal,
          documentosReferenciados: docsReferenciados,
          historial: mensajes.slice(-10) // Últimos 10 mensajes como contexto
        })
      });

      if (!response.ok) throw new Error('Error en la respuesta');

      const data = await response.json();
      
      const respuesta: Mensaje = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.respuesta,
        timestamp: new Date()
      };

      setMensajes(prev => [...prev, respuesta]);

      // Si la respuesta sugiere crear un documento, preguntar al usuario
      if (data.sugerirDocumento && onGenerarDocumento) {
        const crear = confirm('¿Deseas guardar esta respuesta como documento?');
        if (crear) {
          const nombre = prompt('Nombre del documento:', data.nombreSugerido || 'Documento IA');
          if (nombre) {
            onGenerarDocumento(nombre, data.respuesta, textoFinal);
          }
        }
      }

    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const ejecutarAccionRapida = (accion: AccionRapida) => {
    enviarMensaje(accion.prompt);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--card)'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px'
        }}>
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>
            Asistente IA
          </h3>
        </div>

        {/* Acciones Rápidas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px'
        }}>
          {ACCIONES_RAPIDAS.map(accion => (
            <button
              key={accion.id}
              onClick={() => ejecutarAccionRapida(accion)}
              disabled={loading}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--background)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                opacity: loading ? 0.5 : 1
              }}
              title={accion.descripcion}
            >
              {accion.icono}
              {accion.nombre}
            </button>
          ))}
        </div>

        {/* Búsqueda Profunda */}
        <button
          onClick={() => setShowBusquedaProfunda(true)}
          disabled={loading}
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid var(--primary)',
            backgroundColor: 'var(--primary)',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: '500',
            opacity: loading ? 0.5 : 1
          }}
        >
          <Search size={16} />
          Búsqueda en profundidad
        </button>
      </div>

      {/* Chat Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {mensajes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--muted-foreground)',
            fontSize: '13px',
            marginTop: '40px'
          }}>
            <Sparkles size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>Pregunta lo que necesites sobre este {contextoTipo}</p>
            <p style={{ fontSize: '11px', marginTop: '8px' }}>
              Usa @ para mencionar documentos
            </p>
          </div>
        ) : (
          mensajes.map(mensaje => (
            <div
              key={mensaje.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                alignItems: mensaje.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: mensaje.role === 'user' ? 'var(--primary)' : 'var(--accent)',
                color: mensaje.role === 'user' ? 'white' : 'var(--foreground)',
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                {mensaje.content}
              </div>
              {mensaje.documentos && mensaje.documentos.length > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>
                  📎 {mensaje.documentos.length} documento(s) referenciado(s)
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--muted-foreground)',
            fontSize: '13px'
          }}>
            <div className="loading-dots">
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </div>
            Pensando...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--border)'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarMensaje();
              }
            }}
            placeholder="Pregunta algo..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            onClick={() => enviarMensaje()}
            disabled={loading || !input.trim()}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: 'white',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              opacity: loading || !input.trim() ? 0.5 : 1
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Modal de Búsqueda Profunda */}
      <DeepSearchModal
        contextoId={contextoId}
        contextoTipo={contextoTipo}
        clienteNombre={clienteNombre}
        isOpen={showBusquedaProfunda}
        onClose={() => setShowBusquedaProfunda(false)}
        onGenerar={(nombre, contenido, prompt) => {
          if (onGenerarDocumento) {
            onGenerarDocumento(nombre, contenido, prompt);
          }
          setShowBusquedaProfunda(false);
        }}
      />

      <style jsx>{`
        .loading-dots {
          display: flex;
          gap: 4px;
        }
        .loading-dots span {
          animation: pulse 1.4s ease-in-out infinite;
        }
        .loading-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .loading-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
