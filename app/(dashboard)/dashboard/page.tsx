'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell, Building2, FolderOpen, TrendingUp, AlertTriangle,
  CheckCircle, Clock, ChevronRight, Euro, Target,
} from 'lucide-react';
import type { Alerta } from '@/app/api/alertas/route';

interface Stats {
  clientes: number;
  expedientes: { total: number; activos: number; concedidos: number };
  solicitudes: { pendientes: number; activas: number };
  matches_nuevos: number;
  importe_pipeline: number;
}

interface ExpedienteResumen {
  id: string;
  nif: string;
  titulo: string | null;
  fase: string | null;
  estado: string;
  updated_at: string;
  cliente: { nombre_empresa?: string | null; nombre_normalizado: string | null } | null;
}

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
  denegada: '#94a3b8',
  desistida: '#94a3b8',
};

const PRIORIDAD_COLORS: Record<string, string> = {
  critica: '#ef4444',
  alta: '#f97316',
  media: '#eab308',
  baja: '#94a3b8',
};

function formatEuros(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n.toLocaleString('es-ES')}€`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteResumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/alertas').then(r => r.json()),
      fetch('/api/expedientes').then(r => r.json()),
    ]).then(([statsData, alertasData, expData]) => {
      setStats(statsData);
      setAlertas(alertasData.alertas || []);
      setExpedientes(Array.isArray(expData) ? expData.slice(0, 8) : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink2)' }}>Cargando...</div>;
  }

  const alertasCriticas = alertas.filter(a => a.prioridad === 'critica');
  const alertasAltas = alertas.filter(a => a.prioridad === 'alta');
  const top5Alertas = alertas.slice(0, 5);

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

      {/* Alerta banner si hay críticas */}
      {alertasCriticas.length > 0 && (
        <Link href="/alertas" style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px',
            padding: '14px 20px', marginBottom: '24px', display: 'flex',
            alignItems: 'center', gap: '12px', cursor: 'pointer',
          }}>
            <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#be123c' }}>
              {alertasCriticas.length} alerta{alertasCriticas.length !== 1 ? 's' : ''} crítica{alertasCriticas.length !== 1 ? 's' : ''} — acción inmediata requerida
            </span>
            <ChevronRight size={16} style={{ color: '#be123c', marginLeft: 'auto' }} />
          </div>
        </Link>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <KpiCard
          icon={<Building2 size={22} />}
          label="Clientes"
          value={stats?.clientes ?? 0}
          link="/clientes"
          color="#3b82f6"
        />
        <KpiCard
          icon={<FolderOpen size={22} />}
          label="Expedientes activos"
          value={stats?.expedientes?.activos ?? 0}
          sub={`${stats?.expedientes?.total ?? 0} total`}
          link="/expedientes"
          color="#6366f1"
        />
        <KpiCard
          icon={<Target size={22} />}
          label="Concedidos"
          value={stats?.expedientes?.concedidos ?? 0}
          link="/expedientes"
          color="#22c55e"
        />
        <KpiCard
          icon={<Bell size={22} />}
          label="Alertas activas"
          value={alertas.length}
          sub={alertasCriticas.length > 0 ? `${alertasCriticas.length} críticas` : alertasAltas.length > 0 ? `${alertasAltas.length} altas` : undefined}
          subColor={alertasCriticas.length > 0 ? '#ef4444' : '#f97316'}
          link="/alertas"
          color="#f97316"
        />
      </div>

      {/* 2 columnas: alertas + expedientes recientes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '24px' }}>
        {/* Alertas */}
        <div style={{
          background: 'var(--surface)', borderRadius: '12px',
          border: '1px solid var(--border)', boxShadow: 'var(--s1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} /> Alertas urgentes
            </h2>
            <Link href="/alertas" style={{ fontSize: '13px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}>
              Ver todas →
            </Link>
          </div>
          {top5Alertas.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <CheckCircle size={32} style={{ color: 'var(--green)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Sin alertas pendientes</p>
            </div>
          ) : (
            <div>
              {top5Alertas.map(a => (
                <div
                  key={a.id}
                  style={{
                    padding: '14px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                    background: PRIORIDAD_COLORS[a.prioridad] || '#94a3b8',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.titulo}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.descripcion}
                    </div>
                  </div>
                  {a.dias_restantes != null && (
                    <span style={{
                      fontSize: '12px', fontWeight: '700', flexShrink: 0,
                      color: (a.dias_restantes as number) <= 3 ? '#ef4444' : 'var(--ink2)',
                      display: 'flex', alignItems: 'center', gap: '3px',
                    }}>
                      <Clock size={11} />
                      {(a.dias_restantes as number) === 0 ? 'HOY' : `${a.dias_restantes}d`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expedientes recientes */}
        <div style={{
          background: 'var(--surface)', borderRadius: '12px',
          border: '1px solid var(--border)', boxShadow: 'var(--s1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={18} /> Expedientes activos
            </h2>
            <Link href="/expedientes" style={{ fontSize: '13px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}>
              Ver todos →
            </Link>
          </div>
          {expedientes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
              No hay expedientes activos
            </div>
          ) : (
            <div>
              {expedientes.map(exp => {
                const clienteNombre = exp.cliente?.nombre_empresa || exp.cliente?.nombre_normalizado || exp.nif;
                const fase = exp.fase || 'preparacion';
                const faseColor = FASE_COLORS[fase] || '#94a3b8';
                const faseLabel = FASE_LABELS[fase] || fase;
                return (
                  <Link
                    key={exp.id}
                    href={`/expedientes/${exp.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      padding: '14px 24px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      cursor: 'pointer',
                    }}
                    className="table-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--navy)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {clienteNombre}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exp.titulo || 'Sin título'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', padding: '3px 10px',
                        borderRadius: '100px', flexShrink: 0,
                        background: `${faseColor}18`, color: faseColor,
                      }}>
                        {faseLabel}
                      </span>
                      <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline por fase */}
      <PipelineFases expedientes={expedientes} />
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, link, color, subColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
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
        <div style={{ fontSize: '30px', fontWeight: '800', color: 'var(--ink)', lineHeight: 1 }}>
          {value.toLocaleString('es-ES')}
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

function PipelineFases({ expedientes }: { expedientes: ExpedienteResumen[] }) {
  if (expedientes.length === 0) return null;

  const FASES_ORDEN = [
    'preparacion', 'presentada', 'instruccion', 'resolucion_provisional',
    'alegaciones', 'resolucion_definitiva', 'aceptacion', 'ejecucion',
    'justificacion', 'cobro',
  ];

  const counts: Record<string, number> = {};
  for (const exp of expedientes) {
    const f = exp.fase || 'preparacion';
    counts[f] = (counts[f] || 0) + 1;
  }

  const fasesConDatos = FASES_ORDEN.filter(f => counts[f]);

  if (fasesConDatos.length === 0) return null;

  return (
    <div style={{
      marginTop: '24px', background: 'var(--surface)', borderRadius: '12px',
      border: '1px solid var(--border)', boxShadow: 'var(--s1)', padding: '24px',
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ink)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TrendingUp size={18} /> Pipeline por fase
      </h2>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {fasesConDatos.map(fase => {
          const color = FASE_COLORS[fase] || '#94a3b8';
          const label = FASE_LABELS[fase] || fase;
          const count = counts[fase];
          return (
            <div
              key={fase}
              style={{
                background: `${color}12`,
                border: `1px solid ${color}30`,
                borderRadius: '10px', padding: '12px 20px',
                textAlign: 'center', minWidth: '100px',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: '800', color }}>{count}</div>
              <div style={{ fontSize: '12px', color, fontWeight: '600', marginTop: '4px' }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
