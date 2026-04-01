'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  MessageCircle, Send, Paperclip, Search, X,
  Loader2, Bot, User, Building2, RefreshCw,
  FileText, Zap, Clock, CreditCard,
  AlertTriangle, CheckCircle, Info,
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

interface ContextoCliente {
  empresa: {
    nombre: string;
    actividad: string | null;
    tamano: string | null;
    empleados: number | null;
    facturacion: number | null;
    ccaa: string | null;
    ciudad: string | null;
    provincia: string | null;
    forma_juridica: string | null;
  } | null;
  matches: Array<{
    id: string;
    titulo: string;
    score: number;
    estado: string;
    organismo: string;
    importe_maximo: number | null;
    plazo_fin: string | null;
    dias_restantes: number | null;
  }>;
  expedientes: Array<{
    id: string;
    titulo: string;
    fase: string;
    fase_label: string;
    estado: string;
    plazo_solicitud: string | null;
    dias_restantes: number | null;
    fee_amount: number | null;
    fee_estado: string | null;
  }>;
  solicitudes: Array<{
    id: string;
    titulo: string;
    estado: string;
  }>;
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

function fmtImporte(n: number) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' \u20ac';
}

/* ── Panel lateral de contexto del cliente ─────────────────────────────── */
function PanelContexto({ contexto, nif: _nif }: { contexto: ContextoCliente | null; nif: string }) {
  const [expandido, setExpandido] = useState(true);

  if (!contexto) {
    return (
      <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--border)', background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Loader2 size={18} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const { empresa, matches, expedientes, solicitudes } = contexto;

  const estadoColors: Record<string, { bg: string; fg: string }> = {
    pendiente: { bg: '#fef3c7', fg: '#92400e' },
    interesado: { bg: '#e0f2fe', fg: '#1e40af' },
    solicitando: { bg: '#ede9fe', fg: '#5b21b6' },
    concedida: { bg: '#dcfce7', fg: '#166534' },
    descartado: { bg: '#fee2e2', fg: '#991b1b' },
  };

  return (
    <div style={{
      width: expandido ? 300 : 40, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: '#fafbfc', display: 'flex', flexDirection: 'column', transition: 'width 0.2s',
      overflow: 'hidden',
    }}>
      {/* Toggle */}
      <button
        onClick={() => setExpandido(!expandido)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '12px 10px',
          display: 'flex', alignItems: 'center', justifyContent: expandido ? 'space-between' : 'center',
          borderBottom: '1px solid var(--border)', color: 'var(--ink)', fontFamily: 'inherit',
        }}
      >
        {expandido && <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Contexto del cliente</span>}
        <Info size={15} color="var(--muted)" />
      </button>

      {expandido && (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>

          {/* Datos de empresa */}
          {empresa && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Empresa
              </div>
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 12px', fontSize: '0.8rem', lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{empresa.nombre}</div>
                {empresa.actividad && <div style={{ color: 'var(--muted)' }}>{empresa.actividad}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 6 }}>
                  {empresa.tamano && <span style={{ fontSize: '0.72rem', color: 'var(--ink)', background: '#f0f0f0', padding: '1px 6px', borderRadius: 4 }}>{empresa.tamano}</span>}
                  {empresa.empleados && <span style={{ fontSize: '0.72rem', color: 'var(--ink)', background: '#f0f0f0', padding: '1px 6px', borderRadius: 4 }}>{empresa.empleados} emp.</span>}
                  {empresa.ccaa && <span style={{ fontSize: '0.72rem', color: 'var(--ink)', background: '#f0f0f0', padding: '1px 6px', borderRadius: 4 }}>{empresa.ccaa}</span>}
                  {empresa.forma_juridica && <span style={{ fontSize: '0.72rem', color: 'var(--ink)', background: '#f0f0f0', padding: '1px 6px', borderRadius: 4 }}>{empresa.forma_juridica}</span>}
                </div>
                {empresa.facturacion && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
                    Fact.: {fmtImporte(empresa.facturacion)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expedientes */}
          {expedientes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <FileText size={11} /> Expedientes ({expedientes.length})
              </div>
              {expedientes.map(exp => (
                <div key={exp.id} style={{
                  background: '#fff', borderRadius: 8, border: '1px solid var(--border)',
                  padding: '8px 10px', marginBottom: 6, fontSize: '0.78rem',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.4 }}>
                    {exp.titulo}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      background: exp.fase === 'cobro' ? '#dcfce7' : exp.fase === 'presentacion' ? '#fef3c7' : '#e0f2fe',
                      color: exp.fase === 'cobro' ? '#166534' : exp.fase === 'presentacion' ? '#92400e' : '#1e40af',
                      padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700,
                    }}>
                      {exp.fase_label}
                    </span>
                    {exp.dias_restantes !== null && exp.dias_restantes <= 14 && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        background: exp.dias_restantes <= 3 ? '#fef2f2' : '#fffbeb',
                        color: exp.dias_restantes <= 3 ? '#991b1b' : '#92400e',
                        padding: '1px 6px', borderRadius: 8, fontSize: '0.68rem', fontWeight: 700,
                      }}>
                        <AlertTriangle size={9} />
                        {exp.dias_restantes <= 0 ? 'Vencido' : `${exp.dias_restantes}d`}
                      </span>
                    )}
                    {exp.fee_amount && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        fontSize: '0.68rem', color: 'var(--muted)',
                      }}>
                        <CreditCard size={9} />
                        Fee: {fmtImporte(exp.fee_amount)} ({exp.fee_estado ?? 'pendiente'})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Matches */}
          {matches.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={11} /> Matches ({matches.length})
              </div>
              {matches.map(match => {
                const colores = estadoColors[match.estado] ?? { bg: '#f0f0f0', fg: '#555' };
                return (
                  <div key={match.id} style={{
                    background: '#fff', borderRadius: 8, border: '1px solid var(--border)',
                    padding: '8px 10px', marginBottom: 6, fontSize: '0.78rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, flex: 1 }}>
                        {match.titulo}
                      </span>
                      <span style={{
                        flexShrink: 0, fontSize: '0.7rem', fontWeight: 800,
                        color: match.score >= 70 ? '#166534' : match.score >= 50 ? '#92400e' : 'var(--muted)',
                      }}>
                        {match.score}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        background: colores.bg, color: colores.fg,
                        padding: '1px 7px', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600,
                      }}>
                        {match.estado}
                      </span>
                      {match.importe_maximo && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                          Hasta {fmtImporte(match.importe_maximo)}
                        </span>
                      )}
                      {match.dias_restantes !== null && match.dias_restantes <= 14 && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          color: match.dias_restantes <= 7 ? '#991b1b' : '#92400e',
                          fontSize: '0.68rem', fontWeight: 600,
                        }}>
                          <Clock size={9} />
                          {match.dias_restantes <= 0 ? 'Vencido' : `${match.dias_restantes}d`}
                        </span>
                      )}
                    </div>
                    {match.organismo && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 3 }}>
                        {match.organismo}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Solicitudes */}
          {solicitudes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={11} /> Solicitudes ({solicitudes.length})
              </div>
              {solicitudes.map(sol => (
                <div key={sol.id} style={{
                  background: '#fff', borderRadius: 8, border: '1px solid var(--border)',
                  padding: '7px 10px', marginBottom: 4, fontSize: '0.76rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                }}>
                  <span style={{ color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sol.titulo}
                  </span>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 600,
                    color: sol.estado === 'completada' ? '#166534' : '#92400e',
                  }}>
                    {sol.estado}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Sin datos */}
          {!empresa && matches.length === 0 && expedientes.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem', padding: '30px 10px' }}>
              Sin datos de contexto para este cliente
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Página principal ──────────────────────────────────────────────────── */
export default function ChatsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [nifActivo, setNifActivo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [contextoCliente, setContextoCliente] = useState<ContextoCliente | null>(null);
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
        if (data.contexto_cliente) setContextoCliente(data.contexto_cliente);
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
  }, [cargarConversaciones]);

  useEffect(() => {
    if (nifActivo) {
      setContextoCliente(null);
      cargarMensajes(nifActivo);
    }
  }, [nifActivo, cargarMensajes]);

  // Realtime: mensajes entrantes del cliente en la conversación activa
  useEffect(() => {
    if (!nifActivo) return;
    const channel = supabase
      .channel(`chat-admin-${nifActivo}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes_gestor',
        filter: `nif=eq.${nifActivo}`,
      }, (payload) => {
        const nuevo = payload.new as Mensaje;
        // No duplicar mensajes optimistas del gestor (ya los añadimos al enviar)
        if (nuevo.remitente === 'cliente' || nuevo.remitente === 'ia') {
          setMensajes(prev => prev.some(m => m.id === nuevo.id) ? prev : [...prev, nuevo]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [nifActivo, supabase]);

  // Realtime: actualizar lista de conversaciones cuando llega un mensaje nuevo (cualquier cliente)
  useEffect(() => {
    const channel = supabase
      .channel('chat-admin-convs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes_gestor',
      }, (payload) => {
        const msg = payload.new as { nif: string; contenido: string; created_at: string; remitente: string };
        if (msg.remitente !== 'cliente') return;
        setConversaciones(prev => {
          const idx = prev.findIndex(c => c.nif === msg.nif);
          if (idx === -1) {
            // Nueva conversación — recargar lista completa
            cargarConversaciones();
            return prev;
          }
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            ultimo: msg.created_at,
            preview: msg.contenido.slice(0, 80),
            no_leidos: msg.nif === nifActivo ? 0 : (updated[idx].no_leidos ?? 0) + 1,
          };
          // Mover conversación al top
          const [conv] = updated.splice(idx, 1);
          return [conv, ...updated];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, nifActivo, cargarConversaciones]);

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
      const headers: Record<string, string> = {};

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

      {/* ── Panel central: chat activo ── */}
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
                              {m.adjunto_nombre ?? 'Adjunto'}
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

      {/* ── Panel derecho: contexto del cliente ── */}
      {nifActivo && (
        <PanelContexto contexto={contextoCliente} nif={nifActivo} />
      )}
    </div>
  );
}
