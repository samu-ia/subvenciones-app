'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, Mail, Globe, Star, FileText, CheckCircle,
  Clock, TrendingUp, Euro, Package, MapPin, Briefcase,
} from 'lucide-react';

interface Proveedor {
  id: string; nombre: string; categoria: string; descripcion?: string;
  servicios?: string[]; logo_url?: string; web?: string;
  contacto_email?: string; contacto_nombre?: string; precio_referencia?: string;
  activo: boolean; bio?: string; anos_experiencia?: number;
  zona_geografica?: string[]; disponible: boolean;
}

interface AsignacionExpediente {
  id: string; expediente_id: string; estado: string; motivo_match?: string;
  expediente: {
    id: string; titulo?: string; organismo?: string; fase?: string;
    importe_solicitado?: number; importe_concedido?: number;
    nif: string; created_at: string;
    cliente: { nombre_normalizado: string | null }[];
  };
}

interface PresupuestoRow {
  id: string; titulo: string; importe?: number; estado: string;
  fecha_solicitud: string; expediente: { titulo?: string };
}

interface ContratoRow {
  id: string; titulo: string; importe?: number; estado: string;
  fecha_firma?: string; fee_proveedor_importe?: number; fee_activo: boolean;
  expediente: { titulo?: string };
}

const FASES_POSITIVAS = ['resolucion_definitiva', 'aceptacion', 'ejecucion', 'justificacion', 'cobro'];
const CAT_COLOR: Record<string, string> = {
  tecnologia: '#3b82f6', consultoria: '#8b5cf6', formacion: '#f59e0b',
  equipamiento: '#06b6d4', marketing: '#ec4899', juridico: '#6366f1',
  financiero: '#059669', construccion: '#f97316', otros: '#94a3b8',
};

export default function ProveedorDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionExpediente[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoRow[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'expedientes' | 'presupuestos' | 'contratos'>('expedientes');

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('proveedores').select('*').eq('id', id).single(),
      supabase.from('expediente_proveedores')
        .select('id, expediente_id, estado, motivo_match, expediente:expediente(id, titulo, organismo, fase, importe_solicitado, importe_concedido, nif, created_at, cliente:cliente(nombre_normalizado))')
        .eq('proveedor_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('presupuestos')
        .select('id, titulo, importe, estado, fecha_solicitud, expediente:expediente(titulo)')
        .eq('proveedor_id', id)
        .order('fecha_solicitud', { ascending: false }),
      supabase.from('contratos')
        .select('id, titulo, importe, estado, fecha_firma, fee_proveedor_importe, fee_activo, expediente:expediente(titulo)')
        .eq('proveedor_id', id)
        .order('created_at', { ascending: false }),
    ]).then(([{ data: prov }, { data: asig }, { data: pres }, { data: cont }]) => {
      setProveedor(prov);
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
    });
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '0.9rem' }}>
      Cargando perfil...
    </div>
  );

  if (!proveedor) return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8' }}>
      Proveedor no encontrado
    </div>
  );

  const formatEur = (n?: number | null) =>
    n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—';

  // Métricas
  const expedientesActivos = asignaciones.filter(a => !['cobro', 'denegada', 'desistida'].includes(a.expediente?.fase ?? '')).length;
  const concedidos = asignaciones.filter(a => FASES_POSITIVAS.includes(a.expediente?.fase ?? '')).length;
  const tasaExito = asignaciones.length > 0 ? Math.round((concedidos / asignaciones.length) * 100) : 0;
  const importeContratado = contratos.filter(c => c.estado === 'firmado').reduce((s, c) => s + (c.importe ?? 0), 0);
  const presAprobados = presupuestos.filter(p => p.estado === 'aprobado').length;
  const tasaAprobPres = presupuestos.length > 0 ? Math.round((presAprobados / presupuestos.length) * 100) : 0;

  const ESTADO_FASE: Record<string, { label: string; color: string }> = {
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

  const PRES_COLORS: Record<string, string> = { borrador: '#94a3b8', enviado: '#3b82f6', recibido: '#8b5cf6', aprobado: '#059669', rechazado: '#ef4444' };
  const CONT_COLORS: Record<string, string> = { borrador: '#94a3b8', enviado: '#3b82f6', firmado: '#059669', rescindido: '#ef4444' };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px' }}>
      {/* Back */}
      <button
        onClick={() => router.push('/proveedores')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.82rem', border: 'none', background: 'none', cursor: 'pointer', marginBottom: 20, fontFamily: 'inherit' }}
      >
        <ArrowLeft size={14} /> Volver a proveedores
      </button>

      {/* Header */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '24px 28px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: 16, flexShrink: 0,
            background: (CAT_COLOR[proveedor.categoria] ?? '#94a3b8') + '20',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 800, color: CAT_COLOR[proveedor.categoria] ?? '#94a3b8',
          }}>
            {proveedor.nombre.charAt(0)}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0d1f3c', margin: 0 }}>{proveedor.nombre}</h1>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: (CAT_COLOR[proveedor.categoria] ?? '#94a3b8') + '18',
                color: CAT_COLOR[proveedor.categoria] ?? '#94a3b8',
              }}>
                {proveedor.categoria}
              </span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: proveedor.disponible ? '#f0fdf4' : '#fef2f2',
                color: proveedor.disponible ? '#059669' : '#dc2626',
              }}>
                {proveedor.disponible ? '● Disponible' : '● No disponible'}
              </span>
            </div>

            {proveedor.bio && <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 8px', lineHeight: 1.5 }}>{proveedor.bio}</p>}
            {proveedor.descripcion && !proveedor.bio && <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 8px', lineHeight: 1.5 }}>{proveedor.descripcion}</p>}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {proveedor.contacto_nombre && (
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Briefcase size={12} /> {proveedor.contacto_nombre}
                </span>
              )}
              {proveedor.contacto_email && (
                <a href={`mailto:${proveedor.contacto_email}`} style={{ fontSize: '0.75rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                  <Mail size={12} /> {proveedor.contacto_email}
                </a>
              )}
              {proveedor.web && (
                <a href={proveedor.web} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                  <Globe size={12} /> Web
                </a>
              )}
              {proveedor.anos_experiencia && (
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={12} /> {proveedor.anos_experiencia} años exp.
                </span>
              )}
              {proveedor.precio_referencia && (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Euro size={12} /> {proveedor.precio_referencia}
                </span>
              )}
            </div>

            {proveedor.zona_geografica && proveedor.zona_geografica.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                <MapPin size={12} style={{ color: '#94a3b8', marginTop: 2 }} />
                {proveedor.zona_geografica.map(z => (
                  <span key={z} style={{ fontSize: '0.65rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 10 }}>{z}</span>
                ))}
              </div>
            )}

            {proveedor.servicios && proveedor.servicios.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                {proveedor.servicios.map(s => (
                  <span key={s} style={{ fontSize: '0.65rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: 10 }}>{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Métricas — igual peso que el cliente */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Expedientes activos', value: expedientesActivos, icon: <FileText size={16} />, color: '#3b82f6' },
          { label: 'Total expedientes', value: asignaciones.length, icon: <Package size={16} />, color: '#8b5cf6' },
          { label: 'Concedidos', value: concedidos, icon: <CheckCircle size={16} />, color: '#059669' },
          { label: 'Tasa de éxito', value: `${tasaExito}%`, icon: <TrendingUp size={16} />, color: '#f59e0b' },
          { label: 'Presupuestos aprobados', value: `${tasaAprobPres}%`, icon: <Clock size={16} />, color: '#06b6d4' },
          { label: 'Contratado total', value: formatEur(importeContratado), icon: <Euro size={16} />, color: '#22c55e' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0d1f3c', margin: 0 }}>{value}</p>
              </div>
              <div style={{ background: color + '15', color, borderRadius: 10, padding: 8 }}>{icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Fee info (dormido) */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1rem' }}>💡</span>
        <div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e' }}>Fee de plataforma: 3% sobre contratos</span>
          <span style={{ fontSize: '0.73rem', color: '#a16207', marginLeft: 8 }}>· Actualmente inactivo (lanzamiento gratuito)</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', background: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: 20, fontWeight: 700, border: '1px solid #fde68a' }}>GRATIS</span>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
          {[
            { key: 'expedientes', label: `Expedientes (${asignaciones.length})` },
            { key: 'presupuestos', label: `Presupuestos (${presupuestos.length})` },
            { key: 'contratos', label: `Contratos (${contratos.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as 'expedientes' | 'presupuestos' | 'contratos')} style={{
              padding: '13px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.82rem', fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#0d1f3c' : '#94a3b8',
              background: 'transparent',
              borderBottom: tab === t.key ? '2px solid #0d1f3c' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Expedientes tab */}
        {tab === 'expedientes' && (
          asignaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 24px', color: '#94a3b8' }}>
              <FileText size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>Sin expedientes asignados todavía</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                  {['Cliente', 'Subvención', 'Fase', 'Importe solicitado', 'Estado asignación'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', padding: '10px 16px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {asignaciones.map(a => {
                  const faseInfo = ESTADO_FASE[a.expediente?.fase ?? ''] ?? { label: a.expediente?.fase ?? '—', color: '#94a3b8' };
                  const cliente = Array.isArray(a.expediente?.cliente) ? a.expediente.cliente[0] : a.expediente?.cliente;
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                      onClick={() => router.push(`/expedientes/${a.expediente_id}`)}>
                      <td style={{ padding: '11px 16px', fontSize: '0.82rem', fontWeight: 600, color: '#0d1f3c' }}>
                        {(cliente as { nombre_normalizado?: string } | null)?.nombre_normalizado ?? a.expediente?.nif}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '0.82rem', color: '#475569', maxWidth: 240 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.expediente?.titulo ?? a.expediente?.organismo ?? '—'}
                        </div>
                        {a.motivo_match && (
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.motivo_match}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: faseInfo.color + '18', color: faseInfo.color }}>
                          {faseInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '0.82rem', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                        {formatEur(a.expediente?.importe_solicitado)}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: a.estado === 'aceptado' ? '#f0fdf4' : a.estado === 'contactado' ? '#fffbeb' : '#f8fafc',
                          color: a.estado === 'aceptado' ? '#059669' : a.estado === 'contactado' ? '#d97706' : '#94a3b8',
                        }}>
                          {a.estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {/* Presupuestos tab */}
        {tab === 'presupuestos' && (
          presupuestos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 24px', color: '#94a3b8' }}>
              <p style={{ fontSize: '0.85rem' }}>Sin presupuestos registrados</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                  {['Presupuesto', 'Expediente', 'Importe', 'Estado', 'Fecha'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', padding: '10px 16px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {presupuestos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '11px 16px', fontSize: '0.82rem', fontWeight: 600, color: '#0d1f3c' }}>{p.titulo}</td>
                    <td style={{ padding: '11px 16px', fontSize: '0.78rem', color: '#64748b' }}>{p.expediente?.titulo ?? '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: '0.82rem', fontWeight: 700, color: '#0d1f3c', fontVariantNumeric: 'tabular-nums' }}>{formatEur(p.importe)}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: (PRES_COLORS[p.estado] ?? '#94a3b8') + '18', color: PRES_COLORS[p.estado] ?? '#94a3b8' }}>
                        {p.estado}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(p.fecha_solicitud).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* Contratos tab */}
        {tab === 'contratos' && (
          contratos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 24px', color: '#94a3b8' }}>
              <p style={{ fontSize: '0.85rem' }}>Sin contratos registrados</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                  {['Contrato', 'Expediente', 'Importe', 'Estado', 'Fee 3%', 'Fecha firma'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', padding: '10px 16px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contratos.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '11px 16px', fontSize: '0.82rem', fontWeight: 600, color: '#0d1f3c' }}>{c.titulo}</td>
                    <td style={{ padding: '11px 16px', fontSize: '0.78rem', color: '#64748b' }}>{c.expediente?.titulo ?? '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: '0.82rem', fontWeight: 700, color: '#0d1f3c', fontVariantNumeric: 'tabular-nums' }}>{formatEur(c.importe)}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: (CONT_COLORS[c.estado] ?? '#94a3b8') + '18', color: CONT_COLORS[c.estado] ?? '#94a3b8' }}>
                        {c.estado === 'firmado' ? '✓ Firmado' : c.estado}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {c.fee_activo ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                          {formatEur(c.fee_proveedor_importe)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>Gratis</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {c.fecha_firma ? new Date(c.fecha_firma).toLocaleDateString('es-ES') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
