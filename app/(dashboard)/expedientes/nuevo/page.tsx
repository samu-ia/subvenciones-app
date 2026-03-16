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

export default function NuevoExpedientePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteNif = searchParams.get('cliente');

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formData, setFormData] = useState({
    nif: clienteNif || '',
    numero_bdns: '',
    estado: 'lead_caliente'
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
      
      const insertData: any = {
        nif: formData.nif,
        estado: formData.estado
      };

      // Solo agregar numero_bdns si se proporcionó
      if (formData.numero_bdns) {
        insertData.numero_bdns = parseInt(formData.numero_bdns);
      }

      const { data, error: insertError } = await supabase
        .from('expediente')
        .insert([insertData])
        .select()
        .single();

      if (insertError) {
        console.error('Error creando expediente:', insertError);
        setError('Error al crear el expediente. Por favor, intenta de nuevo.');
        setLoading(false);
        return;
      }

      // Redirigir a la página del expediente creado
      router.push(`/expedientes/${data.id}`);
    } catch (err) {
      console.error('Error:', err);
      setError('Error inesperado. Por favor, intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px' }}>
      <Link
        href="/expedientes"
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
        Volver a expedientes
      </Link>

      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        color: 'var(--ink)',
        marginBottom: '32px'
      }}>
        Nuevo Expediente
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
              value={formData.nif}
              onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
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

          {/* Número BDNS */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Número BDNS
            </label>
            <input
              type="number"
              value={formData.numero_bdns}
              onChange={(e) => setFormData({ ...formData, numero_bdns: e.target.value })}
              placeholder="Ej: 123456"
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
            <p style={{
              fontSize: '13px',
              color: 'var(--muted)',
              marginTop: '6px',
              marginBottom: 0
            }}>
              Opcional - Puedes dejarlo en blanco si aún no tienes el número
            </p>
          </div>

          {/* Estado */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Estado inicial *
            </label>
            <select
              required
              value={formData.estado}
              onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
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
              <option value="lead_caliente">Lead Caliente</option>
              <option value="en_proceso">En Proceso</option>
              <option value="presentado">Presentado</option>
              <option value="resuelto">Resuelto</option>
              <option value="descartado">Descartado</option>
            </select>
          </div>

          {/* Botones */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)'
          }}>
            <Link href="/expedientes">
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
              {loading ? 'Creando...' : 'Crear expediente'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
