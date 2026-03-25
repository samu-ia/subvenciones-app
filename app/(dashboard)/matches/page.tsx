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

// ─── Componente fila ──────────────────────────────────────────────────────────

function FilaMatch({ m, onEstadoChange }: {
  m: Match;
  onEstadoChange: (id: string, estado: string) => void;
}) {
  const si = scoreInfo(m.score);
  const est = ESTADO_STYLE[m.estado] ?? ESTADO_STYLE.nuevo;
  const dias = diasRestantes(m.subvencion?.plazo_fin);
  const urgente = dias !== null && dias >= 0 && dias <= 15;
  const [cambiando, setCambiando] = useState(false);

  async function cambiarEstado(nuevoEstado: string) {
    if (cambiando) return;
    setCambiando(true);
    onEstadoChange(m.id, nuevoEstado);
    setCambiando(false);
  }

  return (
    <div style={{
      background: C.surface, border: `1px solid ${m.estado === 'nuevo' ? '#bfdbfe' : C.border}`,
      borderRadius: 10, padding: '14px 16px',
      display: 'grid', gridTemplateColumns: '56px 1fr 200px 120px',
      gap: 16, alignItems: 'center',
      opacity: m.estado === 'descartado' ? 0.55 : 1,
    }}>
      {/* Score */}
      <div style={{
        width: 52, height: 52, borderRadius: 10,
        background: si.bg, border: `2px solid ${si.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: si.color, lineHeight: 1 }}>
          {Math.round(m.score * 100)}
        </span>
        <span style={{ fontSize: '0.55rem', color: si.color, fontWeight: 600 }}>%</span>
      </div>

      {/* Info principal */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.83rem', fontWeight: 700, color: C.navy, marginBottom: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.cliente?.nombre_empresa || m.nif}
        </div>
        <div style={{ fontSize: '0.78rem', color: C.ink2, marginBottom: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.subvencion?.titulo || '—'}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {m.subvencion?.organismo && (
            <span style={{ fontSize: '0.68rem', color: C.muted, background: '#f1f5f9',
              padding: '2px 7px', borderRadius: 100 }}>
              {m.subvencion.organismo.slice(0, 40)}
            </span>
          )}
          {m.subvencion?.importe_maximo && (
            <span style={{ fontSize: '0.68rem', color: C.blue, background: C.blueBg,
              padding: '2px 7px', borderRadius: 100, fontWeight: 600 }}>
              hasta {fmtImporte(m.subvencion.importe_maximo)}
            </span>
          )}
          {m.subvencion?.comunidad_autonoma && (
            <span style={{ fontSize: '0.68rem', color: C.ink2, background: '#f1f5f9',
              padding: '2px 7px', borderRadius: 100 }}>
              {m.subvencion.comunidad_autonoma}
            </span>
          )}
          {m.motivos?.slice(0, 1).map((mot, i) => (
            <span key={i} style={{ fontSize: '0.68rem', color: C.green, background: C.greenBg,
              padding: '2px 7px', borderRadius: 100 }}>
              {mot}
            </span>
          ))}
        </div>
      </div>

      {/* Plazo */}
      <div style={{ textAlign: 'right' }}>
        {m.subvencion?.estado_convocatoria === 'abierta' ? (
          dias !== null ? (
            <div>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                color: urgente ? C.fire : C.green,
                background: urgente ? C.fireBg : C.greenBg,
                padding: '3px 8px', borderRadius: 100,
              }}>
                {dias < 0 ? 'Vencida' : dias === 0 ? 'Hoy' : `${dias}d`}
              </span>
              {dias >= 0 && <div style={{ fontSize: '0.65rem', color: C.muted, marginTop: 3 }}>{fmtFecha(m.subvencion?.plazo_fin)}</div>}
            </div>
          ) : (
            <span style={{ fontSize: '0.72rem', color: C.green, fontWeight: 600 }}>Abierta</span>
          )
        ) : (
          <span style={{ fontSize: '0.72rem', color: C.muted }}>
            {m.subvencion?.estado_convocatoria ?? '—'}
          </span>
        )}
      </div>

      {/* Estado + acciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 100,
          color: est.color, background: est.bg,
        }}>
          {est.label}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {m.estado !== 'interesado' && (
            <button onClick={() => cambiarEstado('interesado')}
              title="Marcar como interesado"
              style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 6,
                border: `1px solid ${C.green}`, color: C.green, background: 'transparent',
                cursor: 'pointer', fontWeight: 600,
              }}>
              Interesado
            </button>
          )}
          {m.estado !== 'descartado' && (
            <button onClick={() => cambiarEstado('descartado')}
              title="Descartar match"
              style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 6,
                border: `1px solid ${C.border}`, color: C.muted, background: 'transparent',
                cursor: 'pointer',
              }}>
              <X size={10} />
            </button>
          )}
          {m.estado === 'descartado' && (
            <button onClick={() => cambiarEstado('nuevo')}
              title="Restaurar"
              style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 6,
                border: `1px solid ${C.border}`, color: C.muted, background: 'transparent',
                cursor: 'pointer',
              }}>
              Restaurar
            </button>
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
    <div style={{ maxWidth: 1100 }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: C.navy, marginBottom: 4 }}>
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
        borderRadius: 10, padding: '12px 16px', marginBottom: 16,
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

      {/* Lista */}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: 4 }}>
            {matchesFiltrados.length} matches{matchesFiltrados.length !== matches.length ? ` de ${matches.length}` : ''}
          </div>
          {matchesFiltrados.map(m => (
            <FilaMatch key={m.id} m={m} onEstadoChange={cambiarEstado} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
