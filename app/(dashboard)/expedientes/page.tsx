'use client';

import Link from 'next/link';
import { FolderOpen, AlertTriangle, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Expediente {
  id: string;
  nif: string;
  numero_bdns: number | null;
  estado: string;
  titulo: string | null;
  fase: string | null;
  plazo_solicitud: string | null;
  plazo_aceptacion: string | null;
  plazo_justificacion: string | null;
  created_at: string;
  subvencion_id: string | null;
  cliente: { nombre_empresa?: string | null; nombre_normalizado: string | null } | null;
  subvencion: { titulo_comercial?: string | null; fecha_fin_solicitud?: string | null } | null;
}

/* ─── Constants ─────────────────────────────────────────────────────── */

const FASE_LABELS: Record<string, string> = {
  preparacion: 'Preparación',
  presentada: 'Presentada',
  instruccion: 'Instrucción',
  resolucion_provisional: 'Res. Provisional',
  alegaciones: 'Alegaciones',
  resolucion_definitiva: 'Res. Definitiva',
  aceptacion: 'Aceptación ⚡',
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

const estadoBadgeStyles: Record<string, { bg: string; color: string }> = {
  en_tramitacion: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
  presentado:     { bg: 'var(--blue-bg)', color: 'var(--blue)' },
  concedido:      { bg: 'var(--green-bg)', color: 'var(--green)' },
  denegado:       { bg: 'var(--red-bg)', color: 'var(--red)' },
  cerrado:        { bg: 'var(--bg)', color: 'var(--ink2)' },
};

const estadoLabels: Record<string, string> = {
  en_tramitacion: 'En tramitación',
  presentado:     'Presentado',
  concedido:      'Concedido',
  denegado:       'Denegado',
  cerrado:        'Cerrado',
};

// Kanban columns — the 5 requested phases
const KANBAN_COLUMNS: { key: string; label: string; color: string; next: string | null }[] = [
  { key: 'preparacion', label: 'Documentación', color: '#6366f1', next: 'presentada' },
  { key: 'presentada', label: 'Presentación', color: '#3b82f6', next: 'instruccion' },
  { key: 'instruccion', label: 'Instrucción', color: '#8b5cf6', next: 'resolucion_provisional' },
  { key: 'resolucion_provisional', label: 'Resolución', color: '#f59e0b', next: 'alegaciones' },
  { key: 'cobro', label: 'Cobro', color: '#22c55e', next: null },
];

// Map phases to kanban columns (group intermediate phases into the 5 columns)
function getKanbanColumn(fase: string | null): string {
  if (!fase) return 'preparacion';
  if (fase === 'preparacion') return 'preparacion';
  if (fase === 'presentada') return 'presentada';
  if (fase === 'instruccion') return 'instruccion';
  // Group resolution-related phases
  if (['resolucion_provisional', 'alegaciones', 'resolucion_definitiva', 'aceptacion', 'ejecucion', 'justificacion'].includes(fase))
    return 'resolucion_provisional';
  if (fase === 'cobro') return 'cobro';
  // Terminal states — don't show in kanban
  return 'preparacion';
}

// Next fase in the full order (for "Mover a siguiente fase" button)
const FASES_ORDEN = [
  'preparacion', 'presentada', 'instruccion', 'resolucion_provisional',
  'alegaciones', 'resolucion_definitiva', 'aceptacion', 'ejecucion',
  'justificacion', 'cobro',
];

function getNextFase(fase: string | null): string | null {
  if (!fase) return 'presentada';
  const idx = FASES_ORDEN.indexOf(fase);
  if (idx < 0 || idx >= FASES_ORDEN.length - 1) return null;
  return FASES_ORDEN[idx + 1];
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const lim = new Date(fecha); lim.setHours(0,0,0,0);
  return Math.ceil((lim.getTime() - hoy.getTime()) / 86400000);
}

function getRelevantDeadline(exp: Expediente): number | null {
  const plazos = [
    exp.plazo_solicitud,
    exp.plazo_aceptacion,
    exp.plazo_justificacion,
    exp.subvencion?.fecha_fin_solicitud,
  ].filter(Boolean);

  let minDias: number | null = null;
  for (const p of plazos) {
    const d = diasHasta(p!);
    if (d !== null && (minDias === null || d < minDias)) minDias = d;
  }
  return minDias;
}

function getClienteName(exp: Expediente): string {
  return exp.cliente?.nombre_empresa || exp.cliente?.nombre_normalizado || exp.nif;
}

function getSubvencionTitle(exp: Expediente): string {
  return exp.subvencion?.titulo_comercial || exp.titulo || (exp.numero_bdns ? `BDNS ${exp.numero_bdns}` : '—');
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function UrgenciaBadge({ exp }: { exp: Expediente }) {
  const minDias = getRelevantDeadline(exp);
  if (minDias === null || minDias > 14) return null;

  const color = minDias <= 3 ? '#ef4444' : minDias <= 7 ? '#f97316' : '#eab308';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '100px',
      background: `${color}15`, color,
      fontSize: '12px', fontWeight: '700',
    }}>
      <AlertTriangle size={11} />
      {minDias === 0 ? 'HOY' : minDias < 0 ? 'VENCIDO' : `${minDias}d`}
    </span>
  );
}

function UrgenciaDot({ dias }: { dias: number | null }) {
  if (dias === null || dias > 14) return null;
  const color = dias < 7 ? '#ef4444' : '#eab308';
  return (
    <span style={{
      width: '8px', height: '8px', borderRadius: '50%',
      backgroundColor: color, display: 'inline-block',
      flexShrink: 0,
    }} />
  );
}

/* ─── Kanban Card ───────────────────────────────────────────────────── */

function KanbanCard({ exp, onMoveFase }: {
  exp: Expediente;
  onMoveFase: (id: string, newFase: string) => void;
}) {
  const dias = getRelevantDeadline(exp);
  const nextFase = getNextFase(exp.fase);
  const faseColor = FASE_COLORS[exp.fase || 'preparacion'] || '#94a3b8';

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      borderRadius: '10px',
      border: '1px solid var(--border)',
      padding: '14px 16px',
      marginBottom: '10px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.15s',
      cursor: 'pointer',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
    >
      {/* Header: nombre empresa + urgencia */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <Link
          href={`/expedientes/${exp.id}`}
          style={{
            fontSize: '14px', fontWeight: '700', color: 'var(--navy)',
            textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {getClienteName(exp)}
        </Link>
        <UrgenciaDot dias={dias} />
      </div>

      {/* Subvencion title */}
      <Link
        href={`/expedientes/${exp.id}`}
        style={{
          fontSize: '13px', color: 'var(--ink2)',
          textDecoration: 'none',
          display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: '1.4',
          marginBottom: '10px',
        }}
      >
        {getSubvencionTitle(exp)}
      </Link>

      {/* Footer: días + fase badge + botón mover */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '11px', fontWeight: '600',
            padding: '2px 8px', borderRadius: '100px',
            background: `${faseColor}15`, color: faseColor,
          }}>
            {FASE_LABELS[exp.fase || 'preparacion'] || exp.fase}
          </span>
          {dias !== null && dias <= 14 && (
            <span style={{
              fontSize: '11px', fontWeight: '700',
              color: dias < 7 ? '#ef4444' : '#eab308',
            }}>
              {dias === 0 ? 'HOY' : dias < 0 ? `${Math.abs(dias)}d vencido` : `${dias}d`}
            </span>
          )}
        </div>

        {nextFase && (
          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onMoveFase(exp.id, nextFase);
            }}
            title={`Mover a ${FASE_LABELS[nextFase] || nextFase}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '2px',
              padding: '3px 8px', borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)', color: 'var(--ink2)',
              fontSize: '11px', fontWeight: '600',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--teal)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = 'var(--teal)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--bg)';
              e.currentTarget.style.color = 'var(--ink2)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            Avanzar <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Kanban Column ─────────────────────────────────────────────────── */

function KanbanColumn({ column, expedientes, onMoveFase }: {
  column: typeof KANBAN_COLUMNS[0];
  expedientes: Expediente[];
  onMoveFase: (id: string, newFase: string) => void;
}) {
  return (
    <div style={{
      flex: '1 1 0',
      minWidth: '240px',
      maxWidth: '320px',
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 14px',
        marginBottom: '12px',
        borderRadius: '10px',
        backgroundColor: `${column.color}10`,
        borderBottom: `3px solid ${column.color}`,
      }}>
        <span style={{
          width: '10px', height: '10px', borderRadius: '50%',
          backgroundColor: column.color,
        }} />
        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ink)' }}>
          {column.label}
        </span>
        <span style={{
          fontSize: '12px', fontWeight: '700',
          backgroundColor: `${column.color}20`, color: column.color,
          padding: '1px 8px', borderRadius: '100px',
          marginLeft: 'auto',
        }}>
          {expedientes.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{
        minHeight: '100px',
        maxHeight: 'calc(100vh - 280px)',
        overflowY: 'auto',
        paddingRight: '4px',
      }}>
        {expedientes.length === 0 && (
          <div style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: 'var(--ink2)',
            fontSize: '13px',
            opacity: 0.5,
          }}>
            Sin expedientes
          </div>
        )}
        {expedientes.map(exp => (
          <KanbanCard key={exp.id} exp={exp} onMoveFase={onMoveFase} />
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lista' | 'kanban'>('kanban');
  const [movingId, setMovingId] = useState<string | null>(null);

  const fetchExpedientes = useCallback(() => {
    fetch('/api/expedientes?incluirFase=1')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setExpedientes(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchExpedientes(); }, [fetchExpedientes]);

  const handleMoveFase = async (id: string, newFase: string) => {
    setMovingId(id);
    try {
      const res = await fetch(`/api/expedientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: newFase }),
      });
      if (res.ok) {
        // Optimistic update
        setExpedientes(prev =>
          prev.map(e => e.id === id ? { ...e, fase: newFase } : e)
        );
      }
    } catch (err) {
      console.error('Error moviendo fase:', err);
    } finally {
      setMovingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  // Group for kanban
  const kanbanGroups: Record<string, Expediente[]> = {};
  for (const col of KANBAN_COLUMNS) kanbanGroups[col.key] = [];
  for (const exp of expedientes) {
    if (exp.fase === 'denegada' || exp.fase === 'desistida') continue;
    const col = getKanbanColumn(exp.fase);
    if (kanbanGroups[col]) kanbanGroups[col].push(exp);
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--ink)',
            marginBottom: '8px',
          }}>
            Expedientes
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
            Seguimiento de expedientes de subvenciones
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View toggle tabs */}
          <div style={{
            display: 'flex',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setView('lista')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px',
                border: 'none',
                fontSize: '13px', fontWeight: '600',
                cursor: 'pointer',
                backgroundColor: view === 'lista' ? 'var(--teal)' : 'var(--surface)',
                color: view === 'lista' ? '#fff' : 'var(--ink2)',
                transition: 'all 0.15s',
              }}
            >
              <List size={15} />
              Lista
            </button>
            <button
              onClick={() => setView('kanban')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px',
                border: 'none',
                borderLeft: '1px solid var(--border)',
                fontSize: '13px', fontWeight: '600',
                cursor: 'pointer',
                backgroundColor: view === 'kanban' ? 'var(--teal)' : 'var(--surface)',
                color: view === 'kanban' ? '#fff' : 'var(--ink2)',
                transition: 'all 0.15s',
              }}
            >
              <LayoutGrid size={15} />
              Kanban
            </button>
          </div>

          <Link href="/expedientes/nuevo">
            <button style={{
              backgroundColor: 'var(--teal)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: 'var(--s1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <FolderOpen size={16} />
              Crear expediente
            </button>
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {(!expedientes || expedientes.length === 0) && (
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          padding: '64px 32px',
          textAlign: 'center',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📁</div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', marginBottom: '8px' }}>
            No hay expedientes registrados
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Los expedientes aparecerán aquí cuando los clientes inicien solicitudes
          </p>
        </div>
      )}

      {/* Kanban View */}
      {expedientes.length > 0 && view === 'kanban' && (
        <div style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '16px',
        }}>
          {KANBAN_COLUMNS.map(col => (
            <KanbanColumn
              key={col.key}
              column={col}
              expedientes={kanbanGroups[col.key] || []}
              onMoveFase={handleMoveFase}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {expedientes.length > 0 && view === 'lista' && (
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1.2fr 1.4fr 100px',
            gap: '16px',
            padding: '16px 24px',
            backgroundColor: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--ink2)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            <div>Cliente</div>
            <div>Subvención</div>
            <div>Fase</div>
            <div>Estado</div>
            <div>Urgencia</div>
          </div>

          {/* Table Body */}
          {expedientes.map((expediente: Expediente) => {
            const style = estadoBadgeStyles[expediente.estado] || { bg: 'var(--bg)', color: 'var(--ink2)' };
            const clienteNombre = getClienteName(expediente);
            const fase = expediente.fase || 'preparacion';
            const faseColor = FASE_COLORS[fase] || '#94a3b8';
            const faseLabel = FASE_LABELS[fase] || fase;

            return (
              <Link
                key={expediente.id}
                href={`/expedientes/${expediente.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="table-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1.2fr 1.4fr 100px',
                    gap: '16px',
                    padding: '18px 24px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--navy)', marginBottom: '2px' }}>
                      {clienteNombre}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getSubvencionTitle(expediente)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--ink2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {getSubvencionTitle(expediente)}
                  </div>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '100px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: `${faseColor}18`,
                      color: faseColor,
                    }}>
                      {faseLabel}
                    </span>
                  </div>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      backgroundColor: style.bg,
                      color: style.color,
                    }}>
                      {estadoLabels[expediente.estado] || expediente.estado}
                    </span>
                  </div>
                  <div>
                    <UrgenciaBadge exp={expediente} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
