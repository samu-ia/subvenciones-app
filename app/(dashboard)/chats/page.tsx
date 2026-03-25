'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Send, Paperclip, Search, X,
  Loader2, Bot, User, Building2, RefreshCw,
} from 'lucide-react';

interface Conversacion {
  nif: string;
  ultimo: string;
  preview: string;
  no_leidos: number;
  cliente: {
    nif: string;
    nombre_empresa?: string;
    nombre_normalizado?: string;
    ciudad?: string;
  };
}

interface Mensaje {
  id: string;
  remitente: 'cliente' | 'gestor' | 'ia';
  contenido: string;
  leido: boolean;
  created_at: string;
  adjunto_url?: string;
  adjunto_nombre?: string;
}

function fmtHora(s: string) {
  const d = new Date(s);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function fmtFechaCompleta(s: string) {
  return new Date(s).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ChatsPage() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [nifActivo, setNifActivo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargarConversaciones = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/gestor');
      if (res.ok) {
        const data = await res.json();
        setConversaciones(data.conversaciones ?? []);
      }
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const cargarMensajes = useCallback(async (nif: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/admin/gestor/${nif}`);
      if (res.ok) {
        const data = await res.json();
        setMensajes(data.mensajes ?? []);
        // Actualizar no_leidos a 0 en la lista
        setConversaciones(prev =>
          prev.map(c => c.nif === nif ? { ...c, no_leidos: 0 } : c)
        );
      }
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    cargarConversaciones();
    const interval = setInterval(cargarConversaciones, 30_000);
    return () => clearInterval(interval);
  }, [cargarConversaciones]);

  useEffect(() => {
    if (nifActivo) {
      cargarMensajes(nifActivo);
      const interval = setInterval(() => cargarMensajes(nifActivo), 15_000);
      return () => clearInterval(interval);
    }
  }, [nifActivo, cargarMensajes]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if ((!texto.trim() && !archivo) || enviando || !nifActivo) return;
    const contenido = texto.trim();
    setTexto('');
    setArchivo(null);
    setEnviando(true);

    // Optimistic
    const temp: Mensaje = {
      id: 'temp-' + Date.now(),
      remitente: 'gestor',
      contenido: contenido || (archivo ? `[Archivo: ${archivo.name}]` : ''),
      leido: false,
      created_at: new Date().toISOString(),
    };
    setMensajes(prev => [...prev, temp]);

    try {
      let body: FormData | string;
      let headers: Record<string, string> = {};

      if (archivo) {
        const fd = new FormData();
        if (contenido) fd.append('contenido', contenido);
        fd.append('adjunto', archivo);
        body = fd;
      } else {
        body = JSON.stringify({ contenido });
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(`/api/admin/gestor/${nifActivo}`, {
        method: 'POST',
        headers,
        body,
      });
      if (res.ok) {
        const data = await res.json();
        setMensajes(data.mensajes ?? []);
      }
    } catch {
      setMensajes(prev => prev.filter(m => m.id !== temp.id));
    } finally {
      setEnviando(false);
    }
  }

  const convsFiltradas = conversaciones.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    const nombre = (c.cliente.nombre_empresa ?? c.cliente.nombre_normalizado ?? c.nif).toLowerCase();
    return nombre.includes(q) || c.nif.toLowerCase().includes(q);
  });

  const convActiva = conversaciones.find(c => c.nif === nifActivo);
  const nombreActivo = convActiva
    ? (convActiva.cliente.nombre_empresa ?? convActiva.cliente.nombre_normalizado ?? convActiva.nif)
    : null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* ── Panel izquierdo: lista de conversaciones ── */}
      <div style={{
        width: 320, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--surface)',
      }}>
        {/* Cabecera */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              Chats con clientes
            </h2>
            <button
              onClick={cargarConversaciones}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6 }}
              title="Actualizar"
            >
              <RefreshCw size={15} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente..."
              style={{
                width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
                borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.83rem',
                background: 'var(--bg)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loadingConvs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={20} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : convsFiltradas.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              {busqueda ? 'Sin resultados' : 'No hay conversaciones aún'}
            </div>
          ) : (
            convsFiltradas.map(conv => {
              const nombre = conv.cliente.nombre_empresa ?? conv.cliente.nombre_normalizado ?? conv.nif;
              const activo = conv.nif === nifActivo;
              return (
                <button
                  key={conv.nif}
                  onClick={() => setNifActivo(conv.nif)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '13px 16px',
                    background: activo ? 'var(--blue-bg)' : 'transparent',
                    borderBottom: '1px solid var(--border)', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    borderLeft: activo ? '3px solid var(--blue)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: activo ? 'var(--blue)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Building2 size={16} color={activo ? '#fff' : 'var(--muted)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: conv.no_leidos > 0 ? 700 : 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {nombre}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0, marginLeft: 6 }}>
                          {fmtHora(conv.ultimo)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {conv.preview.slice(0, 60)}{conv.preview.length > 60 ? '...' : ''}
                        </span>
                        {conv.no_leidos > 0 && (
                          <span style={{
                            flexShrink: 0, marginLeft: 6, background: 'var(--blue)',
                            color: '#fff', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700,
                            padding: '1px 7px',
                          }}>
                            {conv.no_leidos}
                          </span>
                        )}
                      </div>
                      {conv.cliente.ciudad && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{conv.cliente.ciudad}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Panel derecho: chat activo ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', minWidth: 0 }}>
        {!nifActivo ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--muted)' }}>
            <MessageCircle size={48} color="var(--border)" />
            <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>Selecciona una conversación</p>
          </div>
        ) : (
          <>
            {/* Header chat */}
            <div style={{
              background: '#0d1f3c', padding: '14px 20px',
              display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: '#0d9488',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.2)',
              }}>
                <Building2 size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{nombreActivo}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: 0 }}>{nifActivo}</p>
              </div>
              <a
                href={`/clientes/${nifActivo}`}
                style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}
              >
                Ver ficha →
              </a>
            </div>

            {/* Mensajes */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadingMsgs ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={20} color="#0d9488" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : mensajes.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: '0.85rem' }}>
                  No hay mensajes aún. Sé el primero en escribir.
                </div>
              ) : (
                mensajes.map(m => {
                  const esGestor = m.remitente === 'gestor';
                  const esIA = m.remitente === 'ia';
                  return (
                    <div key={m.id} style={{
                      display: 'flex',
                      flexDirection: esGestor ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: 8,
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: esGestor ? '#0d9488' : esIA ? '#7c3aed' : '#e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {esGestor ? <User size={14} color="#fff" /> : esIA ? <Bot size={14} color="#fff" /> : <Building2 size={14} color="#94a3b8" />}
                      </div>

                      {/* Burbuja */}
                      <div style={{ maxWidth: '68%' }}>
                        <div style={{
                          background: esGestor ? '#0d9488' : esIA ? '#ede9fe' : '#fff',
                          color: esGestor ? '#fff' : esIA ? '#5b21b6' : '#0d1f3c',
                          padding: '10px 14px',
                          borderRadius: esGestor ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          fontSize: '0.875rem',
                          lineHeight: 1.5,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          border: esIA ? '1px solid #ddd6fe' : 'none',
                        }}>
                          {esIA && (
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Bot size={11} /> IA · respuesta automática
                            </div>
                          )}
                          {m.contenido}
                          {m.adjunto_url && (
                            <a
                              href={m.adjunto_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'block', marginTop: 6, fontSize: '0.78rem', color: esGestor ? 'rgba(255,255,255,0.85)' : '#0d9488', textDecoration: 'underline' }}
                            >
                              📎 {m.adjunto_nombre ?? 'Adjunto'}
                            </a>
                          )}
                        </div>
                        <p style={{
                          fontSize: '0.68rem', color: 'var(--muted)', margin: '3px 0 0',
                          textAlign: esGestor ? 'right' : 'left',
                        }}>
                          {fmtFechaCompleta(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ background: '#fff', borderTop: '1px solid var(--border)', padding: '12px 16px', flexShrink: 0 }}>
              {/* Archivo adjunto preseleccionado */}
              {archivo && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  padding: '6px 10px', background: '#eff6ff', borderRadius: 8,
                  border: '1px solid #bfdbfe',
                }}>
                  <Paperclip size={13} color="#3b82f6" />
                  <span style={{ fontSize: '0.8rem', color: '#1d4ed8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {archivo.name}
                  </span>
                  <button onClick={() => setArchivo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 2 }}>
                    <X size={13} />
                  </button>
                </div>
              )}

              <form onSubmit={enviar} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                {/* Botón adjuntar */}
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={e => setArchivo(e.target.files?.[0] ?? null)}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar archivo"
                  style={{
                    width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)',
                    background: archivo ? '#eff6ff' : 'var(--surface)',
                    color: archivo ? '#3b82f6' : 'var(--muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Paperclip size={17} />
                </button>

                {/* Textarea */}
                <textarea
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      enviar(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter nueva línea)"
                  disabled={enviando}
                  rows={1}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 12,
                    border: '1.5px solid var(--border)', fontSize: '0.875rem',
                    fontFamily: 'inherit', outline: 'none', resize: 'none',
                    background: enviando ? '#f8fafc' : '#fff', color: 'var(--ink)',
                    lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                  }}
                />

                {/* Enviar */}
                <button
                  type="submit"
                  disabled={(!texto.trim() && !archivo) || enviando}
                  style={{
                    width: 42, height: 40, borderRadius: 10, border: 'none', flexShrink: 0,
                    background: (!texto.trim() && !archivo) || enviando ? 'var(--border)' : '#0d9488',
                    cursor: (!texto.trim() && !archivo) || enviando ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {enviando
                    ? <Loader2 size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                    : <Send size={16} color="#fff" />
                  }
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
