'use client';

import { Calendar, Plus } from 'lucide-react';
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sin fecha';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Calendar size={32} style={{ color: 'var(--teal)' }} />
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Reuniones</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--ink2)', fontSize: '15px' }}>
            Gestiona reuniones con clientes
          </p>
        </div>

        <Link
          href="/reuniones/nueva"
          style={{
            padding: '12px 24px',
            background: 'var(--teal)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '15px',
            fontWeight: 600,
          }}
        >
          <Plus size={20} />
          Nueva reunión
        </Link>
      </div>

      {reuniones.length === 0 ? (
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
          }}>📅</div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            No hay reuniones programadas
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Comienza creando tu primera reunión
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
          {reuniones.map((reunion) => (
            <Link
              key={reunion.id}
              href={`/reuniones/${reunion.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="table-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr',
                  gap: '16px',
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--ink)',
                    marginBottom: '4px'
                  }}>
                    {reunion.titulo || 'Sin título'}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--muted)'
                  }}>
                    {reunion.cliente?.nombre_empresa || reunion.cliente?.nombre_normalizado || reunion.cliente_nif || 'Sin cliente'}
                  </div>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--ink2)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {formatDate(reunion.fecha_programada)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {reunion.tipo && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      backgroundColor: 'var(--blue-bg)',
                      color: 'var(--blue)'
                    }}>
                      {reunion.tipo}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {reunion.estado && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      backgroundColor: reunion.estado === 'realizada' ? 'var(--green-bg)' : 'var(--amber-bg)',
                      color: reunion.estado === 'realizada' ? 'var(--green)' : 'var(--amber)'
                    }}>
                      {reunion.estado}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
