'use client';

import { Calendar, Plus, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Reunion {
  id: string;
  titulo: string | null;
  tipo: string | null;
  estado: string | null;
  fecha_programada: string | null;
  cliente_nif: string | null;
  cliente: { nombre_empresa?: string | null; nombre_normalizado: string | null } | null;
}

const TIPO_COLORS: Record<string, { bg: string; color: string }> = {
  exploratoria:    { bg: '#eff6ff', color: '#1d4ed8' },
  seguimiento:     { bg: '#f5f3ff', color: '#7c3aed' },
  cierre:          { bg: '#ecfdf5', color: '#065f46' },
  presentacion:    { bg: '#fff7ed', color: '#c2410c' },
  tecnica:         { bg: '#f0f9ff', color: '#0c4a6e' },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Sin fecha';
  return new Date(dateStr).toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function isToday(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function ReunionRow({ reunion, onEstadoChange }: { reunion: Reunion; onEstadoChange?: (id: string, estado: string) => void }) {
  const hoy = isToday(reunion.fecha_programada);
  const tipo = TIPO_COLORS[reunion.tipo ?? ''] ?? { bg: '#f1f5f9', color: '#475569' };
  const esPasada = reunion.fecha_programada && new Date(reunion.fecha_programada) < new Date() && reunion.estado !== 'realizada';
  const [marking, setMarking] = useState(false);

  async function marcarRealizada(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMarking(true);
    try {
      await fetch(`/api/reuniones?id=${reunion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'realizada' }),
      });
      onEstadoChange?.(reunion.id, 'realizada');
    } finally {
      setMarking(false);
    }
  }

  return (
    <Link key={reunion.id} href={`/reuniones/${reunion.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.6fr 0.8fr 1fr',
          gap: 16,
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer',
          background: hoy ? '#fffbeb' : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!hoy) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = hoy ? '#fffbeb' : 'transparent'; }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            {hoy && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d97706', background: '#fef3c7', padding: '1px 7px', borderRadius: 20 }}>HOY</span>}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>{reunion.titulo || 'Sin título'}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            {reunion.cliente?.nombre_empresa || reunion.cliente?.nombre_normalizado || reunion.cliente_nif || 'Sin cliente'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: esPasada ? '#dc2626' : 'var(--ink2)' }}>
          {esPasada && <Clock size={12} />}
          {formatDate(reunion.fecha_programada)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {reunion.tipo && (
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: tipo.bg, color: tipo.color }}>
              {reunion.tipo}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {reunion.estado && (
            <span style={{
              padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
              background: reunion.estado === 'realizada' ? 'var(--green-bg)' : reunion.estado === 'cancelada' ? '#f1f5f9' : 'var(--amber-bg)',
              color: reunion.estado === 'realizada' ? 'var(--green)' : reunion.estado === 'cancelada' ? 'var(--muted)' : 'var(--amber)',
            }}>
              {reunion.estado}
            </span>
          )}
          {reunion.estado && reunion.estado !== 'realizada' && reunion.estado !== 'cancelada' && (
            <button
              onClick={marcarRealizada}
              disabled={marking}
              title="Marcar como realizada"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6, border: '1px solid var(--green)',
                background: 'var(--green-bg)', color: 'var(--green)',
                fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                opacity: marking ? 0.6 : 1, whiteSpace: 'nowrap',
              }}
            >
              <CheckCircle size={10} /> Realizada
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ReunionesPage() {
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reuniones')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setReuniones(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #e2e8f0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Cargando reuniones...
      </div>
    );
  }

  const ahora = new Date();
  const proximas = reuniones.filter(r => r.fecha_programada && new Date(r.fecha_programada) >= ahora && r.estado !== 'realizada' && r.estado !== 'cancelada');
  const pasadas = reuniones.filter(r => !proximas.includes(r));

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Calendar size={26} style={{ color: 'var(--teal)' }} />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}>Reuniones</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--ink2)', fontSize: '0.88rem' }}>
            {proximas.length} próximas · {pasadas.filter(r => r.estado === 'realizada').length} realizadas
          </p>
        </div>
        <Link
          href="/reuniones/nueva"
          style={{ padding: '10px 20px', background: 'var(--teal)', color: '#fff', borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 700 }}
        >
          <Plus size={16} /> Nueva reunión
        </Link>
      </div>

      {reuniones.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '60px 32px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📅</div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No hay reuniones programadas</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Comienza creando tu primera reunión</p>
        </div>
      ) : (
        <>
          {/* Columna de encabezado */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.6fr 0.8fr 0.8fr', gap: 16, padding: '8px 24px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 2 }}>
            <span>Reunión</span><span>Fecha</span><span>Tipo</span><span>Estado</span>
          </div>

          {/* Próximas */}
          {proximas.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '10px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: '#0d9488' }}>
                PRÓXIMAS ({proximas.length})
              </div>
              {[...proximas].sort((a, b) => new Date(a.fecha_programada!).getTime() - new Date(b.fecha_programada!).getTime()).map(r => (
                <ReunionRow key={r.id} reunion={r} />
              ))}
            </div>
          )}

          {/* Pasadas / realizadas */}
          {pasadas.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', opacity: 0.85 }}>
              <div style={{ padding: '10px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>
                HISTORIAL ({pasadas.length})
              </div>
              {pasadas.map(r => <ReunionRow key={r.id} reunion={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
