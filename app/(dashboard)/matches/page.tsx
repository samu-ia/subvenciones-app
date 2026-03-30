'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  RefreshCw, Loader2, TrendingUp, Building2, FileText,
  CheckCircle, Clock, ChevronRight, Zap, Filter, X,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Match {
  id: string;
  nif: string;
  score: number;
  motivos: string[];
  estado: string;
  notificado_cliente: boolean;
  calculado_at: string | null;
  detalle_scoring: Record<string, number> | null;
  subvencion: {
    id: string;
    titulo: string;
    organismo?: string;
    importe_maximo?: number;
    plazo_fin?: string;
    estado_convocatoria: string;
    ambito_geografico?: string;
    comunidad_autonoma?: string;
  } | null;
  cliente: {
    nombre_empresa?: string;
    comunidad_autonoma?: string;
    cnae_descripcion?: string;
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const C = {
  navy: '#0d1f3c', blue: '#1d4ed8', blueBg: '#eff6ff',
  green: '#059669', greenBg: '#ecfdf5',
  fire: '#f97316', fireBg: '#fff7ed',
  muted: '#94a3b8', border: '#e2e8f0',
  surface: '#ffffff', bg: '#f8fafc',
  ink: '#1e293b', ink2: '#475569',
  red: '#dc2626', redBg: '#fef2f2',
};

function scoreInfo(s: number) {
  if (s >= 0.65) return { label: 'Muy recomendable', color: C.fire, bg: C.fireBg, border: '#fed7aa' };
  if (s >= 0.40) return { label: 'Buen encaje',       color: C.green, bg: C.greenBg, border: '#a7f3d0' };
  return               { label: 'Encaje posible',      color: C.muted, bg: C.bg, border: C.border };
}

function scoreCircleColor(s: number): string {
  if (s >= 0.65) return '#f97316';
  if (s >= 0.40) return '#0d9488';
  return '#94a3b8';
}

function fmtImporte(n?: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n} €`;
}

function fmtFecha(s?: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function diasRestantes(s?: string | null): number | null {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000);
}

const ESTADO_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  nuevo:       { label: 'Nuevo',       color: '#1d4ed8', bg: '#eff6ff' },
  visto:       { label: 'Visto',       color: C.muted,   bg: C.bg },
  interesado:  { label: 'Interesado',  color: C.green,   bg: C.greenBg },
  descartado:  { label: 'Descartado',  color: C.muted,   bg: '#f1f5f9' },
};

// ─── Componente tarjeta ───────────────────────────────────────────────────────

function FilaMatch({ m, onEstadoChange }: {
  m: Match;
  onEstadoChange: (id: string, estado: string) => void;
}) {
  const est = ESTADO_STYLE[m.estado] ?? ESTADO_STYLE.nuevo;
  const dias = diasRestantes(m.subvencion?.plazo_fin);
  const urgente = dias !== null && dias >= 0 && dias <= 15;
  const [cambiando, setCambiando] = useState(false);
  const circleColor = scoreCircleColor(m.score);
  const scoreNum = Math.round(m.score * 100);

  async function cambiarEstado(nuevoEstado: string) {
    if (cambiando) return;
    setCambiando(true);
    onEstadoChange(m.id, nuevoEstado);
    setCambiando(false);
  }

  const importe = fmtImporte(m.subvencion?.importe_maximo);
  const motivo = m.motivos?.[0] ?? null;
  const comunidad = m.subvencion?.comunidad_autonoma ?? null;
  const organismo = m.subvencion?.organismo ?? null;

  // Deadline pill
  let deadlinePill: React.ReactNode = null;
  if (m.subvencion?.estado_convocatoria === 'abierta') {
    if (dias !== null) {
      const deadlineColor = dias < 0 ? C.muted : urgente ? C.fire : C.green;
      const deadlineBg   = dias < 0 ? '#f1f5f9' : urgente ? C.fireBg : C.greenBg;
      const deadlineText = dias < 0 ? 'Vencida' : dias === 0 ? 'Hoy cierra' : `${dias}d restantes`;
      deadlinePill = (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.7rem', fontWeight: 600,
          color: deadlineColor, background: deadlineBg,
          border: `1px solid ${deadlineColor}22`,
          padding: '3px 9px', borderRadius: 100,
        }}>
          <Clock size={10} />
          {deadlineText}
          {dias >= 0 && fmtFecha(m.subvencion?.plazo_fin) && (
            <span style={{ opacity: 0.75 }}>· {fmtFecha(m.subvencion?.plazo_fin)}</span>
          )}
        </span>
      );
    } else {
      deadlinePill = (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.7rem', fontWeight: 600,
          color: C.green, background: C.greenBg,
          border: `1px solid #a7f3d0`,
          padding: '3px 9px', borderRadius: 100,
        }}>
          Abierta
        </span>
      );
    }
  }

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${m.estado === 'nuevo' ? '#bfdbfe' : C.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      opacity: m.estado === 'descartado' ? 0.45 : 1,
      transition: 'box-shadow 0.15s ease, opacity 0.2s ease',
    }}
      onMouseEnter={e => { if (m.estado !== 'descartado') (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* Row 1: title + score circle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          fontSize: '0.9rem', fontWeight: 700, color: C.navy,
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1,
        }}>
          {m.subvencion?.titulo || '—'}
        </div>
        {/* Score circle */}
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: `${circleColor}18`,
          border: `2px solid ${circleColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: circleColor, lineHeight: 1 }}>
            {scoreNum}
          </span>
        </div>
      </div>

      {/* Row 2: organismo + comunidad tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {organismo && (
          <span style={{
            fontSize: '0.72rem', color: C.ink2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 260,
          }}>
            {organismo}
          </span>
        )}
        {comunidad && (
          <span style={{
            fontSize: '0.68rem', color: C.ink2, background: '#f1f5f9',
            border: `1px solid ${C.border}`,
            padding: '2px 8px', borderRadius: 100, flexShrink: 0,
          }}>
            {comunidad}
          </span>
        )}
        {/* empresa */}
        {m.cliente?.nombre_empresa && (
          <span style={{
            fontSize: '0.68rem', color: C.muted,
            marginLeft: 'auto', flexShrink: 0,
          }}>
            {m.cliente.nombre_empresa}
          </span>
        )}
      </div>

      {/* Row 3: chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {importe && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '0.7rem', fontWeight: 700,
            color: C.blue, background: C.blueBg,
            border: `1px solid #bfdbfe`,
            padding: '3px 9px', borderRadius: 100,
          }}>
            € {importe}
          </span>
        )}
        {motivo && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '0.7rem', fontWeight: 600,
            color: C.green, background: C.greenBg,
            border: `1px solid #a7f3d0`,
            padding: '3px 9px', borderRadius: 100,
            maxWidth: 220,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {motivo}
          </span>
        )}
        {deadlinePill}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: C.border, margin: '2px 0' }} />

      {/* Row 4: estado badge + action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 100,
          color: est.color, background: est.bg,
          border: `1px solid ${est.color}22`,
        }}>
          {est.label}
        </span>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {m.estado === 'descartado' ? (
            <button
              onClick={() => cambiarEstado('nuevo')}
              title="Restaurar"
              style={{
                fontSize: '0.72rem', fontWeight: 600,
                padding: '5px 12px', borderRadius: 7,
                border: `1px solid ${C.border}`,
                color: C.ink2, background: C.bg,
                cursor: 'pointer',
              }}>
              Restaurar
            </button>
          ) : (
            <>
              {m.estado !== 'interesado' && (
                <button
                  onClick={() => cambiarEstado('interesado')}
                  title="Marcar como interesado"
                  style={{
                    fontSize: '0.72rem', fontWeight: 700,
                    padding: '5px 12px', borderRadius: 7,
                    border: `1px solid ${C.green}`,
                    color: '#fff', background: C.green,
                    cursor: 'pointer',
                  }}>
                  Interesado
                </button>
              )}
              <button
                onClick={() => cambiarEstado('descartado')}
                title="Descartar match"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  border: `1px solid ${C.border}`,
                  color: C.muted, background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <X size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MatchesPage() {
  const supabase = createClient();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [resultado, setResultado] = useState<{ nuevos: number; actualizados: number; clientes: number; subvenciones: number } | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTier, setFiltroTier] = useState<string>('todos');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cliente_subvencion_match')
      .select(`
        id, nif, score, motivos, estado, notificado_cliente, calculado_at, detalle_scoring,
        subvencion:subvencion_id (
          id, titulo, organismo, importe_maximo, plazo_fin,
          estado_convocatoria, ambito_geografico, comunidad_autonoma
        ),
        cliente:nif (
          nombre_empresa, comunidad_autonoma, cnae_descripcion
        )
      `)
      .eq('es_hard_exclude', false)
      .gte('score', 0.1)
      .order('score', { ascending: false })
      .limit(300);

    setMatches((data as unknown as Match[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { cargar(); }, [cargar]);

  async function recalcular() {
    setRecalculando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/matching/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        setResultado({
          nuevos: data.nuevos ?? 0,
          actualizados: data.actualizados ?? 0,
          clientes: data.clientes_procesados ?? 0,
          subvenciones: data.subvenciones_activas ?? 0,
        });
        await cargar();
      }
    } finally {
      setRecalculando(false);
    }
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, estado: nuevoEstado } : m));
    await supabase.from('cliente_subvencion_match').update({ estado: nuevoEstado }).eq('id', id);
  }

  // Filtros
  const matchesFiltrados = matches.filter(m => {
    if (filtroEstado !== 'todos' && m.estado !== filtroEstado) return false;
    if (filtroTier === 'alto' && m.score < 0.65) return false;
    if (filtroTier === 'medio' && (m.score < 0.40 || m.score >= 0.65)) return false;
    if (filtroTier === 'bajo' && m.score >= 0.40) return false;
    if (filtroBusqueda) {
      const q = filtroBusqueda.toLowerCase();
      const empresa = (m.cliente?.nombre_empresa ?? '').toLowerCase();
      const titulo = (m.subvencion?.titulo ?? '').toLowerCase();
      if (!empresa.includes(q) && !titulo.includes(q)) return false;
    }
    return true;
  });

  // Stats
  const totalActivos = matches.filter(m => m.estado !== 'descartado').length;
  const nuevos = matches.filter(m => m.estado === 'nuevo').length;
  const muyRecomendable = matches.filter(m => m.score >= 0.65 && m.estado !== 'descartado').length;
  const interesados = matches.filter(m => m.estado === 'interesado').length;

  return (
    <div style={{ maxWidth: 1200, padding: '32px 40px' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 4, letterSpacing: '-0.02em' }}>
            Matches activos
          </h1>
          <p style={{ fontSize: '0.83rem', color: C.ink2 }}>
            Subvenciones relevantes calculadas para cada cliente. Recalcula cuando añadas clientes o lleguen nuevas convocatorias.
          </p>
        </div>
        <button
          onClick={recalcular}
          disabled={recalculando}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.navy, color: '#fff',
            border: 'none', borderRadius: 10, padding: '10px 18px',
            fontSize: '0.83rem', fontWeight: 700, cursor: recalculando ? 'not-allowed' : 'pointer',
            opacity: recalculando ? 0.7 : 1, flexShrink: 0,
          }}
        >
          {recalculando
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Recalculando...</>
            : <><RefreshCw size={15} /> Recalcular todo</>
          }
        </button>
      </div>

      {/* Resultado recálculo */}
      {resultado && (
        <div style={{
          background: C.greenBg, border: `1px solid #a7f3d0`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <CheckCircle size={18} color={C.green} />
          <span style={{ fontSize: '0.83rem', color: '#065f46', fontWeight: 600 }}>
            Matching completado — {resultado.clientes} clientes × {resultado.subvenciones} subvenciones.
            {' '}{resultado.nuevos} nuevos matches, {resultado.actualizados} actualizados.
          </span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total activos', value: totalActivos, icon: TrendingUp, color: C.blue, bg: C.blueBg },
          { label: 'Sin revisar', value: nuevos, icon: Zap, color: '#d97706', bg: '#fffbeb' },
          { label: 'Muy recomendable', value: muyRecomendable, icon: FileText, color: C.fire, bg: C.fireBg },
          { label: 'Interesados', value: interesados, icon: CheckCircle, color: C.green, bg: C.greenBg },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: C.navy, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <Filter size={14} color={C.muted} />

        {/* Búsqueda */}
        <input
          value={filtroBusqueda}
          onChange={e => setFiltroBusqueda(e.target.value)}
          placeholder="Buscar empresa o subvención..."
          style={{
            border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px',
            fontSize: '0.78rem', color: C.ink, background: C.bg,
            outline: 'none', width: 220,
          }}
        />

        {/* Estado */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['todos', 'nuevo', 'visto', 'interesado', 'descartado'] as const).map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              style={{
                fontSize: '0.72rem', padding: '4px 10px', borderRadius: 7,
                border: `1px solid ${filtroEstado === e ? C.blue : C.border}`,
                color: filtroEstado === e ? C.blue : C.muted,
                background: filtroEstado === e ? C.blueBg : 'transparent',
                cursor: 'pointer', fontWeight: filtroEstado === e ? 700 : 400,
                textTransform: 'capitalize',
              }}>
              {e === 'todos' ? 'Todos' : (ESTADO_STYLE[e]?.label ?? e)}
            </button>
          ))}
        </div>

        {/* Tier */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'alto', label: '>= 65%' },
            { key: 'medio', label: '40-65%' },
            { key: 'bajo', label: '< 40%' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFiltroTier(key)}
              style={{
                fontSize: '0.72rem', padding: '4px 10px', borderRadius: 7,
                border: `1px solid ${filtroTier === key ? C.fire : C.border}`,
                color: filtroTier === key ? C.fire : C.muted,
                background: filtroTier === key ? C.fireBg : 'transparent',
                cursor: 'pointer', fontWeight: filtroTier === key ? 700 : 400,
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} color={C.blue} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : matchesFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontSize: '0.88rem' }}>
          No hay matches con los filtros seleccionados.
          {matches.length === 0 && (
            <div style={{ marginTop: 12 }}>
              <button onClick={recalcular} style={{
                background: C.navy, color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontSize: '0.83rem', cursor: 'pointer', fontWeight: 600,
              }}>
                Calcular matches ahora
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: 12 }}>
            {matchesFiltrados.length} matches{matchesFiltrados.length !== matches.length ? ` de ${matches.length}` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {matchesFiltrados.map(m => (
              <FilaMatch key={m.id} m={m} onEstadoChange={cambiarEstado} />
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
