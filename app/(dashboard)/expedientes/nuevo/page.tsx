'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Cliente {
  nif: string;
  nombre_empresa: string | null;
  nombre_normalizado: string | null;
}

export default function NuevoExpedientePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteNif = searchParams.get('cliente');

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formData, setFormData] = useState({
    nif: clienteNif || '',
    titulo: '',
    estado: 'en_tramitacion',
    notas: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setClientes(data) : null)
      .catch(() => null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/expedientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al crear el expediente');
      router.push(`/expedientes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
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
                  {cliente.nombre_empresa || cliente.nombre_normalizado || cliente.nif}
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label style={{
              display: 'block', fontSize: '14px', fontWeight: '600',
              color: 'var(--ink)', marginBottom: '8px'
            }}>
              Título de la subvención
            </label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ej: Ayudas para digitalización PYME 2025"
              style={{
                width: '100%', padding: '12px', fontSize: '15px',
                border: '1px solid var(--border)', borderRadius: '8px',
                backgroundColor: 'white', color: 'var(--ink)', outline: 'none'
              }}
            />
          </div>

          {/* Estado */}
          <div>
            <label style={{
              display: 'block', fontSize: '14px', fontWeight: '600',
              color: 'var(--ink)', marginBottom: '8px'
            }}>
              Estado inicial *
            </label>
            <select
              required
              value={formData.estado}
              onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              style={{
                width: '100%', padding: '12px', fontSize: '15px',
                border: '1px solid var(--border)', borderRadius: '8px',
                backgroundColor: 'white', color: 'var(--ink)', outline: 'none'
              }}
            >
              <option value="en_tramitacion">En tramitación</option>
              <option value="concedido">Concedido</option>
              <option value="denegado">Denegado</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label style={{
              display: 'block', fontSize: '14px', fontWeight: '600',
              color: 'var(--ink)', marginBottom: '8px'
            }}>
              Notas internas
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Observaciones, próximos pasos..."
              rows={3}
              style={{
                width: '100%', padding: '12px', fontSize: '15px',
                border: '1px solid var(--border)', borderRadius: '8px',
                backgroundColor: 'white', color: 'var(--ink)',
                outline: 'none', fontFamily: 'inherit', resize: 'vertical'
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
