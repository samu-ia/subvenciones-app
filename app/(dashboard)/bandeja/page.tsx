'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Inbox, RefreshCw, CheckCircle, AlertTriangle, Clock,
  ClipboardList, FolderOpen, Sparkles, ChevronRight, Loader2,
} from 'lucide-react';
import type { Alerta } from '@/app/api/alertas/route';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SolicitudPendiente {
  id: string;
  nif: string;
  estado: string;
  created_at: string;
  expediente_id: string | null;
  nombre_empresa: string | null;
  subvencion_titulo: string | null;
}

interface ExpedienteUrgente {
  id: string;
  nif: string;
  titulo: string | null;
  fase: string | null;
  plazo: string;
  dias_restantes: number;
  nombre_empresa: string | null;
}

interface MatchNuevo {
  id: string;
  nif: string;
  score: number;
  nombre_empresa: string | null;
  subvencion_titulo: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diasHasta(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const lim = new Date(fecha);
  lim.setHours(0, 0, 0, 0);
  return Math.ceil((lim.getTime() - hoy.getTime()) / 86_400_000);
}

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ESTADO_LABELS: Record<string, string> = {
  pendiente_encaje:  'Pendiente encaje',
  encaje_confirmado: 'Encaje confirmado',
  contrato_firmado:  'Contrato firmado',
  pago_pendiente:    'Pago pendiente',
};

const FASE_LABELS: Record<string, string> = {
  preparacion:  'Preparación',
  aceptacion:   'Aceptación',
  justificacion: 'Justificación',
};

// ─── Sub-componentes de sección ───────────────────────────────────────────────

function SeccionHeader({
  emoji, titulo, count, color,
}: { emoji: string; titulo: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 12,
    }}>
      <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ink)' }}>
        {titulo}
      </span>
      <span style={{
        padding: '2px 8px', borderRadius: '100px',
        fontSize: '0.72rem', fontWeight: 700,
        background: count > 0 ? color + '20' : 'var(--bg)',
        color: count > 0 ? color : 'var(--muted)',
        border: `1px solid ${count > 0 ? color + '40' : 'var(--border)'}`,
      }}>
        {count}
      </span>
    </div>
  );
}

function VacioSutil({ texto }: { texto: string }) {
  return (
    <div style={{
      padding: '14px 18px', borderRadius: 10,
      border: '1px dashed var(--border)',
      fontSize: '0.82rem', color: 'var(--muted)',
      textAlign: 'center',
    }}>
      {texto}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function BandejaPage() {
  const supabase = createClient();

  const [alertasCriticas, setAlertasCriticas] = useState<Alerta[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudPendiente[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteUrgente[]>([]);
  const [matches, setMatches] = useState<MatchNuevo[]>([]);

  const [loading, setLoading] = useState(true);
  const [resolviendo, setResolviendo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        cargarAlertas(),
        cargarSolicitudes(),
        cargarExpedientes(),
        cargarMatches(),
      ]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A) Alertas críticas/altas via API
  async function cargarAlertas() {
    try {
      const res = await fetch('/api/alertas');
      const data = await res.json();
      const todas: Alerta[] = data.alertas ?? [];
      setAlertasCriticas(
        todas.filter(a => !a.resuelta && (a.prioridad === 'critica' || a.prioridad === 'alta'))
      );
    } catch {
      setAlertasCriticas([]);
    }
  }

  // B) Solicitudes pendientes de acción del gestor (sin expediente)
  async function cargarSolicitudes() {
    try {
      const estadosPendientes = ['pendiente_encaje', 'encaje_confirmado', 'contrato_firmado', 'pago_pendiente'];

      const { data: solData } = await supabase
        .from('solicitudes')
        .select('id, nif, estado, created_at, expediente_id, subvencion:subvenciones(titulo)')
        .in('estado', estadosPendientes)
        .is('expediente_id', null)
        .order('created_at', { ascending: false });

      if (!solData || solData.length === 0) { setSolicitudes([]); return; }

      const nifs = [...new Set(solData.map((s: any) => s.nif as string))];
      const { data: clientesData } = await supabase
        .from('cliente')
        .select('nif, nombre_empresa')
        .in('nif', nifs);

      const clienteMap: Record<string, string> = {};
      for (const c of clientesData ?? []) {
        clienteMap[(c as any).nif] = (c as any).nombre_empresa ?? '';
      }

      const rows: SolicitudPendiente[] = solData.map((s: any) => ({
        id: s.id,
        nif: s.nif,
        estado: s.estado,
        created_at: s.created_at,
        expediente_id: s.expediente_id,
        nombre_empresa: clienteMap[s.nif] ?? s.nif,
        subvencion_titulo: Array.isArray(s.subvencion)
          ? (s.subvencion[0]?.titulo ?? null)
          : (s.subvencion?.titulo ?? null),
      }));

      setSolicitudes(rows);
    } catch {
      setSolicitudes([]);
    }
  }

  // C) Expedientes con plazos urgentes (< 7 días)
  async function cargarExpedientes() {
    try {
      const { data: expData } = await supabase
        .from('expediente')
        .select('id, nif, titulo, fase, plazo_solicitud, plazo_aceptacion, plazo_justificacion')
        .not('fase', 'is', null)
        .order('created_at', { ascending: false });

      if (!expData || expData.length === 0) { setExpedientes([]); return; }

      const urgentes: ExpedienteUrgente[] = [];

      for (const exp of expData as any[]) {
        let plazoRelevante: string | null = null;
        if (exp.fase === 'preparacion' && exp.plazo_solicitud) plazoRelevante = exp.plazo_solicitud;
        else if (exp.fase === 'aceptacion' && exp.plazo_aceptacion) plazoRelevante = exp.plazo_aceptacion;
        else if (exp.fase === 'justificacion' && exp.plazo_justificacion) plazoRelevante = exp.plazo_justificacion;

        if (!plazoRelevante) continue;

        const dias = diasHasta(plazoRelevante);
        if (dias > 7) continue;

        urgentes.push({
          id: exp.id,
          nif: exp.nif,
          titulo: exp.titulo,
          fase: exp.fase,
          plazo: plazoRelevante,
          dias_restantes: dias,
          nombre_empresa: null, // Se cargará tras
        });
      }

      if (urgentes.length === 0) { setExpedientes([]); return; }

      // Cargar nombres de clientes
      const nifs2 = [...new Set(urgentes.map(e => e.nif))];
      const { data: clis } = await supabase
        .from('cliente')
        .select('nif, nombre_empresa')
        .in('nif', nifs2);

      const cliMap: Record<string, string> = {};
      for (const c of clis ?? []) {
        cliMap[(c as any).nif] = (c as any).nombre_empresa ?? '';
      }

      setExpedientes(urgentes.map(e => ({ ...e, nombre_empresa: cliMap[e.nif] ?? e.nif })));
    } catch {
      setExpedientes([]);
    }
  }

  // D) Matches nuevos sin revisar
  async function cargarMatches() {
    try {
      const { data: matchData } = await supabase
        .from('cliente_subvencion_match')
        .select('id, nif, score, subvencion:subvenciones(titulo)')
        .eq('estado', 'nuevo')
        .gte('score', 0.5)
        .order('score', { ascending: false })
        .limit(5);

      if (!matchData || matchData.length === 0) { setMatches([]); return; }

      const nifs3 = [...new Set(matchData.map((m: any) => m.nif as string))];
      const { data: clis3 } = await supabase
        .from('cliente')
        .select('nif, nombre_empresa')
        .in('nif', nifs3);

      const cliMap3: Record<string, string> = {};
      for (const c of clis3 ?? []) {
        cliMap3[(c as any).nif] = (c as any).nombre_empresa ?? '';
      }

      const rows2: MatchNuevo[] = matchData.map((m: any) => ({
        id: m.id,
        nif: m.nif,
        score: m.score,
        nombre_empresa: cliMap3[m.nif] ?? m.nif,
        subvencion_titulo: Array.isArray(m.subvencion)
          ? (m.subvencion[0]?.titulo ?? null)
          : (m.subvencion?.titulo ?? null),
      }));

      setMatches(rows2);
    } catch {
      setMatches([]);
    }
  }

  useEffect(() => { cargar(); }, [cargar]);

  async function resolverAlerta(id: string) {
    if (id.startsWith('dyn-')) {
      setAlertasCriticas(prev => prev.filter(a => a.id !== id));
      return;
    }
    setResolviendo(id);
    try {
      await fetch(`/api/alertas?id=${id}`, { method: 'PATCH' });
      setAlertasCriticas(prev => prev.filter(a => a.id !== id));
    } finally {
      setResolviendo(null);
    }
  }

  const totalPendientes = alertasCriticas.length + solicitudes.length + expedientes.length + matches.length;
  const todoEnOrden = !loading && totalPendientes === 0;

  const PRIORIDAD_COLOR: Record<string, string> = {
    critica: '#ef4444',
    alta: '#f97316',
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{
            fontSize: '26px', fontWeight: '800', color: 'var(--ink)',
            marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <Inbox size={26} />
            Bandeja de entrada
            {!loading && totalPendientes > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff',
                fontSize: '0.7rem', fontWeight: 700,
                padding: '3px 9px', borderRadius: '100px',
                verticalAlign: 'middle',
              }}>
                {totalPendientes}
              </span>
            )}
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '14px', margin: 0 }}>
            Todo lo que necesita atención ahora
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 16px', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: '13px', color: 'var(--ink2)', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <RefreshCw size={14} />
          }
          Actualizar
        </button>
      </div>

      {/* Estado: todo en orden */}
      {todoEnOrden && (
        <div style={{
          background: 'var(--surface)', borderRadius: '16px',
          border: '1px solid var(--border)',
          padding: '72px 40px', textAlign: 'center',
          boxShadow: 'var(--s1)',
        }}>
          <CheckCircle size={52} style={{ color: '#22c55e', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--ink)', marginBottom: '8px' }}>
            Todo en orden ✓
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '15px', maxWidth: '340px', margin: '0 auto' }}>
            No hay alertas urgentes, solicitudes pendientes ni plazos inminentes. ¡Buen trabajo!
          </p>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--ink2)' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue)' }} />
          <p style={{ marginTop: '12px', fontSize: '14px' }}>Cargando bandeja...</p>
        </div>
      )}

      {!loading && !todoEnOrden && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* A) Alertas críticas / altas */}
          <section>
            <SeccionHeader
              emoji="🔴"
              titulo="Alertas críticas y altas"
              count={alertasCriticas.length}
              color="#ef4444"
            />
            {alertasCriticas.length === 0 ? (
              <VacioSutil texto="Sin alertas críticas ni altas — todo tranquilo" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alertasCriticas.map(alerta => {
                  const color = PRIORIDAD_COLOR[alerta.prioridad] ?? '#f97316';
                  return (
                    <div
                      key={alerta.id}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderLeft: `4px solid ${color}`,
                        borderRadius: '10px',
                        padding: '14px 18px',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '16px',
                        alignItems: 'center',
                        boxShadow: 'var(--s1)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.06em', padding: '2px 7px', borderRadius: '100px',
                            background: color + '18', color,
                          }}>
                            {alerta.prioridad}
                          </span>
                          {alerta.dias_restantes != null && (
                            <span style={{
                              fontSize: '0.72rem', fontWeight: 600,
                              color: (alerta.dias_restantes as number) <= 2 ? color : 'var(--ink2)',
                              display: 'flex', alignItems: 'center', gap: '3px',
                            }}>
                              <Clock size={11} />
                              {(alerta.dias_restantes as number) === 0 ? 'HOY' : (alerta.dias_restantes as number) < 0 ? `${Math.abs(alerta.dias_restantes as number)}d vencido` : `${alerta.dias_restantes}d`}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
                          {alerta.titulo}
                        </div>
                        {alerta.descripcion && (
                          <div style={{ fontSize: '12px', color: 'var(--ink2)' }}>
                            {alerta.descripcion}
                          </div>
                        )}
                        {alerta.fecha_limite && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                            Límite: {fmtFecha(alerta.fecha_limite)}
                          </div>
                        )}
                        {alerta.expediente_id && (
                          <Link
                            href={`/expedientes/${alerta.expediente_id}`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              fontSize: '12px', color: 'var(--blue)', textDecoration: 'none',
                              fontWeight: 500, marginTop: '6px',
                            }}
                          >
                            Ver expediente <ChevronRight size={11} />
                          </Link>
                        )}
                      </div>
                      <button
                        onClick={() => resolverAlerta(alerta.id)}
                        disabled={resolviendo === alerta.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 13px', borderRadius: '8px',
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          fontSize: '12px', color: 'var(--ink2)', cursor: 'pointer',
                          fontWeight: 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                        }}
                      >
                        <CheckCircle size={13} />
                        Resolver
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* B) Solicitudes pendientes */}
          <section>
            <SeccionHeader
              emoji="📋"
              titulo="Solicitudes pendientes de acción"
              count={solicitudes.length}
              color="#f97316"
            />
            {solicitudes.length === 0 ? (
              <VacioSutil texto="No hay solicitudes pendientes de gestionar" />
            ) : (
              <div style={{
                background: 'var(--surface)', borderRadius: '10px',
                border: '1px solid var(--border)', overflow: 'hidden',
                boxShadow: 'var(--s1)',
              }}>
                {solicitudes.map((sol, i) => (
                  <Link
                    key={sol.id}
                    href="/solicitudes"
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr auto auto',
                      gap: '12px',
                      padding: '13px 18px',
                      borderBottom: i < solicitudes.length - 1 ? '1px solid var(--border)' : 'none',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                          {sol.nombre_empresa ?? sol.nif}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sol.nif}</div>
                      </div>
                      <div style={{
                        fontSize: '12px', color: 'var(--ink2)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {sol.subvencion_titulo ?? '—'}
                      </div>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px',
                        borderRadius: '100px', background: '#fff7ed', color: '#c2410c',
                        whiteSpace: 'nowrap',
                      }}>
                        {ESTADO_LABELS[sol.estado] ?? sol.estado}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)' }}>
                        <span style={{ fontSize: '11px' }}>{fmtFecha(sol.created_at)}</span>
                        <ChevronRight size={13} color="var(--blue)" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* C) Expedientes con plazos urgentes */}
          <section>
            <SeccionHeader
              emoji="⏰"
              titulo="Expedientes con plazos urgentes"
              count={expedientes.length}
              color="#ef4444"
            />
            {expedientes.length === 0 ? (
              <VacioSutil texto="Sin expedientes con plazos en los próximos 7 días" />
            ) : (
              <div style={{
                background: 'var(--surface)', borderRadius: '10px',
                border: '1px solid var(--border)', overflow: 'hidden',
                boxShadow: 'var(--s1)',
              }}>
                {expedientes.map((exp, i) => {
                  const diasColor = exp.dias_restantes <= 0
                    ? '#ef4444'
                    : exp.dias_restantes <= 2
                    ? '#f97316'
                    : '#eab308';
                  return (
                    <Link
                      key={exp.id}
                      href={`/expedientes/${exp.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr auto auto',
                        gap: '12px',
                        padding: '13px 18px',
                        borderBottom: i < expedientes.length - 1 ? '1px solid var(--border)' : 'none',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                            {exp.nombre_empresa ?? exp.nif}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {exp.titulo ?? exp.id}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--ink2)' }}>
                            Plazo {FASE_LABELS[exp.fase ?? ''] ?? exp.fase}: {fmtFecha(exp.plazo)}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 700,
                          padding: '3px 9px', borderRadius: '100px',
                          background: diasColor + '18', color: diasColor,
                          whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                          <AlertTriangle size={11} />
                          {exp.dias_restantes === 0 ? 'HOY' : exp.dias_restantes < 0 ? `${Math.abs(exp.dias_restantes)}d vencido` : `${exp.dias_restantes}d`}
                        </span>
                        <ChevronRight size={13} color="var(--blue)" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* D) Matches nuevos */}
          <section>
            <SeccionHeader
              emoji="🎯"
              titulo="Matches nuevos sin revisar"
              count={matches.length}
              color="#1d4ed8"
            />
            {matches.length === 0 ? (
              <VacioSutil texto="No hay matches nuevos con score ≥ 50%" />
            ) : (
              <div style={{
                background: 'var(--surface)', borderRadius: '10px',
                border: '1px solid var(--border)', overflow: 'hidden',
                boxShadow: 'var(--s1)',
              }}>
                {matches.map((match, i) => {
                  const pct = Math.round(match.score * 100);
                  const scoreColor = pct >= 65 ? '#f97316' : pct >= 50 ? '#059669' : '#94a3b8';
                  return (
                    <Link
                      key={match.id}
                      href="/matches"
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr auto auto',
                        gap: '12px',
                        padding: '13px 18px',
                        borderBottom: i < matches.length - 1 ? '1px solid var(--border)' : 'none',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                            {match.nombre_empresa ?? match.nif}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{match.nif}</div>
                        </div>
                        <div style={{
                          fontSize: '12px', color: 'var(--ink2)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {match.subvencion_titulo ?? '—'}
                        </div>
                        <span style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 38, height: 38, borderRadius: '50%',
                          background: scoreColor + '20',
                          border: `2px solid ${scoreColor}`,
                          fontSize: '0.68rem', fontWeight: 700, color: scoreColor,
                          flexShrink: 0,
                        }}>
                          {pct}%
                        </span>
                        <ChevronRight size={13} color="var(--blue)" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {matches.length > 0 && (
              <div style={{ marginTop: '10px', textAlign: 'right' }}>
                <Link
                  href="/matches"
                  style={{
                    fontSize: '12px', color: 'var(--blue)', textDecoration: 'none',
                    fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  Ver todos los matches <ChevronRight size={12} />
                </Link>
              </div>
            )}
          </section>

        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
