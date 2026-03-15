import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function OportunidadesPage() {
  const supabase = await createClient()
  const { data: oportunidades, error } = await supabase
    .from('oportunidades')
    .select(`
      *,
      cliente:cliente_nif (
        nombre,
        nif,
        actividad
      ),
      ayudas (
        nombre,
        organismo
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error cargando oportunidades:', error)
    return <div style={{ padding: '24px' }}>Error cargando oportunidades</div>
  }

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

  return (
    <div style={{ padding: '32px 40px' }}>
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
            Oportunidades
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
            Fase de análisis y validación de posibles subvenciones
          </p>
        </div>
        <Link
          href="/oportunidades/nueva"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'var(--teal)',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '15px',
            textDecoration: 'none',
            boxShadow: 'var(--s1)'
          }}
        >
          <span style={{ fontSize: '20px' }}>+</span>
          Nueva Oportunidad
        </Link>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {[
          {
            label: 'Total Oportunidades',
            value: oportunidades?.length || 0,
            color: 'var(--blue)'
          },
          {
            label: 'En Análisis',
            value: oportunidades?.filter(o => o.estado === 'en_analisis').length || 0,
            color: 'var(--amber)'
          },
          {
            label: 'Interesadas',
            value: oportunidades?.filter(o => o.estado === 'interesada').length || 0,
            color: 'var(--green)'
          },
          {
            label: 'Convertidas',
            value: oportunidades?.filter(o => o.estado === 'convertida_expediente').length || 0,
            color: 'var(--teal)'
          }
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--s1)'
            }}
          >
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: stat.color,
              marginBottom: '4px'
            }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--ink2)' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: 'var(--s1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 1fr',
          gap: '16px',
          padding: '16px 24px',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)'
        }}>
          {['Cliente', 'Ayuda', 'Organismo', 'Importe', 'Probabilidad', 'Estado'].map((header) => (
            <div
              key={header}
              style={{
                fontSize: '13px',
                fontWeight: '700',
                color: 'var(--ink2)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {header}
            </div>
          ))}
        </div>

        {/* Rows */}
        {oportunidades && oportunidades.length > 0 ? (
          oportunidades.map((oportunidad: any) => (
            <Link
              key={oportunidad.id}
              href={`/oportunidades/${oportunidad.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                className="table-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                {/* Cliente */}
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--ink)', marginBottom: '4px' }}>
                    {oportunidad.cliente?.nombre || 'Sin cliente'}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--ink2)' }}>
                    {oportunidad.cliente?.nif || '-'}
                  </div>
                </div>

                {/* Ayuda */}
                <div>
                  <div style={{ fontWeight: '500', color: 'var(--ink)' }}>
                    {oportunidad.nombre_ayuda}
                  </div>
                </div>

                {/* Organismo */}
                <div style={{ color: 'var(--ink2)' }}>
                  {oportunidad.organismo || '-'}
                </div>

                {/* Importe */}
                <div style={{ fontWeight: '600', color: 'var(--teal)' }}>
                  {formatCurrency(oportunidad.importe_estimado)}
                </div>

                {/* Probabilidad */}
                <div>
                  {oportunidad.probabilidad_estimada ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
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
                      {oportunidad.probabilidad_estimada}%
                    </div>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>-</span>
                  )}
                </div>

                {/* Estado */}
                <div>
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
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div style={{
            padding: '60px 24px',
            textAlign: 'center',
            color: 'var(--muted)'
          }}>
            No hay oportunidades registradas
          </div>
        )}
      </div>
    </div>
  )
}
