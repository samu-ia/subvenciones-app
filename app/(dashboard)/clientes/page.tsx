'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Cliente {
  nif: string;
  nombre_normalizado: string | null;
  actividad: string | null;
  tamano_empresa: string | null;
  ciudad: string | null;
}

export default function ClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClientes() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cliente')
        .select('nif, nombre_normalizado, actividad, tamano_empresa, ciudad')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error cargando clientes:', error);
      } else {
        setClientes(data || []);
        setFilteredClientes(data || []);
      }
      setLoading(false);
    }
    fetchClientes();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredClientes(clientes);
    } else {
      const filtered = clientes.filter(cliente => 
        cliente.nombre_normalizado?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.nif?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.actividad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.ciudad?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredClientes(filtered);
    }
  }, [searchTerm, clientes]);

  const handleDelete = async (nif: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) return;
    
    const supabase = createClient();
    const { error } = await supabase.from('cliente').delete().eq('nif', nif);
    
    if (error) {
      alert('Error al eliminar el cliente');
      console.error(error);
    } else {
      setClientes(clientes.filter(c => c.nif !== nif));
      setFilteredClientes(filteredClientes.filter(c => c.nif !== nif));
    }
    setOpenMenuId(null);
  };

  const handleEdit = (nif: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/clientes/${nif}/editar`);
  };

  if (loading) {
    return <div style={{ padding: '32px', textAlign: 'center' }}>Cargando...</div>;
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

      {/* Search Bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          position: 'relative',
          maxWidth: '500px'
        }}>
          <Search size={20} style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted)'
          }} />
          <input
            type="text"
            placeholder="Buscar clientes por nombre, NIF, actividad o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 48px',
              fontSize: '15px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--surface)',
              color: 'var(--ink)',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Lista de clientes */}
      {filteredClientes.length === 0 ? (
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
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            {searchTerm ? 'Intenta con otro término de búsqueda' : 'Comienza agregando tu primer cliente'}
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
            gridTemplateColumns: '2fr 1fr 2fr 1fr 1.5fr 50px',
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
            <div></div>
          </div>

          {/* Table Body */}
          {filteredClientes.map((cliente: Cliente) => (
            <div 
              key={cliente.nif}
              className="table-row" 
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 2fr 1fr 1.5fr 50px',
                gap: '16px',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                position: 'relative'
              }}
              onClick={() => router.push(`/clientes/${cliente.nif}`)}
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
              
              {/* Menu de 3 puntos */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === cliente.nif ? null : cliente.nif);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <MoreVertical size={18} />
                </button>
                
                {openMenuId === cliente.nif && (
                  <>
                    <div 
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      backgroundColor: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 1000,
                      minWidth: '160px',
                      overflow: 'hidden',
                      marginTop: '4px'
                    }}>
                      <button
                        onClick={(e) => handleEdit(cliente.nif, e)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '14px',
                          color: 'var(--ink)',
                          textAlign: 'left',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <Edit size={16} />
                        Editar
                      </button>
                      <button
                        onClick={(e) => handleDelete(cliente.nif, e)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '14px',
                          color: 'var(--red)',
                          textAlign: 'left',
                          borderTop: '1px solid var(--border)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--red-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <Trash2 size={16} />
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
