import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

interface Cliente {
  nif: string;
  nombre_normalizado: string | null;
  actividad: string | null;
  tamano_empresa: string | null;
  ciudad: string | null;
}

export default async function ClientesPage() {
  const supabase = await createClient();
  
  const { data: clientes, error } = await supabase
    .from('cliente')
    .select('nif, nombre_normalizado, actividad, tamano_empresa, ciudad')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando clientes:', error);
  }

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
            Clientes
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
            Gestiona la cartera de clientes
          </p>
        </div>
        
        <Link href="/clientes/nuevo">
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
            + Nuevo cliente
          </button>
        </Link>
      </div>

      {/* Lista de clientes */}
      {!clientes || clientes.length === 0 ? (
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
          }}>📋</div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            No hay clientes registrados
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Comienza agregando tu primer cliente
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
            gridTemplateColumns: '2fr 1fr 2fr 1fr 1.5fr',
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
            <div>NIF</div>
            <div>Actividad</div>
            <div>Tamaño</div>
            <div>Ciudad</div>
          </div>

          {/* Table Body */}
          {clientes.map((cliente: Cliente) => (
            <Link 
              key={cliente.nif} 
              href={`/clientes/${cliente.nif}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 2fr 1fr 1.5fr',
                gap: '16px',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: 'var(--navy)'
                }}>
                  {cliente.nombre_normalizado || cliente.nif}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--ink2)',
                  fontFamily: 'monospace'
                }}>
                  {cliente.nif}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--ink2)'
                }}>
                  {cliente.actividad || '—'}
                </div>
                <div>
                  {cliente.tamano_empresa && (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      backgroundColor: 'var(--blue-bg)',
                      color: 'var(--blue)'
                    }}>
                      {cliente.tamano_empresa}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--ink2)'
                }}>
                  {cliente.ciudad || '—'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
