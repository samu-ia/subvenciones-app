import { createClient } from '@/lib/supabase/server';

interface Match {
  id: string;
  nif: string;
  estado: string;
  puntuacion: number | null;
  created_at: string;
  cliente: {
    nombre_normalizado: string | null;
  }[];
  ayudas: {
    titulo: string;
    numero_bdns: number | null;
  }[];
}

const estadoBadgeStyles: Record<string, { bg: string; color: string }> = {
  interesante: { bg: 'var(--green-bg)', color: 'var(--green)' },
  revisar: { bg: 'var(--amber-bg)', color: 'var(--amber)' },
  descartada: { bg: 'var(--red-bg)', color: 'var(--red)' },
  rentable: { bg: 'var(--blue-bg)', color: 'var(--blue)' }
};

const estadoLabels: Record<string, string> = {
  interesante: 'Interesante',
  revisar: 'Revisar',
  descartada: 'Descartada',
  rentable: 'Rentable'
};

export default async function MatchesPage() {
  const supabase = await createClient();
  
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      id,
      nif,
      estado,
      puntuacion,
      created_at,
      cliente:nif (
        nombre_normalizado
      ),
      ayudas:ayuda_id (
        titulo,
        numero_bdns
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando matches:', error);
  }

  const formatDate = (dateStr: string) => {
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
            Matches
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
            Coincidencias entre clientes y ayudas disponibles
          </p>
        </div>
      </div>

      {/* Lista de matches */}
      {!matches || matches.length === 0 ? (
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
          }}>🎯</div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            No hay matches registrados
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Los matches aparecerán cuando vincules clientes con ayudas
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
            gridTemplateColumns: '2fr 3fr 1fr 1fr 1.5fr',
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
            <div>Ayuda</div>
            <div>Estado</div>
            <div>Puntuación</div>
            <div>Fecha</div>
          </div>

          {/* Table Body */}
          {matches.map((match: Match) => {
            const style = estadoBadgeStyles[match.estado] || { bg: 'var(--bg)', color: 'var(--ink2)' };
            const clienteNombre = match.cliente?.[0]?.nombre_normalizado || match.nif;
            const ayudaTitulo = match.ayudas?.[0]?.titulo || 'Ayuda sin título';
            
            return (
              <div 
                key={match.id}
                className="table-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 3fr 1fr 1fr 1.5fr',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--ink)'
                  }}>
                    {ayudaTitulo}
                  </div>
                  {match.ayudas?.[0]?.numero_bdns && (
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--muted)',
                      fontFamily: 'monospace'
                    }}>
                      BDNS {match.ayudas[0].numero_bdns}
                    </div>
                  )}
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
                    {estadoLabels[match.estado] || match.estado}
                  </span>
                </div>
                <div>
                  {match.puntuacion !== null ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: match.puntuacion >= 7 
                        ? 'var(--green-bg)' 
                        : match.puntuacion >= 5 
                        ? 'var(--amber-bg)' 
                        : 'var(--red-bg)',
                      color: match.puntuacion >= 7 
                        ? 'var(--green)' 
                        : match.puntuacion >= 5 
                        ? 'var(--amber)' 
                        : 'var(--red)',
                      fontSize: '15px',
                      fontWeight: '700'
                    }}>
                      {match.puntuacion}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: '14px' }}>—</span>
                  )}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--ink2)'
                }}>
                  {formatDate(match.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
