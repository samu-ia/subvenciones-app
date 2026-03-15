'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function NuevaAyudaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    titulo: '',
    organismo: '',
    numero_bdns: '',
    descripcion: '',
    requisitos: '',
    importe_max: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'proxima',
    url_oficial: '',
    analisis_ia: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.titulo) {
      setError('El título es obligatorio');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      const { error: insertError } = await supabase
        .from('ayudas')
        .insert([{
          titulo: formData.titulo,
          organismo: formData.organismo || null,
          numero_bdns: formData.numero_bdns ? parseInt(formData.numero_bdns) : null,
          descripcion: formData.descripcion || null,
          requisitos: formData.requisitos || null,
          importe_max: formData.importe_max ? parseFloat(formData.importe_max) : null,
          fecha_inicio: formData.fecha_inicio || null,
          fecha_fin: formData.fecha_fin || null,
          estado: formData.estado,
          url_oficial: formData.url_oficial || null,
          analisis_ia: formData.analisis_ia || null
        }]);

      if (insertError) {
        throw insertError;
      }

      router.push('/ayudas');
    } catch (err: unknown) {
      console.error('Error creando ayuda:', err);
      setError(err instanceof Error ? err.message : 'Error creando la ayuda');
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Link 
          href="/ayudas"
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
          ← Volver a ayudas
        </Link>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          color: 'var(--ink)',
          marginBottom: '8px'
        }}>
          Nueva Ayuda
        </h1>
        <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
          Registra una nueva ayuda o subvención en el catálogo
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
            {/* Título - Obligatorio */}
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
                name="titulo"
                required
                value={formData.titulo}
                onChange={handleChange}
                placeholder="Título de la ayuda o subvención"
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

            {/* Organismo y Número BDNS */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}>
                  Organismo Convocante
                </label>
                <input
                  type="text"
                  name="organismo"
                  value={formData.organismo}
                  onChange={handleChange}
                  placeholder="Ej: Ministerio de Industria, CDTI, etc."
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
                  Número BDNS
                </label>
                <input
                  type="number"
                  name="numero_bdns"
                  value={formData.numero_bdns}
                  onChange={handleChange}
                  placeholder="123456"
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

            {/* Descripción */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Descripción
              </label>
              <textarea
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                placeholder="Describe brevemente en qué consiste esta ayuda"
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  color: 'var(--ink)',
                  backgroundColor: 'var(--surface)',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Requisitos */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Requisitos
              </label>
              <textarea
                name="requisitos"
                value={formData.requisitos}
                onChange={handleChange}
                placeholder="Requisitos y criterios de elegibilidad"
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  color: 'var(--ink)',
                  backgroundColor: 'var(--surface)',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Importe Máximo */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Importe Máximo (€)
              </label>
              <input
                type="number"
                name="importe_max"
                value={formData.importe_max}
                onChange={handleChange}
                placeholder="100000"
                step="0.01"
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

            {/* Fechas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}>
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  name="fecha_inicio"
                  value={formData.fecha_inicio}
                  onChange={handleChange}
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
                  Fecha Fin
                </label>
                <input
                  type="date"
                  name="fecha_fin"
                  value={formData.fecha_fin}
                  onChange={handleChange}
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

            {/* Estado */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Estado
              </label>
              <select
                name="estado"
                value={formData.estado}
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
                <option value="proxima">Próxima</option>
                <option value="abierta">Abierta</option>
                <option value="cerrada">Cerrada</option>
                <option value="suspendida">Suspendida</option>
              </select>
            </div>

            {/* URL Oficial */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                URL Oficial
              </label>
              <input
                type="url"
                name="url_oficial"
                value={formData.url_oficial}
                onChange={handleChange}
                placeholder="https://..."
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

            {/* Análisis IA */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Análisis IA
              </label>
              <textarea
                name="analisis_ia"
                value={formData.analisis_ia}
                onChange={handleChange}
                placeholder="Análisis automático o notas internas sobre esta ayuda"
                rows={6}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  color: 'var(--ink)',
                  backgroundColor: 'var(--surface)',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--teal)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>

          {/* Botones */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '32px',
            justifyContent: 'flex-end'
          }}>
            <Link href="/ayudas">
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
              {loading ? 'Guardando...' : 'Crear Ayuda'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
