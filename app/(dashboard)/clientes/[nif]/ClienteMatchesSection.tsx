'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { X, ChevronRight } from 'lucide-react';

interface MatchItem {
  id: string;
  score: number;
  motivos: string[] | null;
  estado: string;
  subvencion: {
    id: string;
    titulo: string;
    organismo?: string | null;
    importe_maximo?: number | null;
    plazo_fin?: string | null;
    estado_convocatoria: string;
  } | null;
}

const C = {
  navy: '#0d1f3c', blue: '#1d4ed8', blueBg: '#eff6ff',
  green: '#059669', greenBg: '#ecfdf5',
  fire: '#f97316', fireBg: '#fff7ed',
  muted: '#94a3b8', border: '#e2e8f0',
  surface: '#ffffff', bg: '#f8fafc',
  ink: '#1e293b', ink2: '#475569',
};

function scoreInfo(s: number) {
  if (s >= 0.65) return { label: 'Muy recomendable', color: C.fire, bg: C.fireBg, border: '#fed7aa' };
  if (s >= 0.40) return { label: 'Buen encaje',      color: C.green, bg: C.greenBg, border: '#a7f3d0' };
  return               { label: 'Encaje posible',     color: C.muted, bg: C.bg, border: C.border };
}

const ESTADO_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  nuevo:      { label: 'Nuevo',      color: '#1d4ed8', bg: '#eff6ff' },
  visto:      { label: 'Visto',      color: C.muted,   bg: C.bg },
  interesado: { label: 'Interesado', color: C.green,   bg: C.greenBg },
  descartado: { label: 'Descartado', color: C.muted,   bg: '#f1f5f9' },
};

function fmtImporte(n?: number | null) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n} €`;
}

function diasRestantes(s?: string | null) {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000);
}

function FilaMatch({ m, onEstadoChange }: {
  m: MatchItem;
  onEstadoChange: (id: string, estado: string) => void;
}) {
  const si = scoreInfo(m.score);
  const est = ESTADO_STYLE[m.estado] ?? ESTADO_STYLE.nuevo;
  const sub = m.subvencion;
  const dias = diasRestantes(sub?.plazo_fin);
  const urgente = dias !== null && dias >= 0 && dias <= 15;
  const pct = Math.round(m.score * 100);

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${m.estado === 'nuevo' ? '#bfdbfe' : C.border}`,
      borderRadius: 10,
      padding: '14px 16px',
      display: 'grid',
      gridTemplateColumns: '52px 1fr auto auto',
      gap: 14,
      alignItems: 'center',
      opacity: m.estado === 'descartado' ? 0.55 : 1,
    }}>

      {/* Score badge */}
      <div style={{
        width: 52, height: 52, borderRadius: 10,
        background: si.bg, border: `2px solid ${si.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: si.color, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontSize: '0.55rem', color: si.color, fontWeight: 600 }}>%</span>
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '0.84rem', fontWeight: 700, color: C.navy, marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {sub?.titulo || '—'}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {sub?.organismo && (
            <span style={{
              fontSize: '0.68rem', color: C.muted, background: '#f1f5f9',
              padding: '2px 7px', borderRadius: 100,
            }}>
              {sub.organismo.slice(0, 45)}
            </span>
          )}
          {sub?.importe_maximo && (
            <span style={{
              fontSize: '0.68rem', color: C.blue, background: C.blueBg,
              padding: '2px 7px', borderRadius: 100, fontWeight: 600,
            }}>
              hasta {fmtImporte(sub.importe_maximo)}
            </span>
          )}
          <span style={{
            fontSize: '0.68rem', color: si.color, background: si.bg,
            padding: '2px 7px', borderRadius: 100, fontWeight: 600,
          }}>
            {si.label}
          </span>
          {m.motivos?.[0] && (
            <span style={{
              fontSize: '0.68rem', color: C.green, background: C.greenBg,
              padding: '2px 7px', borderRadius: 100,
            }}>
              {m.motivos[0]}
            </span>
          )}
        </div>
      </div>

      {/* Plazo */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {sub?.estado_convocatoria === 'abierta' && dias !== null ? (
          <span style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: urgente ? C.fire : C.green,
            background: urgente ? C.fireBg : C.greenBg,
            padding: '3px 8px', borderRadius: 100,
          }}>
            {dias < 0 ? 'Vencida' : dias === 0 ? 'Hoy' : `${dias}d`}
          </span>
        ) : sub?.estado_convocatoria === 'proxima' ? (
          <span style={{ fontSize: '0.72rem', color: C.blue, fontWeight: 600 }}>Próxima</span>
        ) : sub?.estado_convocatoria === 'abierta' ? (
          <span style={{ fontSize: '0.72rem', color: C.green, fontWeight: 600 }}>Abierta</span>
        ) : null}
      </div>

      {/* Estado + acciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 100,
          color: est.color, background: est.bg,
        }}>
          {est.label}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {m.estado !== 'interesado' && (
            <button
              onClick={() => onEstadoChange(m.id, 'interesado')}
              style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 6,
                border: `1px solid ${C.green}`, color: C.green, background: 'transparent',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              Interesado
            </button>
          )}
          {m.estado !== 'descartado' && (
            <button
              onClick={() => onEstadoChange(m.id, 'descartado')}
              title="Descartar"
              style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 6,
                border: `1px solid ${C.border}`, color: C.muted, background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <X size={10} />
            </button>
          )}
          {m.estado === 'descartado' && (
            <button
              onClick={() => onEstadoChange(m.id, 'nuevo')}
              style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 6,
                border: `1px solid ${C.border}`, color: C.muted, background: 'transparent',
                cursor: 'pointer',
              }}
            >
              Restaurar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClienteMatchesSection({
  initialMatches,
  nif,
}: {
  initialMatches: MatchItem[];
  nif: string;
}) {
  const supabase = createClient();
  const [matches, setMatches] = useState<MatchItem[]>(
    initialMatches.map(m => ({
      ...m,
      subvencion: Array.isArray(m.subvencion) ? m.subvencion[0] : m.subvencion,
    }))
  );

  if (matches.length === 0) return null;

  async function cambiarEstado(id: string, nuevoEstado: string) {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, estado: nuevoEstado } : m));
    await supabase.from('cliente_subvencion_match').update({ estado: nuevoEstado }).eq('id', id);
  }

  const activos = matches.filter(m => m.estado !== 'descartado');

  return (
    <div style={{
      backgroundColor: C.surface, borderRadius: 12, padding: 24,
      border: '1px solid #bfdbfe', marginBottom: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: C.navy, margin: 0 }}>
            Subvenciones relevantes
          </h2>
          <p style={{ fontSize: '0.75rem', color: C.muted, margin: '3px 0 0' }}>
            {activos.length} oportunidades activas para este cliente
          </p>
        </div>
        <Link href="/matches" style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: '0.78rem', color: C.blue, textDecoration: 'none', fontWeight: 700,
        }}>
          Ver todos <ChevronRight size={14} />
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map(m => (
          <FilaMatch key={m.id} m={m} onEstadoChange={cambiarEstado} />
        ))}
      </div>
    </div>
  );
}
