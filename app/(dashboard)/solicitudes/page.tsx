'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ClipboardList, ChevronRight, CheckCircle, Clock, XCircle,
  AlertCircle, FileText, CreditCard, Loader2, X, ChevronDown,
  ArrowUpRight, RefreshCw, Building2, Zap,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Solicitud {
  id: string;
  nif: string;
  estado: string;
  encaje_score?: number;
  contrato_firmado: boolean;
  metodo_pago_ok: boolean;
  metodo_pago?: string;
  notas_admin?: string;
  rechazado_motivo?: string;
  created_at: string;
  updated_at: string;
  nombre_firmante?: string;
  dni_firmante?: string;
  porcentaje_exito?: number;
  expediente_id?: string;
  respuestas_encaje?: Array<{ pregunta: string; respuesta: boolean }>;
  subvencion: {
    id: string;
    bdns_id: string;
    titulo: string;
    organismo?: string;
    importe_maximo?: number;
    estado_convocatoria: string;
  };
  match?: {
    score: number;
    motivos: string[];
  };
  cliente?: {
    nombre_empresa?: string;
    ciudad?: string;
    comunidad_autonoma?: string;
  };
}

interface Stats {
  total: number;
  pendiente_encaje: number;
  encaje_confirmado: number;
  contrato_pendiente: number;
  contrato_firmado: number;
  pago_pendiente: number;
  activo: number;
  rechazado: number;
  cancelado: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtE(n?: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n} €`;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pendiente_encaje:   { label: 'Pendiente encaje',  color: '#92400e', bg: '#fffbeb', icon: <Clock size={12} /> },
  encaje_confirmado:  { label: 'Encaje confirmado', color: '#1d4ed8', bg: '#eff6ff', icon: <CheckCircle size={12} /> },
  contrato_pendiente: { label: 'Contrato pendiente', color: '#6d28d9', bg: '#f5f3ff', icon: <FileText size={12} /> },
  contrato_firmado:   { label: 'Contrato firmado',  color: '#065f46', bg: '#ecfdf5', icon: <CheckCircle size={12} /> },
  pago_pendiente:     { label: 'Pago pendiente',    color: '#9a3412', bg: '#fff7ed', icon: <CreditCard size={12} /> },
  activo:             { label: 'Activo',             color: '#065f46', bg: '#ecfdf5', icon: <Zap size={12} /> },
  rechazado:          { label: 'Rechazado',          color: '#991b1b', bg: '#fef2f2', icon: <XCircle size={12} /> },
  cancelado:          { label: 'Cancelado',          color: '#374151', bg: '#f9fafb', icon: <X size={12} /> },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, color: '#374151', bg: '#f3f4f6', icon: null };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function ScoreDot({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 65 ? '#f97316' : pct >= 40 ? '#059669' : '#94a3b8';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, borderRadius: '50%',
      background: color + '20', border: `2px solid ${color}`,
      fontSize: '0.7rem', fontWeight: 700, color,
    }}>
      {pct}%
    </span>
  );
}

// ─── Modal detalle ─────────────────────────────────────────────────────────────

function ModalDetalle({
  sol,
  onClose,
  onRefresh,
}: {
  sol: Solicitud;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [accion, setAccion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState(sol.notas_admin ?? '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function ejecutar(tipo: string) {
    setLoading(true);
    setMsg('');
    const body: Record<string, string> = { tipo };
    if (tipo === 'rechazar') body.motivo = motivo;
    if (tipo === 'activar_expediente') body.notas = notas;
    if (tipo === 'cambiar_estado') { body.estado = accion; body.notas = notas; }

    const res = await fetch(`/api/solicitudes/${sol.id}/accion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error ?? 'Error');
    else { setMsg(''); onRefresh(); onClose(); }
    setLoading(false);
  }

  const canActivar = ['activo', 'contrato_firmado', 'pago_pendiente', 'encaje_confirmado'].includes(sol.estado);
  const canRechazar = !['rechazado', 'cancelado'].includes(sol.estado);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '20px',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflowY: 'auto', padding: 32,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {sol.nif} · {sol.cliente?.nombre_empresa ?? sol.nif}
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0d1f3c', margin: 0, lineHeight: 1.3 }}>
              {sol.subvencion.titulo}
            </h2>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <EstadoBadge estado={sol.estado} />
              {sol.match && <ScoreDot score={sol.match.score} />}
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{fmt(sol.created_at)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Info general */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            ['Organismo', sol.subvencion.organismo ?? '—'],
            ['BDNS', sol.subvencion.bdns_id],
            ['Importe máx.', fmtE(sol.subvencion.importe_maximo) ?? '—'],
            ['Ciudad', sol.cliente?.ciudad ?? '—'],
            ['Encaje score', sol.encaje_score != null ? `${sol.encaje_score}/5 preguntas` : '—'],
            ['Porcentaje éxito', sol.porcentaje_exito ? `${sol.porcentaje_exito}%` : '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
              <div style={{ fontSize: '0.85rem', color: '#0d1f3c', fontWeight: 600, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Encaje */}
        {sol.respuestas_encaje && sol.respuestas_encaje.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>Respuestas encaje</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sol.respuestas_encaje.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 12px', borderRadius: 8,
                  background: r.respuesta ? '#ecfdf5' : '#fef2f2',
                }}>
                  <span style={{ color: r.respuesta ? '#059669' : '#dc2626', marginTop: 1 }}>
                    {r.respuesta ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#374151', flex: 1 }}>{r.pregunta}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contrato */}
        {sol.contrato_firmado && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46', marginBottom: 4 }}>Contrato firmado</div>
            <div style={{ fontSize: '0.8rem', color: '#374151' }}>
              Firmante: <strong>{sol.nombre_firmante}</strong> · DNI: {sol.dni_firmante}
            </div>
          </div>
        )}

        {/* Pago */}
        {sol.metodo_pago_ok && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>Método de pago confirmado</div>
            <div style={{ fontSize: '0.8rem', color: '#374151' }}>
              Método: {sol.metodo_pago === 'tarjeta' ? 'Tarjeta de crédito' : sol.metodo_pago === 'transferencia' ? 'Transferencia bancaria' : sol.metodo_pago}
            </div>
          </div>
        )}

        {/* Rechazado motivo */}
        {sol.rechazado_motivo && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>Motivo rechazo</div>
            <div style={{ fontSize: '0.8rem', color: '#374151' }}>{sol.rechazado_motivo}</div>
          </div>
        )}

        {/* Motivos match */}
        {sol.match?.motivos && sol.match.motivos.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>Motivos del match</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sol.match.motivos.map((m, i) => (
                <span key={i} style={{
                  padding: '3px 10px', borderRadius: 20,
                  background: '#eff6ff', color: '#1d4ed8',
                  fontSize: '0.75rem', fontWeight: 500,
                }}>{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Notas admin */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
            Notas internas
          </label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            placeholder="Notas visibles solo para el equipo..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid #e2e8f0', fontSize: '0.82rem',
              fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Acciones */}
        <div style={{ borderTop: '1px solid #e8ecf4', paddingTop: 20 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 12 }}>Acciones</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {canActivar && !sol.expediente_id && (
              <button
                onClick={() => ejecutar('activar_expediente')}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                  background: '#0d9488', color: '#fff', border: 'none',
                  fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                Activar expediente
              </button>
            )}

            {sol.expediente_id && (
              <a
                href={`/expedientes/${sol.expediente_id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8,
                  background: '#eff6ff', color: '#1d4ed8',
                  fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none',
                }}
              >
                <ArrowUpRight size={14} />
                Ver expediente
              </a>
            )}

            {/* Cambio de estado manual */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={accion}
                onChange={e => setAccion(e.target.value)}
                style={{
                  padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
                  fontSize: '0.8rem', fontFamily: 'inherit', background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <option value="">Cambiar estado…</option>
                {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              {accion && (
                <button
                  onClick={() => ejecutar('cambiar_estado')}
                  disabled={loading}
                  style={{
                    padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                    background: '#1d4ed8', color: '#fff', border: 'none',
                    fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  Aplicar
                </button>
              )}
            </div>
          </div>

          {canRechazar && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Motivo del rechazo..."
                style={{
                  flex: 1, padding: '7px 12px', borderRadius: 8,
                  border: '1px solid #fecaca', fontSize: '0.8rem',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => ejecutar('rechazar')}
                disabled={loading || !motivo.trim()}
                style={{
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  background: motivo.trim() ? '#dc2626' : '#fca5a5', color: '#fff',
                  border: 'none', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                Rechazar
              </button>
            </div>
          )}

          {msg && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: '0.8rem' }}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function SolicitudesPage() {
  const supabase = createClient();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [selected, setSelected] = useState<Solicitud | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const q = supabase
      .from('solicitudes')
      .select(`
        id, nif, estado, encaje_score, contrato_firmado, metodo_pago_ok,
        metodo_pago, notas_admin, rechazado_motivo, created_at, updated_at,
        nombre_firmante, dni_firmante, porcentaje_exito, expediente_id,
        respuestas_encaje,
        subvencion:subvenciones(id, bdns_id, titulo, organismo, importe_maximo, estado_convocatoria),
        match:cliente_subvencion_match(score, motivos)
      `)
      .order('updated_at', { ascending: false });

    if (filtroEstado) q.eq('estado', filtroEstado);

    const { data, error } = await q;
    if (error) { setLoading(false); return; }

    // Obtener NIFs únicos para cargar datos de cliente
    const nifs = [...new Set((data ?? []).map((s: any) => s.nif))];
    const { data: clientes } = nifs.length > 0
      ? await supabase.from('cliente').select('nif, nombre_empresa, ciudad, comunidad_autonoma').in('nif', nifs)
      : { data: [] };

    const clienteMap = Object.fromEntries((clientes ?? []).map((c: any) => [c.nif, c]));

    const rows: Solicitud[] = (data ?? []).map((s: any) => ({
      ...s,
      subvencion: Array.isArray(s.subvencion) ? s.subvencion[0] : s.subvencion,
      match: Array.isArray(s.match) ? s.match[0] : s.match,
      cliente: clienteMap[s.nif],
    }));

    setSolicitudes(rows);

    // Stats
    const st: Stats = {
      total: rows.length,
      pendiente_encaje: 0, encaje_confirmado: 0, contrato_pendiente: 0,
      contrato_firmado: 0, pago_pendiente: 0, activo: 0, rechazado: 0, cancelado: 0,
    };
    for (const r of rows) {
      if (r.estado in st) (st as any)[r.estado]++;
    }
    setStats(st);
    setLoading(false);
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  const visible = solicitudes.filter(s => {
    if (!filtroTexto) return true;
    const q = filtroTexto.toLowerCase();
    return (
      s.nif.toLowerCase().includes(q) ||
      s.cliente?.nombre_empresa?.toLowerCase().includes(q) ||
      s.subvencion.titulo?.toLowerCase().includes(q) ||
      s.subvencion.organismo?.toLowerCase().includes(q)
    );
  });

  const funnel = [
    { key: 'pendiente_encaje',   label: 'Pendiente encaje',  color: '#d97706' },
    { key: 'encaje_confirmado',  label: 'Encaje OK',          color: '#1d4ed8' },
    { key: 'contrato_pendiente', label: 'Contrato pendiente', color: '#7c3aed' },
    { key: 'contrato_firmado',   label: 'Contrato firmado',  color: '#0891b2' },
    { key: 'pago_pendiente',     label: 'Pago pendiente',    color: '#ea580c' },
    { key: 'activo',             label: 'Activos',            color: '#059669' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #0d1f3c, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ClipboardList size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0d1f3c' }}>Solicitudes</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              Gestión del flujo Quiero esta → encaje → contrato → pago → expediente
            </p>
          </div>
        </div>
      </div>

      {/* Funnel stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
          {funnel.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltroEstado(filtroEstado === f.key ? '' : f.key)}
              style={{
                flex: 1, minWidth: 110,
                padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${filtroEstado === f.key ? f.color : '#e8ecf4'}`,
                background: filtroEstado === f.key ? f.color + '15' : '#fff',
                textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: f.color, lineHeight: 1 }}>
                {(stats as any)[f.key] ?? 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 3, fontWeight: 500 }}>
                {f.label}
              </div>
            </button>
          ))}
          {(stats.rechazado > 0 || stats.cancelado > 0) && (
            <div style={{
              flex: 1, minWidth: 110, padding: '12px 14px', borderRadius: 12,
              border: '1px solid #e8ecf4', background: '#f9fafb',
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#94a3b8', lineHeight: 1 }}>
                {stats.rechazado + stats.cancelado}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 3 }}>
                Rechazados/Cancelados
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
        <input
          value={filtroTexto}
          onChange={e => setFiltroTexto(e.target.value)}
          placeholder="Buscar por NIF, empresa, subvención..."
          style={{
            flex: 1, padding: '8px 14px', borderRadius: 8,
            border: '1px solid #e2e8f0', fontSize: '0.85rem',
            fontFamily: 'inherit', background: '#fff',
          }}
        />
        {filtroEstado && (
          <button
            onClick={() => setFiltroEstado('')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #e2e8f0', background: '#f8fafc',
              fontSize: '0.8rem', color: '#475569', fontFamily: 'inherit',
            }}
          >
            <X size={13} />
            Quitar filtro
          </button>
        )}
        <button
          onClick={cargar}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid #e2e8f0', background: '#f8fafc',
            fontSize: '0.8rem', color: '#475569', fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={13} />
          Actualizar
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : visible.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          border: '2px dashed #e8ecf4', borderRadius: 16,
        }}>
          <ClipboardList size={40} color="#e2e8f0" />
          <p style={{ color: '#94a3b8', marginTop: 12 }}>
            {solicitudes.length === 0 ? 'Aún no hay solicitudes' : 'Sin resultados para ese filtro'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #e8ecf4', borderRadius: 12, overflow: 'hidden' }}>
          {/* Cabecera tabla */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 1fr 120px 80px 100px 36px',
            gap: 12, padding: '10px 16px',
            background: '#f8fafc', borderBottom: '1px solid #e8ecf4',
            fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <div></div>
            <div>Cliente</div>
            <div>Subvención</div>
            <div>Estado</div>
            <div>Score</div>
            <div>Fecha</div>
            <div></div>
          </div>

          {visible.map((s, i) => (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 1fr 120px 80px 100px 36px',
                gap: 12, padding: '14px 16px',
                borderBottom: i < visible.length - 1 ? '1px solid #f1f5f9' : 'none',
                cursor: 'pointer', alignItems: 'center',
                background: selected?.id === s.id ? '#f0f9ff' : '#fff',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (selected?.id !== s.id) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
              onMouseLeave={e => { if (selected?.id !== s.id) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
            >
              {/* Icono empresa */}
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Building2 size={14} color="#1d4ed8" />
              </div>

              {/* Cliente */}
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0d1f3c' }}>
                  {s.cliente?.nombre_empresa ?? s.nif}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {s.nif}{s.cliente?.ciudad ? ` · ${s.cliente.ciudad}` : ''}
                </div>
              </div>

              {/* Subvención */}
              <div>
                <div style={{
                  fontSize: '0.82rem', fontWeight: 500, color: '#334155',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 240,
                }}>
                  {s.subvencion.titulo}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {s.subvencion.organismo ?? '—'}
                  {s.subvencion.importe_maximo ? ` · ${fmtE(s.subvencion.importe_maximo)}` : ''}
                </div>
              </div>

              {/* Estado */}
              <div><EstadoBadge estado={s.estado} /></div>

              {/* Score */}
              <div>
                {s.match ? <ScoreDot score={s.match.score} /> : <span style={{ color: '#e2e8f0' }}>—</span>}
              </div>

              {/* Fecha */}
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{fmt(s.created_at)}</div>

              {/* Arrow */}
              <div style={{ color: '#cbd5e1' }}><ChevronRight size={16} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {!loading && visible.length > 0 && (
        <div style={{ marginTop: 12, fontSize: '0.78rem', color: '#94a3b8', textAlign: 'right' }}>
          {visible.length} solicitud{visible.length !== 1 ? 'es' : ''}
          {filtroTexto || filtroEstado ? ` (de ${solicitudes.length} total)` : ''}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <ModalDetalle
          sol={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { cargar(); setSelected(null); }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
