'use client';

import Link from 'next/link';
import { FolderOpen, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  cliente: { nombre_empresa?: string | null; nombre_normalizado: string | null } | null;
}

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

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const lim = new Date(fecha); lim.setHours(0,0,0,0);
  return Math.ceil((lim.getTime() - hoy.getTime()) / 86400000);
}

function UrgenciaBadge({ exp }: { exp: Expediente }) {
  // Find the closest relevant deadline
  const plazos = [
    exp.fase === 'aceptacion' ? exp.plazo_aceptacion : null,
    exp.fase === 'justificacion' ? exp.plazo_justificacion : null,
    exp.fase === 'preparacion' ? exp.plazo_solicitud : null,
  ].filter(Boolean);

  let minDias: number | null = null;
  for (const p of plazos) {
    const d = diasHasta(p);
    if (d !== null && (minDias === null || d < minDias)) minDias = d;
  }

  if (minDias === null) return null;
  if (minDias > 14) return null;

  const color = minDias <= 3 ? '#ef4444' : minDias <= 7 ? '#f97316' : '#eab308';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '100px',
      background: `${color}15`, color,
      fontSize: '12px', fontWeight: '700',
    }}>
      <AlertTriangle size={11} />
      {minDias === 0 ? 'HOY' : `${minDias}d`}
    </span>
  );
}

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/expedientes?incluirFase=1')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setExpedientes(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            Expedientes
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
            Seguimiento de expedientes de subvenciones
          </p>
        </div>
        
        <Link href="/expedientes/nuevo">
          <button style={{
            backgroundColor: 'var(--teal)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: 'var(--s1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FolderOpen size={18} />
            Crear expediente
          </button>
        </Link>
      </div>

      {/* Lista de expedientes */}
      {!expedientes || expedientes.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          padding: '64px 32px',
          textAlign: 'center',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: 0.3
          }}>📁</div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            No hay expedientes registrados
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Los expedientes aparecerán aquí cuando los clientes inicien solicitudes
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
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
            letterSpacing: '0.5px'
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
            const clienteNombre = expediente.cliente?.nombre_empresa || expediente.cliente?.nombre_normalizado || expediente.nif;
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
                      {expediente.titulo || (expediente.numero_bdns ? `BDNS ${expediente.numero_bdns}` : expediente.nif)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--ink2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {expediente.titulo || (expediente.numero_bdns ? `BDNS ${expediente.numero_bdns}` : '—')}
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
                      color: style.color
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
