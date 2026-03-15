'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nif: '',
    nombre_normalizado: '',
    email_normalizado: '',
    telefono: '',
    tamano_empresa: '',
    actividad: '',
    domicilio_fiscal: '',
    codigo_postal: '',
    ciudad: '',
    origen: '',
    acepta_terminos: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.nif) {
      setError('El NIF es obligatorio');
      setLoading(false);
      return;
    }

    if (!formData.acepta_terminos) {
      setError('Debe aceptar los términos y condiciones');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      const { error: insertError } = await supabase
        .from('cliente')
        .insert([{
          nif: formData.nif.toUpperCase(),
          nombre_normalizado: formData.nombre_normalizado || null,
          email_normalizado: formData.email_normalizado || null,
          telefono: formData.telefono || null,
          tamano_empresa: formData.tamano_empresa || null,
          actividad: formData.actividad || null,
          domicilio_fiscal: formData.domicilio_fiscal || null,
          codigo_postal: formData.codigo_postal || null,
          ciudad: formData.ciudad || null,
          origen: formData.origen || null,
          acepta_terminos: formData.acepta_terminos
        }]);

      if (insertError) {
        throw insertError;
      }

      router.push(`/clientes/${formData.nif.toUpperCase()}`);
    } catch (err: unknown) {
      console.error('Error creando cliente:', err);
      setError(err instanceof Error ? err.message : 'Error creando el cliente');
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Link 
          href="/clientes"
          style={{
            color: 'var(--teal)',
            fontSize: '14px',
            fontWeight: '600',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '16px'
          }}
        >
          ← Volver a clientes
        </Link>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          color: 'var(--ink)',
          marginBottom: '8px'
        }}>
          Nuevo Cliente
        </h1>
        <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
          Registra un nuevo cliente en el sistema
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit}>
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)'
        }}>
          {error && (
            <div style={{
              backgroundColor: 'var(--red-bg)',
              border: '1px solid var(--red)',
              color: 'var(--red)',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '24px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* NIF - Obligatorio */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                NIF / CIF *
              </label>
              <input
                type="text"
                name="nif"
                required
                value={formData.nif}
                onChange={handleChange}
                placeholder="Ej: B12345678"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  color: 'var(--ink)',
                  backgroundColor: 'var(--surface)',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Nombre */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Nombre / Razón Social
              </label>
              <input
                type="text"
                name="nombre_normalizado"
                value={formData.nombre_normalizado}
                onChange={handleChange}
                placeholder="Nombre completo o razón social"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  color: 'var(--ink)',
                  backgroundColor: 'var(--surface)',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Email y Teléfono */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email_normalizado"
                  value={formData.email_normalizado}
                  onChange={handleChange}
                  placeholder="email@empresa.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '15px',
                    color: 'var(--ink)',
                    backgroundColor: 'var(--surface)',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}>
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="600123456"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '15px',
                    color: 'var(--ink)',
                    backgroundColor: 'var(--surface)',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Tamaño Empresa y Actividad */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}>
                  Tamaño Empresa
                </label>
                <select
                  name="tamano_empresa"
                  value={formData.tamano_empresa}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '15px',
                    color: 'var(--ink)',
                    backgroundColor: 'var(--surface)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Microempresa">Microempresa</option>
                  <option value="Pequeña">Pequeña</option>
                  <option value="Mediana">Mediana</option>
                  <option value="Grande">Grande</option>
                </select>
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}>
                  Actividad
                </label>
                <input
                  type="text"
                  name="actividad"
                  value={formData.actividad}
                  onChange={handleChange}
                  placeholder="Sector o actividad principal"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '15px',
                    color: 'var(--ink)',
                    backgroundColor: 'var(--surface)',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Domicilio Fiscal */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Domicilio Fiscal
              </label>
              <input
                type="text"
                name="domicilio_fiscal"
                value={formData.domicilio_fiscal}
                onChange={handleChange}
                placeholder="Calle, número, etc."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  color: 'var(--ink)',
                  backgroundColor: 'var(--surface)',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Código Postal y Ciudad */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}>
                  Código Postal
                </label>
                <input
                  type="text"
                  name="codigo_postal"
                  value={formData.codigo_postal}
                  onChange={handleChange}
                  placeholder="28001"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '15px',
                    color: 'var(--ink)',
                    backgroundColor: 'var(--surface)',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}>
                  Ciudad
                </label>
                <input
                  type="text"
                  name="ciudad"
                  value={formData.ciudad}
                  onChange={handleChange}
                  placeholder="Madrid"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '15px',
                    color: 'var(--ink)',
                    backgroundColor: 'var(--surface)',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Origen */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Origen
              </label>
              <input
                type="text"
                name="origen"
                value={formData.origen}
                onChange={handleChange}
                placeholder="¿Cómo llegó este cliente? Ej: web, referido, evento"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  color: 'var(--ink)',
                  backgroundColor: 'var(--surface)',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Checkbox Términos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                name="acepta_terminos"
                checked={formData.acepta_terminos}
                onChange={handleChange}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer'
                }}
              />
              <label style={{
                fontSize: '14px',
                color: 'var(--ink2)',
                cursor: 'pointer'
              }}>
                El cliente acepta los términos y condiciones *
              </label>
            </div>
          </div>

          {/* Botones */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '32px',
            justifyContent: 'flex-end'
          }}>
            <Link href="/clientes">
              <button
                type="button"
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--ink2)'
                }}
              >
                Cancelar
              </button>
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: loading ? 'var(--muted)' : 'var(--teal)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--s1)'
              }}
            >
              {loading ? 'Guardando...' : 'Crear Cliente'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
