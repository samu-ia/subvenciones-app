'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Bell, Clock, CheckCircle, ChevronRight, RefreshCw, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Alerta } from '@/app/api/alertas/route';

const PRIORIDAD_STYLES: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  critica: { bg: '#fff1f2', color: '#be123c', border: '#fecdd3', dot: '#ef4444' },
  alta:    { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  media:   { bg: '#fefce8', color: '#a16207', border: '#fef08a', dot: '#eab308' },
  baja:    { bg: 'var(--bg)', color: 'var(--ink2)', border: 'var(--border)', dot: '#94a3b8' },
};

const TIPO_LABELS: Record<string, string> = {
  plazo_solicitud:    'Plazo presentación',
  plazo_aceptacion:   'Aceptar resolución',
  plazo_alegaciones:  'Alegaciones',
  plazo_justificacion:'Justificación',
  plazo_ejecucion:    'Fin ejecución',
  match_nuevo:        'Nuevo match',
  solicitud_pendiente:'Solicitud pendiente',
  expediente_parado:  'Sin actividad',
  custom:             'Alerta manual',
};

const TIPO_ICONS: Record<string, string> = {
  plazo_solicitud:    '📋',
  plazo_aceptacion:   '⚡',
  plazo_alegaciones:  '⚖️',
  plazo_justificacion:'📊',
  plazo_ejecucion:    '🔧',
  match_nuevo:        '🎯',
  solicitud_pendiente:'📝',
  expediente_parado:  '😴',
  custom:             '📌',
};

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | 'critica' | 'alta' | 'media' | 'baja'>('todas');
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  async function cargarAlertas() {
    setLoading(true);
    try {
      const res = await fetch('/api/alertas');
      const data = await res.json();
      setAlertas(data.alertas || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarAlertas(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: reload when new static alerts are inserted/deleted
  useEffect(() => {
    const channel = supabase
      .channel('alertas-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, () => {
        cargarAlertas();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alertas' }, (payload) => {
        if (payload.new.resuelta) {
          setAlertas(prev => prev.filter(a => a.id !== payload.new.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resolverAlerta(id: string) {
    // Solo alertas manuales (sin prefijo "dyn-") se pueden resolver en BD
    if (id.startsWith('dyn-')) {
      // Para alertas dinámicas, simplemente las quitamos del estado local
      setAlertas(prev => prev.filter(a => a.id !== id));
      return;
    }
    setResolviendo(id);
    try {
      await fetch(`/api/alertas?id=${id}`, { method: 'PATCH' });
      setAlertas(prev => prev.filter(a => a.id !== id));
    } finally {
      setResolviendo(null);
    }
  }

  const alertasFiltradas = filtro === 'todas' ? alertas : alertas.filter(a => a.prioridad === filtro);
  const countsPor: Record<string, number> = { critica: 0, alta: 0, media: 0, baja: 0 };
  for (const a of alertas) countsPor[a.prioridad] = (countsPor[a.prioridad] || 0) + 1;

  return (
    <div style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--ink)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bell size={28} />
            Centro de alertas
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
            Plazos críticos, solicitudes pendientes y acciones necesarias
          </p>
        </div>
        <button
          onClick={cargarAlertas}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: '14px', color: 'var(--ink2)', cursor: 'pointer',
          }}
        >
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>

      {/* Resumen KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {(['critica', 'alta', 'media', 'baja'] as const).map(p => {
          const st = PRIORIDAD_STYLES[p];
          const labels = { critica: 'Críticas', alta: 'Altas', media: 'Medias', baja: 'Bajas' };
          return (
            <button
              key={p}
              onClick={() => setFiltro(filtro === p ? 'todas' : p)}
              style={{
                background: filtro === p ? st.bg : 'var(--surface)',
                border: `1px solid ${filtro === p ? st.border : 'var(--border)'}`,
                borderRadius: '12px', padding: '20px',
                cursor: 'pointer', textAlign: 'left',
                boxShadow: 'var(--s1)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: st.dot }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: st.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {labels[p]}
                </span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: countsPor[p] > 0 ? st.color : 'var(--ink2)' }}>
                {countsPor[p]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Lista de alertas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink2)' }}>Cargando alertas...</div>
      ) : alertasFiltradas.length === 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)',
          padding: '64px 32px', textAlign: 'center', boxShadow: 'var(--s1)',
        }}>
          <CheckCircle size={48} style={{ color: 'var(--green)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', marginBottom: '8px' }}>
            {filtro === 'todas' ? 'Todo al día' : `Sin alertas ${filtro}s`}
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            No hay alertas pendientes {filtro !== 'todas' ? `de prioridad ${filtro}` : ''}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alertasFiltradas.map(alerta => {
            const st = PRIORIDAD_STYLES[alerta.prioridad];
            const icono = TIPO_ICONS[alerta.tipo] || '📌';
            const tipoLabel = TIPO_LABELS[alerta.tipo] || alerta.tipo;

            return (
              <div
                key={alerta.id}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid var(--border)`,
                  borderLeft: `4px solid ${st.dot}`,
                  borderRadius: '10px',
                  padding: '18px 20px',
                  boxShadow: 'var(--s1)',
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr auto',
                  gap: '14px',
                  alignItems: 'center',
                }}
              >
                {/* Icono */}
                <div style={{ fontSize: '22px', textAlign: 'center' }}>{icono}</div>

                {/* Contenido */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: '700', padding: '2px 8px',
                      borderRadius: '100px', background: st.bg, color: st.color,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>
                      {tipoLabel}
                    </span>
                    {alerta.dias_restantes != null && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '12px', color: (alerta.dias_restantes as number) <= 3 ? st.color : 'var(--ink2)',
                        fontWeight: (alerta.dias_restantes as number) <= 3 ? '700' : '500',
                      }}>
                        <Clock size={12} />
                        {(alerta.dias_restantes as number) === 0 ? 'HOY' : (alerta.dias_restantes as number) < 0 ? `${Math.abs(alerta.dias_restantes as number)}d pasado` : `${alerta.dias_restantes}d`}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)', marginBottom: '4px' }}>
                    {alerta.titulo}
                  </div>

                  {alerta.descripcion && (
                    <div style={{ fontSize: '13px', color: 'var(--ink2)' }}>
                      {alerta.descripcion}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {alerta.fecha_limite && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--muted)' }}>
                        <Calendar size={12} />
                        Límite: {new Date(alerta.fecha_limite).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {alerta.expediente_id && (
                      <Link
                        href={`/expedientes/${alerta.expediente_id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}
                      >
                        Ver expediente <ChevronRight size={12} />
                      </Link>
                    )}
                    {alerta.nif && !alerta.expediente_id && (
                      <Link
                        href={`/clientes/${alerta.nif}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}
                      >
                        Ver cliente <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Acción */}
                <button
                  onClick={() => resolverAlerta(alerta.id)}
                  disabled={resolviendo === alerta.id}
                  title="Marcar como resuelto"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    fontSize: '13px', color: 'var(--ink2)', cursor: 'pointer',
                    fontWeight: '500', whiteSpace: 'nowrap',
                  }}
                >
                  <CheckCircle size={14} />
                  Resolver
                </button>
              </div>
            );
          })}
        </div>
      )}

      {alertas.length > 0 && (
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
          {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''} — Las alertas dinámicas se recalculan en cada visita
        </div>
      )}
    </div>
  );
}
