'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell, RefreshCw, Loader2, Zap, Clock, CheckCircle,
  Building2, ChevronRight, Send, TrendingUp, FileText,
  AlertCircle, X,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SolicitudReciente {
  id: string;
  nif: string;
  estado: string;
  encaje_score: number | null;
  contrato_firmado: boolean;
  metodo_pago_ok: boolean;
  informe_viabilidad: string | null;
  created_at: string;
  subvencion: { id: string; titulo: string; organismo?: string; importe_maximo?: number; estado_convocatoria: string } | null;
  cliente: { nombre_empresa?: string; nombre_normalizado?: string; ciudad?: string; comunidad_autonoma?: string } | null;
}

interface MatchPendiente {
  id: string;
  nif: string;
  score: number;
  motivos: string[];
  estado: string;
  notificado_cliente: boolean;
  created_at: string;
  subvencion: { id: string; titulo: string; organismo?: string; importe_maximo?: number; plazo_fin?: string; estado_convocatoria: string } | null;
  cliente: { nombre_empresa?: string; nombre_normalizado?: string; ciudad?: string; comunidad_autonoma?: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtE(n?: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n} €`;
}
function scoreColor(s: number) {
  if (s >= 0.65) return { color: '#f97316', bg: '#fff7ed' };
  if (s >= 0.40) return { color: '#059669', bg: '#ecfdf5' };
  return { color: '#94a3b8', bg: '#f8fafc' };
}

const ESTADO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pendiente_encaje:   { label: 'Pendiente encaje',  color: '#92400e', bg: '#fffbeb' },
  encaje_confirmado:  { label: 'Encaje OK',          color: '#1d4ed8', bg: '#eff6ff' },
  contrato_pendiente: { label: 'Contrato pendiente', color: '#6d28d9', bg: '#f5f3ff' },
  contrato_firmado:   { label: 'Contrato firmado',  color: '#065f46', bg: '#ecfdf5' },
  pago_pendiente:     { label: 'Pago pendiente',    color: '#9a3412', bg: '#fff7ed' },
  activo:             { label: 'Activo',             color: '#065f46', bg: '#ecfdf5' },
  rechazado:          { label: 'Rechazado',          color: '#991b1b', bg: '#fef2f2' },
};

// ─── Modal informe ─────────────────────────────────────────────────────────────

function ModalInforme({ informe, onClose }: { informe: string; onClose: () => void }) {
  let data: Record<string, unknown> | null = null;
  try { data = JSON.parse(informe); } catch { /* not JSON */ }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0d1f3c' }}>Informe de Viabilidad IA</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>
        {data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Score */}
            {data.puntuacion_encaje != null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: Number(data.puntuacion_encaje) >= 70 ? '#ecfdf5' : '#fff7ed', border: `3px solid ${Number(data.puntuacion_encaje) >= 70 ? '#059669' : '#d97706'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, color: Number(data.puntuacion_encaje) >= 70 ? '#059669' : '#d97706' }}>
                  {data.puntuacion_encaje as number}%
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0d1f3c' }}>Puntuación de encaje</div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>{String(data.recomendacion_motivo ?? '')}</div>
                </div>
              </div>
            ) : null}
            {/* Resumen */}
            {data.resumen_ejecutivo ? (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Resumen ejecutivo</div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>{String(data.resumen_ejecutivo)}</p>
              </div>
            ) : null}
            {/* Puntos fuertes */}
            {Array.isArray(data.puntos_fuertes) && data.puntos_fuertes.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Puntos fuertes</div>
                {(data.puntos_fuertes as string[]).map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <CheckCircle size={14} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: '0.83rem', color: '#334155' }}>{p}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Puntos de atención */}
            {Array.isArray(data.puntos_atencion) && data.puntos_atencion.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Puntos de atención</div>
                {(data.puntos_atencion as string[]).map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <AlertCircle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: '0.83rem', color: '#334155' }}>{p}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Pasos siguientes */}
            {Array.isArray(data.pasos_siguientes) && data.pasos_siguientes.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Pasos siguientes</div>
                {(data.pasos_siguientes as string[]).map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: '0.83rem', color: '#334155' }}>{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <pre style={{ fontSize: '0.78rem', color: '#475569', whiteSpace: 'pre-wrap' }}>{informe}</pre>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function NovedadesPage() {
  const [data, setData] = useState<{ solicitudes: SolicitudReciente[]; matches_pendientes: MatchPendiente[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificando, setNotificando] = useState<string | null>(null);
  const [modalInforme, setModalInforme] = useState<string | null>(null);
  const [tab, setTab] = useState<'solicitudes' | 'oportunidades'>('solicitudes');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/novedades');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function notificarCliente(matchId: string) {
    setNotificando(matchId);
    await fetch(`/api/admin/novedades/${matchId}/notificar`, { method: 'POST' });
    await cargar();
    setNotificando(null);
  }

  const solicitudes = data?.solicitudes ?? [];
  const oportunidades = data?.matches_pendientes ?? [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f97316, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0d1f3c' }}>Novedades</h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
            Solicitudes recientes y oportunidades de alto encaje sin gestionar
          </p>
        </div>
        <button onClick={cargar} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.8rem', cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}>
          <RefreshCw size={13} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #f1f5f9', paddingBottom: 0 }}>
        {[
          { key: 'solicitudes' as const, label: 'Solicitudes recientes', count: solicitudes.length, icon: <FileText size={14} /> },
          { key: 'oportunidades' as const, label: 'Oportunidades pendientes', count: oportunidades.length, icon: <TrendingUp size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', borderRadius: '8px 8px 0 0',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '0.83rem', fontWeight: tab === t.key ? 700 : 500,
            background: tab === t.key ? '#fff' : 'transparent',
            color: tab === t.key ? '#0d1f3c' : '#94a3b8',
            borderBottom: tab === t.key ? '2px solid #1d4ed8' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {t.icon}
            {t.label}
            {t.count > 0 && (
              <span style={{ background: tab === t.key ? '#eff6ff' : '#f1f5f9', color: tab === t.key ? '#1d4ed8' : '#94a3b8', borderRadius: 20, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : tab === 'solicitudes' ? (
        // ── SOLICITUDES ──────────────────────────────────────────────────────
        solicitudes.length === 0 ? (
          <Empty text="No hay solicitudes en los últimos 7 días" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #e8ecf4', borderRadius: 12, overflow: 'hidden' }}>
            {solicitudes.map((s, i) => {
              const badge = ESTADO_LABEL[s.estado] ?? { label: s.estado, color: '#374151', bg: '#f3f4f6' };
              const nombreCliente = s.cliente?.nombre_empresa || s.cliente?.nombre_normalizado || s.nif;
              return (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: '32px 1.8fr 2fr 130px 80px 80px 32px',
                  gap: 12, padding: '14px 16px', alignItems: 'center',
                  borderBottom: i < solicitudes.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: '#fff',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={13} color="#1d4ed8" />
                  </div>
                  {/* Cliente */}
                  <div>
                    <Link href={`/clientes/${s.nif}`} style={{ textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, color: '#0d1f3c' }}>{nombreCliente}</Link>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{s.nif}{s.cliente?.ciudad ? ` · ${s.cliente.ciudad}` : ''}</div>
                  </div>
                  {/* Subvención */}
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.subvencion?.titulo ?? '—'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {s.subvencion?.organismo ?? '—'}
                      {s.subvencion?.importe_maximo ? ` · ${fmtE(s.subvencion.importe_maximo)}` : ''}
                    </div>
                  </div>
                  {/* Estado */}
                  <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600, backgroundColor: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.label}</span>
                  {/* Informe */}
                  {s.informe_viabilidad ? (
                    <button onClick={() => setModalInforme(s.informe_viabilidad)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#1d4ed8', fontFamily: 'inherit' }}>
                      <FileText size={11} /> Informe
                    </button>
                  ) : <span />}
                  {/* Fecha */}
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{fmt(s.created_at)}</div>
                  {/* Link */}
                  <Link href={`/solicitudes`} style={{ color: '#cbd5e1' }}><ChevronRight size={14} /></Link>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // ── OPORTUNIDADES ─────────────────────────────────────────────────────
        oportunidades.length === 0 ? (
          <Empty text="No hay oportunidades pendientes de notificar" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {oportunidades.map(m => {
              const sc = scoreColor(m.score);
              const nombreCliente = m.cliente?.nombre_empresa || m.cliente?.nombre_normalizado || m.nif;
              const diasRestantes = m.subvencion?.plazo_fin
                ? Math.ceil((new Date(m.subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000)
                : null;
              return (
                <div key={m.id} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Score */}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: sc.bg, border: `2px solid ${sc.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: sc.color, flexShrink: 0 }}>
                    {Math.round(m.score * 100)}%
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                      <div>
                        <Link href={`/clientes/${m.nif}`} style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0d1f3c', textDecoration: 'none' }}>{nombreCliente}</Link>
                        <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#94a3b8' }}>{m.nif}</span>
                      </div>
                      {diasRestantes !== null && diasRestantes > 0 && (
                        <span style={{ fontSize: '0.72rem', color: diasRestantes < 14 ? '#dc2626' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          <Clock size={11} /> {diasRestantes}d
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 500, color: '#334155', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.subvencion?.titulo ?? '—'}
                    </div>
                    {/* Motivos match */}
                    {m.motivos?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {m.motivos.slice(0, 4).map((mot, i) => (
                          <span key={i} style={{ padding: '2px 8px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: 500 }}>{mot}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => notificarCliente(m.id)}
                        disabled={notificando === m.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: notificando === m.id ? 'not-allowed' : 'pointer', background: '#0d9488', color: '#fff', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit' }}>
                        {notificando === m.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
                        Notificar al cliente
                      </button>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {m.subvencion?.importe_maximo ? (
                          <><Zap size={11} /> hasta {fmtE(m.subvencion.importe_maximo)}</>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal informe */}
      {modalInforme && <ModalInforme informe={modalInforme} onClose={() => setModalInforme(null)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0', border: '2px dashed #e8ecf4', borderRadius: 16 }}>
      <Bell size={36} color="#e2e8f0" />
      <p style={{ color: '#94a3b8', marginTop: 12, fontSize: '0.9rem' }}>{text}</p>
    </div>
  );
}
