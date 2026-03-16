'use client';

import { Calendar, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Reunion {
  id: string;
  titulo: string | null;
  tipo: string | null;
  estado: string | null;
  fecha_programada: string | null;
  cliente_nif: string | null;
  cliente: {
    nombre_normalizado: string | null;
  }[];
}

export default function ReunionesPage() {
  const router = useRouter();
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('¿Estás seguro de que quieres eliminar esta reunión?')) return;
    
    const supabase = createClient();
    const { error } = await supabase.from('reuniones').delete().eq('id', id);
    
    if (error) {
      alert('Error al eliminar la reunión');
      console.error(error);
    } else {
      setReuniones(reuniones.filter(r => r.id !== id));
    }
    setOpenMenuId(null);
  };

  const handleEdit = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/reuniones/${id}/editar`);
  };

  useEffect(() => {
    async function fetchReuniones() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('reuniones')
        .select(`
          id,
          titulo,
          tipo,
          estado,
          fecha_programada,
          cliente_nif,
          cliente:cliente_nif (
            nombre_normalizado
          )
        `)
        .order('fecha_programada', { ascending: false });

      if (error) {
        console.error('Error cargando reuniones:', error);
      } else {
        setReuniones(data || []);
      }
      setLoading(false);
    }
    fetchReuniones();
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
            <div
              key={reunion.id}
              className="table-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 50px',
                gap: '16px',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                position: 'relative'
              }}
              onClick={() => router.push(`/reuniones/${reunion.id}`)}
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
                    {reunion.cliente?.[0]?.nombre_normalizado || reunion.cliente_nif || 'Sin cliente'}
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
                
                {/* Menu de 3 puntos */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === reunion.id ? null : reunion.id);
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
                      color: 'var(--muted)'
                    }}
                  >
                    <MoreVertical size={18} />
                  </button>
                  
                  {openMenuId === reunion.id && (
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
                          onClick={(e) => handleEdit(reunion.id, e)}
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
                            textAlign: 'left'
                          }}
                        >
                          <Edit size={16} />
                          Editar
                        </button>
                        <button
                          onClick={(e) => handleDelete(reunion.id, e)}
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
                            borderTop: '1px solid var(--border)'
                          }}
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
