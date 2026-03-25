'use client';

import Link from 'next/link';
import { FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Expediente {
  id: string;
  nif: string;
  numero_bdns: number | null;
  estado: string;
  titulo: string | null;
  created_at: string;
  cliente: { nombre_empresa?: string | null; nombre_normalizado: string | null } | null;
}

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

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/expedientes')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setExpedientes(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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
            gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1.5fr',
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
            <div>NIF</div>
            <div>Estado</div>
            <div>Fecha Creación</div>
          </div>

          {/* Table Body */}
          {expedientes.map((expediente: Expediente) => {
            const style = estadoBadgeStyles[expediente.estado] || { bg: 'var(--bg)', color: 'var(--ink2)' };
            const clienteNombre = expediente.cliente?.nombre_empresa || expediente.cliente?.nombre_normalizado || expediente.nif;
            
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
                    gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1.5fr',
                    gap: '16px',
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--navy)'
                  }}>
                    {clienteNombre}
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
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--ink2)',
                    fontFamily: 'monospace'
                  }}>
                    {expediente.nif}
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
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--ink2)'
                  }}>
                    {formatDate(expediente.created_at)}
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
