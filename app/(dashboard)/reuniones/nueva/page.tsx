'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Cliente {
  nif: string;
  nombre_normalizado: string | null;
}

export default function NuevaReunionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteNif = searchParams.get('cliente');

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formData, setFormData] = useState({
    cliente_nif: clienteNif || '',
    titulo: '',
    tipo: 'exploratoria',
    fecha_programada: '',
    duracion_minutos: 60,
    objetivo: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchClientes() {
      const supabase = createClient();
      const { data } = await supabase
        .from('cliente')
        .select('nif, nombre_normalizado')
        .order('nombre_normalizado');
      
      if (data) {
        setClientes(data);
      }
    }
    fetchClientes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      
      // Convertir fecha local a ISO string
      const fechaISO = new Date(formData.fecha_programada).toISOString();

      const { data, error: insertError } = await supabase
        .from('reuniones')
        .insert([{
          cliente_nif: formData.cliente_nif,
          titulo: formData.titulo,
          tipo: formData.tipo,
          fecha_programada: fechaISO,
          duracion_minutos: formData.duracion_minutos,
          objetivo: formData.objetivo,
          estado: 'pendiente'
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error creando reunión:', insertError);
        setError('Error al crear la reunión. Por favor, intenta de nuevo.');
        setLoading(false);
        return;
      }

      // Redirigir a la página de la reunión creada
      router.push(`/reuniones/${data.id}`);
    } catch (err) {
      console.error('Error:', err);
      setError('Error inesperado. Por favor, intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px' }}>
      <Link
        href="/reuniones"
        style={{
          color: 'var(--teal)',
          fontSize: '14px',
          fontWeight: '600',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '24px'
        }}
      >
        <ArrowLeft size={16} />
        Volver a reuniones
      </Link>

      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        color: 'var(--ink)',
        marginBottom: '32px'
      }}>
        Nueva Reunión
      </h1>

      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--red-bg)',
          color: 'var(--red)',
          borderRadius: '8px',
          marginBottom: '24px',
          border: '1px solid var(--red)'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          padding: '32px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Cliente */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Cliente *
            </label>
            <select
              required
              value={formData.cliente_nif}
              onChange={(e) => setFormData({ ...formData, cliente_nif: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: 'var(--ink)',
                outline: 'none'
              }}
            >
              <option value="">Selecciona un cliente</option>
              {clientes.map(cliente => (
                <option key={cliente.nif} value={cliente.nif}>
                  {cliente.nombre_normalizado || cliente.nif}
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Título *
            </label>
            <input
              type="text"
              required
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ej: Reunión inicial para presentar servicios"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: 'var(--ink)',
                outline: 'none'
              }}
            />
          </div>

          {/* Tipo */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Tipo *
            </label>
            <select
              required
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: 'var(--ink)',
                outline: 'none'
              }}
            >
              <option value="exploratoria">Exploratoria</option>
              <option value="seguimiento">Seguimiento</option>
              <option value="presentacion">Presentación</option>
              <option value="firma">Firma</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {/* Fecha y hora */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Fecha y hora *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.fecha_programada}
              onChange={(e) => setFormData({ ...formData, fecha_programada: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: 'var(--ink)',
                outline: 'none'
              }}
            />
          </div>

          {/* Duración */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Duración (minutos)
            </label>
            <input
              type="number"
              value={formData.duracion_minutos}
              onChange={(e) => setFormData({ ...formData, duracion_minutos: parseInt(e.target.value) })}
              min="15"
              step="15"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: 'var(--ink)',
                outline: 'none'
              }}
            />
          </div>

          {/* Objetivo */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Objetivo de la reunión
            </label>
            <textarea
              value={formData.objetivo}
              onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
              placeholder="Describe brevemente el objetivo de esta reunión..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: 'var(--ink)',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Botones */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)'
          }}>
            <Link href="/reuniones">
              <button
                type="button"
                style={{
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: 'var(--ink2)',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: loading ? 'var(--muted)' : 'var(--teal)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creando...' : 'Crear reunión'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
