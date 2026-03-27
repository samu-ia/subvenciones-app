'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2, FolderOpen, TrendingUp, AlertTriangle,
  Clock, ChevronRight, Euro, Target, MessageSquare,
  ArrowRightLeft, FilePlus, Activity, Users, Receipt,
} from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface DashboardData {
  kpis: {
    clientes_activos: number;
    expedientes_en_curso: number;
    expedientes_total: number;
    importe_gestionado: number;
    tasa_conversion: number;
    ingresos_cobrados: number;
    fees_pendientes: number;
  };
  embudo: {
    matches: number;
    interesados: number;
    solicitando: number;
    concedidos: number;
    cobrados: number;
  };
  expedientes_urgentes: {
    id: string;
    cliente_nombre: string;
    titulo: string;
    fase: string;
    fecha_limite: string;
    dias_restantes: number;
  }[];
  actividades: {
    tipo: 'mensaje' | 'fase_cambio' | 'expediente_nuevo';
    descripcion: string;
    fecha: string;
    nif?: string;
    expediente_id?: string;
  }[];
}

// ── Constantes ───────────────────────────────────────────────────────────────

const FASE_LABELS: Record<string, string> = {
  preparacion: 'Preparación',
  presentada: 'Presentada',
  instruccion: 'Instrucción',
  resolucion_provisional: 'Res. Provisional',
  alegaciones: 'Alegaciones',
  resolucion_definitiva: 'Res. Definitiva',
  aceptacion: 'Aceptación',
  ejecucion: 'Ejecución',
  justificacion: 'Justificación',
  cobro: 'Cobrado',
  denegada: 'Denegada',
  desistida: 'Desistida',
};

const FASE_COLORS: Record<string, string> = {
  preparacion: '#6366f1',
  presentada: '#3b82f6',
  instruccion: '#8b5cf6',
  resolucion_provisional: '#f59e0b',
  alegaciones: '#f97316',
  resolucion_definitiva: '#10b981',
  aceptacion: '#ef4444',
  ejecucion: '#06b6d4',
  justificacion: '#6366f1',
  cobro: '#22c55e',
};

function formatEuros(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n.toLocaleString('es-ES')}€`;
}

function timeAgo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard-stats')
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div style={{
          width: '40px', height: '40px', border: '3px solid #e5e7eb',
          borderTopColor: '#6366f1', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>Cargando estadísticas...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#ef4444' }}>
        <AlertTriangle size={32} style={{ marginBottom: '12px' }} />
        <p>Error cargando datos: {error || 'Sin datos'}</p>
      </div>
    );
  }

  const { kpis, embudo, expedientes_urgentes, actividades } = data;

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Alerta urgentes banner */}
      {expedientes_urgentes.length > 0 && (
        <div style={{
          background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px',
          padding: '14px 20px', marginBottom: '24px', display: 'flex',
          alignItems: 'center', gap: '12px',
        }}>
          <AlertTriangle size={20} style={{ color: '#ea580c', flexShrink: 0 }} />
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#c2410c' }}>
            {expedientes_urgentes.length} expediente{expedientes_urgentes.length !== 1 ? 's' : ''} con plazo en menos de 7 días
          </span>
          <a href="#urgentes" style={{ marginLeft: 'auto', fontSize: '13px', color: '#ea580c', fontWeight: '500' }}>
            Ver abajo ↓
          </a>
        </div>
      )}

      {/* ── KPIs principales ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <KpiCard
          icon={<Users size={22} />}
          label="Clientes activos"
          value={kpis.clientes_activos.toString()}
          link="/clientes"
          color="#3b82f6"
        />
        <KpiCard
          icon={<FolderOpen size={22} />}
          label="Expedientes en curso"
          value={kpis.expedientes_en_curso.toString()}
          sub={`${kpis.expedientes_total} total`}
          link="/expedientes"
          color="#6366f1"
        />
        <KpiCard
          icon={<Euro size={22} />}
          label="Importe gestionado"
          value={formatEuros(kpis.importe_gestionado)}
          link="/expedientes"
          color="#8b5cf6"
        />
        <KpiCard
          icon={<Target size={22} />}
          label="Tasa de conversión"
          value={`${kpis.tasa_conversion}%`}
          sub={`${kpis.expedientes_total > 0 ? Math.round((kpis.tasa_conversion / 100) * kpis.expedientes_total) : 0} concedidos`}
          link="/expedientes"
          color="#10b981"
        />
        <KpiCard
          icon={<Receipt size={22} />}
          label="Ingresos cobrados"
          value={formatEuros(kpis.ingresos_cobrados)}
          sub={kpis.fees_pendientes > 0 ? `${formatEuros(kpis.fees_pendientes)} pendiente` : undefined}
          subColor="#f59e0b"
          link="/expedientes"
          color="#22c55e"
        />
      </div>

      {/* ── Embudo de conversión ──────────────────────────────────────────────── */}
      <FunnelChart embudo={embudo} />

      {/* ── 2 columnas: urgentes + actividad ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginTop: '24px' }}>
        {/* Expedientes urgentes */}
        <UrgentesTable expedientes={expedientes_urgentes} />

        {/* Últimas actividades */}
        <ActividadReciente actividades={actividades} />
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, link, color, subColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  link: string;
  color: string;
  subColor?: string;
}) {
  return (
    <Link href={link} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '12px',
        border: '1px solid var(--border)', boxShadow: 'var(--s1)',
        padding: '20px 24px', cursor: 'pointer',
        transition: 'box-shadow 0.15s',
        height: '100%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `${color}18`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color,
          }}>
            {icon}
          </div>
        </div>
        <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--ink)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--ink2)', marginTop: '6px' }}>{label}</div>
        {sub && (
          <div style={{ fontSize: '12px', color: subColor || 'var(--muted)', marginTop: '4px', fontWeight: '500' }}>
            {sub}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Embudo de conversión ─────────────────────────────────────────────────────

function FunnelChart({ embudo }: { embudo: DashboardData['embudo'] }) {
  const steps = [
    { key: 'matches', label: 'Matches', value: embudo.matches, color: '#94a3b8' },
    { key: 'interesados', label: 'Interesados', value: embudo.interesados, color: '#3b82f6' },
    { key: 'solicitando', label: 'Solicitando', value: embudo.solicitando, color: '#8b5cf6' },
    { key: 'concedidos', label: 'Concedidos', value: embudo.concedidos, color: '#10b981' },
    { key: 'cobrados', label: 'Cobrados', value: embudo.cobrados, color: '#22c55e' },
  ];

  const maxValue = Math.max(...steps.map(s => s.value), 1);

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: '12px',
      border: '1px solid var(--border)', boxShadow: 'var(--s1)',
      padding: '24px', overflow: 'hidden',
    }}>
      <h2 style={{
        fontSize: '16px', fontWeight: '700', color: 'var(--ink)',
        marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <TrendingUp size={18} /> Embudo de conversión
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {steps.map((step, i) => {
          const pct = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
          const convRate = i > 0 && steps[i - 1].value > 0
            ? ((step.value / steps[i - 1].value) * 100).toFixed(0)
            : null;

          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Label */}
              <div style={{ width: '100px', textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>
                  {step.label}
                </span>
              </div>

              {/* Bar */}
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{
                  height: '36px', borderRadius: '8px',
                  background: '#f1f5f9',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(pct, 2)}%`,
                    background: `linear-gradient(90deg, ${step.color}, ${step.color}cc)`,
                    borderRadius: '8px',
                    transition: 'width 0.6s ease-out',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '12px',
                    minWidth: '50px',
                  }}>
                    <span style={{
                      fontSize: '14px', fontWeight: '800', color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    }}>
                      {step.value.toLocaleString('es-ES')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Conversion rate */}
              <div style={{ width: '60px', textAlign: 'right', flexShrink: 0 }}>
                {convRate ? (
                  <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>
                    {convRate}%
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: 'transparent' }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{
        marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)',
        fontSize: '12px', color: 'var(--muted)', textAlign: 'center',
      }}>
        Porcentajes = tasa de conversión respecto al paso anterior
      </div>
    </div>
  );
}

// ── Tabla de expedientes urgentes ────────────────────────────────────────────

function UrgentesTable({ expedientes }: { expedientes: DashboardData['expedientes_urgentes'] }) {
  return (
    <div
      id="urgentes"
      style={{
        background: 'var(--surface)', borderRadius: '12px',
        border: '1px solid var(--border)', boxShadow: 'var(--s1)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '700', color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Clock size={18} style={{ color: '#ea580c' }} /> Expedientes urgentes
          {expedientes.length > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: '700', background: '#fff7ed',
              color: '#ea580c', padding: '2px 8px', borderRadius: '100px',
              marginLeft: '4px',
            }}>
              {expedientes.length}
            </span>
          )}
        </h2>
        <Link href="/expedientes" style={{ fontSize: '13px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}>
          Ver todos →
        </Link>
      </div>

      {expedientes.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            Sin expedientes con plazos urgentes
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Cliente', 'Expediente', 'Fase', 'Plazo', 'Días'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: '11px', fontWeight: '600', color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expedientes.map(exp => {
                const fase = exp.fase || 'preparacion';
                const faseColor = FASE_COLORS[fase] || '#94a3b8';
                const faseLabel = FASE_LABELS[fase] || fase;
                const isCritico = exp.dias_restantes <= 2;

                return (
                  <tr
                    key={exp.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    className="table-row"
                  >
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--navy)' }}>
                      <Link href={`/expedientes/${exp.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {exp.cliente_nombre}
                      </Link>
                    </td>
                    <td style={{
                      padding: '12px 16px', color: 'var(--ink2)',
                      maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {exp.titulo}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', padding: '3px 10px',
                        borderRadius: '100px',
                        background: `${faseColor}18`, color: faseColor,
                      }}>
                        {faseLabel}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink2)', fontSize: '13px' }}>
                      {new Date(exp.fecha_limite).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '13px', fontWeight: '700',
                        color: isCritico ? '#ef4444' : exp.dias_restantes <= 4 ? '#f59e0b' : 'var(--ink)',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <Clock size={12} />
                        {exp.dias_restantes === 0 ? '¡HOY!' : `${exp.dias_restantes}d`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Actividad reciente ───────────────────────────────────────────────────────

function ActividadReciente({ actividades }: { actividades: DashboardData['actividades'] }) {
  const iconMap = {
    mensaje: <MessageSquare size={16} />,
    fase_cambio: <ArrowRightLeft size={16} />,
    expediente_nuevo: <FilePlus size={16} />,
  };

  const colorMap = {
    mensaje: '#3b82f6',
    fase_cambio: '#8b5cf6',
    expediente_nuevo: '#10b981',
  };

  const labelMap = {
    mensaje: 'Mensaje',
    fase_cambio: 'Cambio de fase',
    expediente_nuevo: 'Nuevo expediente',
  };

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: '12px',
      border: '1px solid var(--border)', boxShadow: 'var(--s1)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '700', color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Activity size={18} /> Actividad reciente
        </h2>
      </div>

      {actividades.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
          Sin actividad reciente
        </div>
      ) : (
        <div>
          {actividades.map((act, i) => {
            const color = colorMap[act.tipo];
            return (
              <div
                key={`${act.tipo}-${act.fecha}-${i}`}
                style={{
                  padding: '14px 24px',
                  borderBottom: i < actividades.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: `${color}14`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color, flexShrink: 0, marginTop: '2px',
                }}>
                  {iconMap[act.tipo]}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '11px', fontWeight: '600', color,
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px',
                  }}>
                    {labelMap[act.tipo]}
                  </div>
                  <div style={{
                    fontSize: '13px', color: 'var(--ink)', lineHeight: '1.4',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {act.descripcion}
                  </div>
                </div>

                {/* Time */}
                <div style={{
                  fontSize: '12px', color: 'var(--muted)', flexShrink: 0,
                  whiteSpace: 'nowrap', marginTop: '2px',
                }}>
                  {timeAgo(act.fecha)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
