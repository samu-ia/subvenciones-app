import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ConvertirExpedienteButton from './ConvertirExpedienteButton'

export default async function OportunidadDetallePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: oportunidad, error } = await supabase
    .from('oportunidades')
    .select(`
      *,
      cliente:cliente_nif (
        nombre,
        nif,
        actividad,
        tamano_empresa,
        ciudad
      ),
      ayudas (
        nombre,
        organismo,
        tipo,
        ambito,
        importe_max
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !oportunidad) {
    return notFound()
  }

  // Cargar reuniones explorativas asociadas
  const { data: reuniones } = await supabase
    .from('reuniones')
    .select('*')
    .eq('oportunidad_id', params.id)
    .eq('tipo', 'exploratoria')
    .order('fecha', { ascending: false })

  const getEstadoColor = (estado: string) => {
    const colores: Record<string, { bg: string; text: string }> = {
      detectada: { bg: 'var(--blue-bg)', text: 'var(--blue)' },
      en_analisis: { bg: 'var(--amber-bg)', text: 'var(--amber)' },
      pendiente_reunion: { bg: 'var(--blue-bg)', text: 'var(--blue)' },
      presentada_cliente: { bg: 'var(--amber-bg)', text: 'var(--amber)' },
      interesada: { bg: 'var(--green-bg)', text: 'var(--green)' },
      descartada: { bg: 'var(--red-bg)', text: 'var(--red)' },
      convertida_expediente: { bg: 'var(--green-bg)', text: 'var(--green)' }
    }
    return colores[estado] || { bg: 'var(--bg)', text: 'var(--ink2)' }
  }

  const formatEstado = (estado: string) => {
    return estado.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Link
          href="/oportunidades"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--teal)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '16px'
          }}
        >
          ← Volver a Oportunidades
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              {oportunidad.nombre_ayuda}
            </h1>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{
                display: 'inline-block',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                ...getEstadoColor(oportunidad.estado),
                backgroundColor: getEstadoColor(oportunidad.estado).bg,
                color: getEstadoColor(oportunidad.estado).text
              }}>
                {formatEstado(oportunidad.estado)}
              </div>
              {oportunidad.probabilidad_estimada && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: oportunidad.probabilidad_estimada >= 70
                    ? 'var(--green-bg)'
                    : oportunidad.probabilidad_estimada >= 40
                      ? 'var(--amber-bg)'
                      : 'var(--red-bg)',
                  color: oportunidad.probabilidad_estimada >= 70
                    ? 'var(--green)'
                    : oportunidad.probabilidad_estimada >= 40
                      ? 'var(--amber)'
                      : 'var(--red)'
                }}>
                  Probabilidad: {oportunidad.probabilidad_estimada}%
                </div>
              )}
            </div>
          </div>
          <ConvertirExpedienteButton oportunidadId={params.id} oportunidad={oportunidad} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Columna izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Información del Cliente */}
          <div style={{
            background: 'var(--surface)',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--s1)'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--ink)',
              marginBottom: '20px'
            }}>
              Cliente
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', marginBottom: '4px' }}>
                  Nombre
                </div>
                <Link
                  href={`/clientes/${oportunidad.cliente.nif}`}
                  style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--teal)',
                    textDecoration: 'none'
                  }}
                >
                  {oportunidad.cliente.nombre}
                </Link>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', marginBottom: '4px' }}>
                  NIF
                </div>
                <div style={{ fontSize: '15px', color: 'var(--ink)' }}>
                  {oportunidad.cliente.nif}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', marginBottom: '4px' }}>
                  Actividad
                </div>
                <div style={{ fontSize: '15px', color: 'var(--ink)' }}>
                  {oportunidad.cliente.actividad || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', marginBottom: '4px' }}>
                  Tamaño
                </div>
                <div style={{ fontSize: '15px', color: 'var(--ink)' }}>
                  {oportunidad.cliente.tamano_empresa || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Información de la Ayuda */}
          <div style={{
            background: 'var(--surface)',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--s1)'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--ink)',
              marginBottom: '20px'
            }}>
              Ayuda
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', marginBottom: '4px' }}>
                  Organismo
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)' }}>
                  {oportunidad.organismo || oportunidad.ayudas?.organismo || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', marginBottom: '4px' }}>
                  Tipo
                </div>
                <div style={{ fontSize: '15px', color: 'var(--ink)' }}>
                  {oportunidad.ayudas?.tipo || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', marginBottom: '4px' }}>
                  Ámbito
                </div>
                <div style={{ fontSize: '15px', color: 'var(--ink)' }}>
                  {oportunidad.ayudas?.ambito || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', marginBottom: '4px' }}>
                  Importe Estimado
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--teal)' }}>
                  {formatCurrency(oportunidad.importe_estimado)}
                </div>
              </div>
            </div>
          </div>

          {/* Resumen de la Ayuda */}
          {oportunidad.resumen_ayuda && (
            <div style={{
              background: 'var(--surface)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--s1)'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--ink)',
                marginBottom: '12px'
              }}>
                Resumen de la Ayuda
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--ink2)', lineHeight: '1.6' }}>
                {oportunidad.resumen_ayuda}
              </p>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Análisis de Encaje */}
          {oportunidad.analisis_encaje && (
            <div style={{
              background: 'var(--surface)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--s1)'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--ink)',
                marginBottom: '12px'
              }}>
                Análisis de Encaje
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--ink2)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {oportunidad.analisis_encaje}
              </p>
            </div>
          )}

          {/* Requisitos */}
          {oportunidad.requisitos && (
            <div style={{
              background: 'var(--surface)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--s1)'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--ink)',
                marginBottom: '12px'
              }}>
                Requisitos
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--ink2)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {oportunidad.requisitos}
              </p>
            </div>
          )}

          {/* Notebook */}
          {oportunidad.notebook && (
            <div style={{
              background: 'var(--surface)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--s1)'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--ink)',
                marginBottom: '12px'
              }}>
                Notebook de Análisis
              </h2>
              <pre style={{
                fontSize: '14px',
                color: 'var(--ink2)',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                background: 'var(--bg)',
                padding: '16px',
                borderRadius: '8px',
                overflow: 'auto'
              }}>
                {JSON.stringify(oportunidad.notebook, null, 2)}
              </pre>
            </div>
          )}

          {/* Reuniones Explorativas */}
          <div style={{
            background: 'var(--surface)',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--s1)'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--ink)',
              marginBottom: '16px'
            }}>
              Reuniones Explorativas
            </h2>
            {reuniones && reuniones.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reuniones.map((reunion: any) => (
                  <div
                    key={reunion.id}
                    style={{
                      padding: '16px',
                      background: 'var(--bg)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'var(--ink)',
                      marginBottom: '8px'
                    }}>
                      {formatDate(reunion.fecha)}
                    </div>
                    {reunion.objetivo && (
                      <div style={{ fontSize: '14px', color: 'var(--ink2)', marginBottom: '6px' }}>
                        <strong>Objetivo:</strong> {reunion.objetivo}
                      </div>
                    )}
                    {reunion.notas && (
                      <div style={{ fontSize: '14px', color: 'var(--ink2)' }}>
                        {reunion.notas}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
                No hay reuniones explorativas registradas
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
