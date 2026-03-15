import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

interface Ayuda {
  id: string;
  numero_bdns: number | null;
  titulo: string;
  organismo: string | null;
  estado: string;
  fecha_fin: string | null;
  importe_max: number | null;
}

const estadoBadgeStyles: Record<string, { bg: string; color: string }> = {
  abierta: { bg: 'var(--green-bg)', color: 'var(--green)' },
  cerrada: { bg: 'var(--red-bg)', color: 'var(--red)' },
  proxima: { bg: 'var(--amber-bg)', color: 'var(--amber)' },
  suspendida: { bg: 'var(--red-bg)', color: 'var(--red)' }
};

const estadoLabels: Record<string, string> = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  proxima: 'Próxima',
  suspendida: 'Suspendida'
};

export default async function AyudasPage() {
  const supabase = await createClient();
  
  const { data: ayudas, error } = await supabase
    .from('ayudas')
    .select('id, numero_bdns, titulo, organismo, estado, fecha_fin, importe_max')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando ayudas:', error);
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
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
            Ayudas y Subvenciones
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
            Catálogo de ayudas disponibles
          </p>
        </div>
        
        <Link href="/ayudas/nueva">
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
            transition: 'transform 0.2s'
          }}>
            + Nueva ayuda
          </button>
        </Link>
      </div>

      {/* Lista de ayudas */}
      {!ayudas || ayudas.length === 0 ? (
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
          }}>💰</div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            No hay ayudas registradas
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Comienza agregando la primera ayuda
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
            gridTemplateColumns: '3fr 2fr 1fr 1fr 1fr',
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
            <div>Título</div>
            <div>Organismo</div>
            <div>Estado</div>
            <div>Fecha Fin</div>
            <div>Importe Máx.</div>
          </div>

          {/* Table Body */}
          {ayudas.map((ayuda: Ayuda) => {
            const style = estadoBadgeStyles[ayuda.estado] || { bg: 'var(--bg)', color: 'var(--ink2)' };
            return (
              <div 
                key={ayuda.id}
                className="table-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 2fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--navy)'
                  }}>
                    {ayuda.titulo}
                  </div>
                  {ayuda.numero_bdns && (
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--muted)',
                      fontFamily: 'monospace'
                    }}>
                      BDNS {ayuda.numero_bdns}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--ink2)'
                }}>
                  {ayuda.organismo || '—'}
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
                    {estadoLabels[ayuda.estado] || ayuda.estado}
                  </span>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--ink2)'
                }}>
                  {formatDate(ayuda.fecha_fin)}
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--green)'
                }}>
                  {formatCurrency(ayuda.importe_max)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
