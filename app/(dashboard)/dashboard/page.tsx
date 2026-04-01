'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderOpen, TrendingUp, AlertTriangle,
  Clock, Euro, Target, MessageSquare,
  ArrowRightLeft, FilePlus, Activity, Users, Receipt,
  ChevronRight, ArrowUpRight,
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
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <div style={{
          width: '36px', height: '36px', border: '2px solid #e5e7eb',
          borderTopColor: '#0d9488', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: 'var(--ink2)', fontSize: '14px' }}>Cargando...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: '#ef4444' }}>
        <AlertTriangle size={32} style={{ marginBottom: '12px' }} />
        <p>Error: {error || 'Sin datos'}</p>
      </div>
    );
  }

  const { kpis, embudo, expedientes_urgentes, actividades } = data;
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--ink)', marginBottom: '2px', letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{todayFormatted}</p>
        </div>
        {expedientes_urgentes.length > 0 && (
          <a href="#urgentes" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#fff7ed', border: '1px solid #fed7aa',
            borderRadius: '8px', padding: '7px 14px',
            fontSize: '13px', fontWeight: '600', color: '#c2410c',
            textDecoration: 'none',
          }}>
            <AlertTriangle size={14} />
            {expedientes_urgentes.length} urgente{expedientes_urgentes.length !== 1 ? 's' : ''}
          </a>
        )}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <MetricCard
          label="Clientes activos"
          value={kpis.clientes_activos.toString()}
          icon={<Users size={16} />}
          color="#0d9488"
          href="/clientes"
        />
        <MetricCard
          label="Expedientes en curso"
          value={kpis.expedientes_en_curso.toString()}
          sub={`de ${kpis.expedientes_total} total`}
          icon={<FolderOpen size={16} />}
          color="#6366f1"
          href="/expedientes"
        />
        <MetricCard
          label="Importe gestionado"
          value={formatEuros(kpis.importe_gestionado)}
          icon={<Euro size={16} />}
          color="#0d9488"
          href="/expedientes"
        />
        <MetricCard
          label="Tasa conversión"
          value={`${kpis.tasa_conversion}%`}
          icon={<Target size={16} />}
          color="#10b981"
          href="/expedientes"
          trend={kpis.tasa_conversion > 30 ? 'up' : undefined}
        />
        <MetricCard
          label="Ingresos cobrados"
          value={formatEuros(kpis.ingresos_cobrados)}
          sub={kpis.fees_pendientes > 0 ? `${formatEuros(kpis.fees_pendientes)} pendiente` : undefined}
          subColor="#f59e0b"
          icon={<Receipt size={16} />}
          color="#22c55e"
          href="/expedientes"
        />
      </div>

      {/* ── Embudo pipeline ───────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} style={{ color: '#0d9488' }} />
            Pipeline de subvenciones
          </h2>
          <Link href="/expedientes" style={{ fontSize: '12px', color: '#0d9488', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Ver expedientes <ArrowUpRight size={12} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          {[
            { label: 'Matches', value: embudo.matches, color: '#94a3b8', bg: '#f8fafc' },
            { label: 'Interesados', value: embudo.interesados, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'Solicitando', value: embudo.solicitando, color: '#8b5cf6', bg: '#f5f3ff' },
            { label: 'Concedidos', value: embudo.concedidos, color: '#10b981', bg: '#f0fdf4' },
            { label: 'Cobrados', value: embudo.cobrados, color: '#22c55e', bg: '#f0fdf4' },
          ].map((step, i, arr) => {
            const pct = i > 0 && arr[i - 1].value > 0
              ? Math.round((step.value / arr[i - 1].value) * 100)
              : null;
            return (
              <div key={step.label} style={{ background: 'var(--surface)', padding: '16px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: '800', color: step.color, lineHeight: 1 }}>
                  {step.value.toLocaleString('es-ES')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink2)', marginTop: '6px', fontWeight: '500' }}>
                  {step.label}
                </div>
                {pct !== null && (
                  <div style={{
                    fontSize: '11px', color: step.color, marginTop: '4px',
                    background: `${step.color}12`, borderRadius: '100px',
                    padding: '2px 8px', display: 'inline-block', fontWeight: '600',
                  }}>
                    {pct}% conv.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2 columnas: urgentes + actividad ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px' }}>
        <UrgentesTable expedientes={expedientes_urgentes} />
        <ActividadReciente actividades={actividades} />
      </div>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon, color, href, trend, subColor,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  color: string; href: string; trend?: 'up' | 'down'; subColor?: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '18px 20px',
        transition: 'border-color 0.15s',
        height: '100%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: `${color}15`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color,
          }}>
            {icon}
          </div>
          {trend === 'up' && (
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <TrendingUp size={11} /> ↑
            </span>
          )}
        </div>
        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '5px', fontWeight: '500' }}>{label}</div>
        {sub && (
          <div style={{ fontSize: '11px', color: subColor || 'var(--muted)', marginTop: '3px' }}>
            {sub}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Tabla de expedientes urgentes ────────────────────────────────────────────

function UrgentesTable({ expedientes }: { expedientes: DashboardData['expedientes_urgentes'] }) {
  return (
    <div id="urgentes" style={{
      background: 'var(--surface)', borderRadius: '12px',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h2 style={{
          fontSize: '14px', fontWeight: '700', color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: '7px',
        }}>
          <Clock size={15} style={{ color: '#ea580c' }} />
          Plazos urgentes
          {expedientes.length > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: '700',
              background: '#fff7ed', color: '#ea580c',
              padding: '1px 7px', borderRadius: '100px',
            }}>
              {expedientes.length}
            </span>
          )}
        </h2>
        <Link href="/expedientes" style={{ fontSize: '12px', color: '#0d9488', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
          Ver todos <ChevronRight size={12} />
        </Link>
      </div>

      {expedientes.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Sin plazos urgentes</p>
        </div>
      ) : (
        <div>
          {expedientes.map(exp => {
            const fase = exp.fase || 'preparacion';
            const faseColor = FASE_COLORS[fase] || '#94a3b8';
            const faseLabel = FASE_LABELS[fase] || fase;
            const isCritico = exp.dias_restantes <= 2;
            const isWarning = exp.dias_restantes <= 4;

            return (
              <Link key={exp.id} href={`/expedientes/${exp.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  transition: 'background 0.1s',
                }}>
                  {/* Días restantes indicator */}
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                    background: isCritico ? '#fef2f2' : isWarning ? '#fff7ed' : '#f0fdf4',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${isCritico ? '#fecaca' : isWarning ? '#fed7aa' : '#bbf7d0'}`,
                  }}>
                    <span style={{
                      fontSize: '16px', fontWeight: '800', lineHeight: 1,
                      color: isCritico ? '#ef4444' : isWarning ? '#f97316' : '#22c55e',
                    }}>
                      {exp.dias_restantes === 0 ? '!' : exp.dias_restantes}
                    </span>
                    <span style={{
                      fontSize: '9px', fontWeight: '600', letterSpacing: '0.05em',
                      color: isCritico ? '#ef4444' : isWarning ? '#f97316' : '#22c55e',
                    }}>
                      {exp.dias_restantes === 0 ? 'HOY' : 'días'}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>
                      {exp.cliente_nombre}
                    </div>
                    <div style={{
                      fontSize: '12px', color: 'var(--muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {exp.titulo}
                    </div>
                  </div>

                  {/* Fase badge */}
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '3px 9px',
                    borderRadius: '100px', flexShrink: 0,
                    background: `${faseColor}14`, color: faseColor,
                  }}>
                    {faseLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Actividad reciente ───────────────────────────────────────────────────────

function ActividadReciente({ actividades }: { actividades: DashboardData['actividades'] }) {
  const iconMap = {
    mensaje: <MessageSquare size={14} />,
    fase_cambio: <ArrowRightLeft size={14} />,
    expediente_nuevo: <FilePlus size={14} />,
  };

  const colorMap = {
    mensaje: '#3b82f6',
    fase_cambio: '#8b5cf6',
    expediente_nuevo: '#0d9488',
  };

  const labelMap = {
    mensaje: 'Mensaje',
    fase_cambio: 'Cambio de fase',
    expediente_nuevo: 'Nuevo expediente',
  };

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: '12px',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
      }}>
        <h2 style={{
          fontSize: '14px', fontWeight: '700', color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: '7px',
        }}>
          <Activity size={15} style={{ color: '#0d9488' }} />
          Actividad reciente
        </h2>
      </div>

      {actividades.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
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
                  padding: '11px 20px',
                  borderBottom: i < actividades.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}
              >
                {/* Dot + icon */}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '7px',
                  background: `${color}14`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color, flexShrink: 0, marginTop: '1px',
                }}>
                  {iconMap[act.tipo]}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: '700', color,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {labelMap[act.tipo]}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>·</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {timeAgo(act.fecha)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px', color: 'var(--ink)', lineHeight: '1.4',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {act.descripcion}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
