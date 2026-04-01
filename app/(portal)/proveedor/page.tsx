'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LogOut, Store, Briefcase, FileText, CheckCircle,
  Clock, Euro, AlertTriangle, Star, Globe, Mail,
  ChevronRight, Package, TrendingUp, RefreshCw,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Proveedor {
  id: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  servicios?: string[];
  web?: string;
  contacto_email?: string;
  contacto_nombre?: string;
  disponible: boolean;
  bio?: string;
  anos_experiencia?: number;
}

interface AsignacionExpediente {
  id: string;
  expediente_id: string;
  estado: string;
  motivo_match?: string;
  propuesta_texto?: string;
  expediente: {
    id: string;
    titulo?: string;
    organismo?: string;
    fase?: string;
    importe_solicitado?: number;
    importe_concedido?: number;
    nif: string;
    cliente: { nombre_normalizado?: string | null }[];
  };
}

interface Presupuesto {
  id: string;
  titulo: string;
  importe?: number;
  estado: string;
  fecha_solicitud: string;
  expediente?: { titulo?: string };
}

interface Contrato {
  id: string;
  titulo: string;
  importe?: number;
  estado: string;
  fecha_firma?: string;
  fee_proveedor_importe?: number;
  fee_proveedor_estado?: string;
  fee_activo: boolean;
  expediente?: { titulo?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const S = {
  navy: '#0d1f3c', teal: '#0d9488', bg: '#f8fafc',
  border: '#e8ecf4', muted: '#94a3b8', green: '#059669',
  amber: '#d97706', red: '#dc2626',
};

function fmtE(n?: number | null) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k €`;
  return `${n.toLocaleString('es-ES')} €`;
}

function fmtFecha(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FASE_LABEL: Record<string, { label: string; color: string }> = {
  preparacion: { label: 'Preparación', color: '#6366f1' },
  presentada: { label: 'Presentada', color: '#3b82f6' },
  instruccion: { label: 'Instrucción', color: '#8b5cf6' },
  resolucion_provisional: { label: 'Res. Provisional', color: '#f59e0b' },
  alegaciones: { label: 'Alegaciones', color: '#f97316' },
  resolucion_definitiva: { label: 'Res. Definitiva', color: '#10b981' },
  aceptacion: { label: 'Aceptación', color: '#ef4444' },
  ejecucion: { label: 'Ejecución', color: '#06b6d4' },
  justificacion: { label: 'Justificación', color: '#6366f1' },
  cobro: { label: 'Cobrado', color: '#22c55e' },
  denegada: { label: 'Denegada', color: '#94a3b8' },
  desistida: { label: 'Desistida', color: '#94a3b8' },
};

const ESTADO_PRESUPUESTO: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: '#d97706', bg: '#fffbeb' },
  enviado: { label: 'Enviado', color: '#2563eb', bg: '#eff6ff' },
  aprobado: { label: 'Aprobado', color: '#059669', bg: '#ecfdf5' },
  rechazado: { label: 'Rechazado', color: '#dc2626', bg: '#fef2f2' },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PortalProveedorPage() {
  const router = useRouter();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionExpediente[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'expedientes' | 'presupuestos' | 'contratos'>('expedientes');
  const [savingDisponible, setSavingDisponible] = useState(false);

  async function cargar() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    // Verificar que es proveedor
    const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).maybeSingle();
    if (!perfil || perfil.rol !== 'proveedor') {
      // Redirigir al portal de cliente si no es proveedor
      router.push('/portal');
      return;
    }

    // Cargar datos del proveedor vinculado al user
    const { data: prov } = await supabase.from('proveedores').select('*').eq('user_id', user.id).maybeSingle();
    if (!prov) {
      setLoading(false);
      return;
    }
    setProveedor(prov);

    const [{ data: asig }, { data: pres }, { data: cont }] = await Promise.all([
      supabase.from('expediente_proveedores')
        .select('id, expediente_id, estado, motivo_match, propuesta_texto, expediente:expediente(id, titulo, organismo, fase, importe_solicitado, importe_concedido, nif, cliente:cliente(nombre_normalizado))')
        .eq('proveedor_id', prov.id)
        .order('created_at', { ascending: false }),
      supabase.from('presupuestos')
        .select('id, titulo, importe, estado, fecha_solicitud, expediente:expediente(titulo)')
        .eq('proveedor_id', prov.id)
        .order('fecha_solicitud', { ascending: false }),
      supabase.from('contratos')
        .select('id, titulo, importe, estado, fecha_firma, fee_proveedor_importe, fee_proveedor_estado, fee_activo, expediente:expediente(titulo)')
        .eq('proveedor_id', prov.id)
        .order('created_at', { ascending: false }),
    ]);

    setAsignaciones((asig ?? []).map((a: { expediente: unknown; [k: string]: unknown }) => ({
      ...a,
      expediente: Array.isArray(a.expediente) ? a.expediente[0] : a.expediente,
    })));
    setPresupuestos((pres ?? []).map((p: { expediente: unknown; [k: string]: unknown }) => ({
      ...p,
      expediente: Array.isArray(p.expediente) ? p.expediente[0] : p.expediente,
    })));
    setContratos((cont ?? []).map((c: { expediente: unknown; [k: string]: unknown }) => ({
      ...c,
      expediente: Array.isArray(c.expediente) ? c.expediente[0] : c.expediente,
    })));
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleDisponible() {
    if (!proveedor) return;
    setSavingDisponible(true);
    const supabase = createClient();
    const nuevo = !proveedor.disponible;
    await supabase.from('proveedores').update({ disponible: nuevo }).eq('id', proveedor.id);
    setProveedor(prev => prev ? { ...prev, disponible: nuevo } : prev);
    setSavingDisponible(false);
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  // ─── Métricas ──────────────────────────────────────────────────────────────
  const importeContratado = contratos
    .filter(c => c.estado === 'firmado')
    .reduce((s, c) => s + (c.importe ?? 0), 0);
  const feesPendientes = contratos
    .filter(c => c.fee_activo && c.fee_proveedor_estado === 'pendiente')
    .reduce((s, c) => s + (c.fee_proveedor_importe ?? 0), 0);
  const expedientesActivos = asignaciones.filter(a =>
    !['denegada', 'desistida', 'cobro'].includes(a.expediente?.fase ?? '')
  ).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={24} style={{ color: S.teal, animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!proveedor) {
    return (
      <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <Store size={48} style={{ color: S.muted }} />
        <p style={{ color: S.navy, fontWeight: 700, fontSize: '1.1rem' }}>Sin proveedor vinculado</p>
        <p style={{ color: S.muted, fontSize: '0.85rem' }}>Tu cuenta no está vinculada a ningún proveedor. Contacta con el administrador.</p>
        <button onClick={logout} style={{ padding: '8px 20px', borderRadius: 8, background: S.navy, color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit' }}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: '-apple-system, sans-serif' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: S.navy, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Store size={20} style={{ color: S.teal }} />
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>Portal Proveedor</span>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', borderLeft: '1px solid #1e3a5f', paddingLeft: 12 }}>{proveedor.nombre}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Disponibilidad toggle */}
          <button
            onClick={toggleDisponible}
            disabled={savingDisponible}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20, border: 'none',
              background: proveedor.disponible ? '#059669' : '#374151',
              color: '#fff', fontSize: '0.72rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', opacity: proveedor.disponible ? 1 : 0.5 }} />
            {proveedor.disponible ? 'Disponible' : 'No disponible'}
          </button>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Métricas ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { icon: <Briefcase size={18} />, label: 'Expedientes activos', valor: expedientesActivos, color: '#3b82f6', bg: '#eff6ff' },
            { icon: <Euro size={18} />, label: 'Importe contratado', valor: fmtE(importeContratado) ?? '—', color: S.green, bg: '#ecfdf5' },
            { icon: <TrendingUp size={18} />, label: 'Fees pendientes', valor: fmtE(feesPendientes) ?? '—', color: S.amber, bg: '#fffbeb' },
          ].map(m => (
            <div key={m.label} style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {m.icon}
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: S.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: S.navy }}>{m.valor}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Info proveedor ─────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: S.navy }}>{proveedor.nombre}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: S.green, border: '1px solid #bbf7d0' }}>
                  {proveedor.categoria}
                </span>
              </div>
              {proveedor.descripcion && (
                <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 8px', lineHeight: 1.6 }}>{proveedor.descripcion}</p>
              )}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {proveedor.web && (
                  <a href={proveedor.web} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: S.teal, textDecoration: 'none', fontWeight: 600 }}>
                    <Globe size={12} /> {proveedor.web.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {proveedor.contacto_email && (
                  <a href={`mailto:${proveedor.contacto_email}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: S.teal, textDecoration: 'none', fontWeight: 600 }}>
                    <Mail size={12} /> {proveedor.contacto_email}
                  </a>
                )}
                {proveedor.anos_experiencia && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: S.muted }}>
                    <Star size={12} /> {proveedor.anos_experiencia} años de experiencia
                  </span>
                )}
              </div>
            </div>
            <div style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
              background: proveedor.disponible ? '#ecfdf5' : '#f1f5f9',
              color: proveedor.disponible ? S.green : S.muted,
              border: `1px solid ${proveedor.disponible ? '#bbf7d0' : '#e2e8f0'}`,
            }}>
              {proveedor.disponible ? '✓ Disponible' : 'No disponible'}
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
          {([
            { key: 'expedientes', label: 'Expedientes', count: asignaciones.length, icon: <Briefcase size={13} /> },
            { key: 'presupuestos', label: 'Presupuestos', count: presupuestos.length, icon: <FileText size={13} /> },
            { key: 'contratos', label: 'Contratos', count: contratos.length, icon: <Package size={13} /> },
          ] as { key: typeof tab; label: string; count: number; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? S.navy : S.muted,
                fontWeight: tab === t.key ? 700 : 500, fontSize: '0.8rem',
                fontFamily: 'inherit',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t.icon} {t.label}
              {t.count > 0 && (
                <span style={{ fontSize: '0.68rem', fontWeight: 800, background: tab === t.key ? S.navy : '#e2e8f0', color: tab === t.key ? '#fff' : S.muted, borderRadius: 100, padding: '1px 6px' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Expedientes ───────────────────────────────────────── */}
        {tab === 'expedientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {asignaciones.length === 0 ? (
              <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <Briefcase size={32} style={{ color: S.muted, marginBottom: 8 }} />
                <p style={{ color: S.muted, fontSize: '0.85rem' }}>Aún no tienes expedientes asignados.</p>
              </div>
            ) : asignaciones.map(a => {
              const exp = a.expediente;
              const fase = FASE_LABEL[exp?.fase ?? ''] ?? { label: exp?.fase ?? '—', color: S.muted };
              const cliente = exp?.cliente?.[0]?.nombre_normalizado ?? exp?.nif ?? '—';
              return (
                <div key={a.id} style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: S.navy, marginBottom: 4 }}>
                        {exp?.titulo ?? `Expediente ${exp?.id?.slice(0, 8)}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: S.muted, marginBottom: 8 }}>
                        {exp?.organismo ?? ''} · Cliente: {cliente}
                      </div>
                      {a.motivo_match && (
                        <div style={{ fontSize: '0.75rem', color: '#475569', background: '#f8fafc', border: `1px solid ${S.border}`, borderRadius: 7, padding: '6px 10px', lineHeight: 1.5 }}>
                          {a.motivo_match}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${fase.color}18`, color: fase.color, border: `1px solid ${fase.color}40` }}>
                        {fase.label}
                      </span>
                      {exp?.importe_solicitado && (
                        <span style={{ fontSize: '0.75rem', color: S.muted }}>Sol. {fmtE(exp.importe_solicitado)}</span>
                      )}
                      {exp?.importe_concedido && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: S.green }}>✓ {fmtE(exp.importe_concedido)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tab: Presupuestos ──────────────────────────────────────── */}
        {tab === 'presupuestos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {presupuestos.length === 0 ? (
              <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <FileText size={32} style={{ color: S.muted, marginBottom: 8 }} />
                <p style={{ color: S.muted, fontSize: '0.85rem' }}>Sin presupuestos enviados todavía.</p>
              </div>
            ) : presupuestos.map(p => {
              const est = ESTADO_PRESUPUESTO[p.estado] ?? { label: p.estado, color: S.muted, bg: '#f1f5f9' };
              return (
                <div key={p.id} style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: S.navy }}>{p.titulo}</div>
                    <div style={{ fontSize: '0.73rem', color: S.muted, marginTop: 2 }}>
                      {p.expediente?.titulo ?? 'Expediente'} · {fmtFecha(p.fecha_solicitud)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {p.importe && <span style={{ fontWeight: 700, color: S.navy }}>{fmtE(p.importe)}</span>}
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: est.bg, color: est.color }}>
                      {est.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tab: Contratos ─────────────────────────────────────────── */}
        {tab === 'contratos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contratos.length === 0 ? (
              <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <Package size={32} style={{ color: S.muted, marginBottom: 8 }} />
                <p style={{ color: S.muted, fontSize: '0.85rem' }}>Sin contratos formalizados todavía.</p>
              </div>
            ) : contratos.map(c => {
              const firmado = c.estado === 'firmado';
              return (
                <div key={c.id} style={{ background: '#fff', border: `1px solid ${firmado ? '#bbf7d0' : S.border}`, borderRadius: 12, padding: '14px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: S.navy }}>{c.titulo}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: firmado ? '#ecfdf5' : '#f1f5f9', color: firmado ? S.green : S.muted }}>
                          {firmado ? '✓ Firmado' : c.estado}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.73rem', color: S.muted }}>
                        {c.expediente?.titulo ?? 'Expediente'}
                        {c.fecha_firma ? ` · Firmado ${fmtFecha(c.fecha_firma)}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      {c.importe && <span style={{ fontWeight: 800, fontSize: '0.95rem', color: S.navy }}>{fmtE(c.importe)}</span>}
                      {c.fee_activo && c.fee_proveedor_importe && (
                        <div style={{ fontSize: '0.72rem', color: S.amber, fontWeight: 600 }}>
                          Fee: {fmtE(c.fee_proveedor_importe)}
                          {c.fee_proveedor_estado === 'cobrado' ? ' ✓' : ' (pendiente)'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
