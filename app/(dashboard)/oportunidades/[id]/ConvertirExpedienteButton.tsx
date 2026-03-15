'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConvertirExpedienteButton({ oportunidadId, oportunidad }: any) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleConvertir = async () => {
    if (!confirm('¿Confirmar conversión de oportunidad a expediente?')) return

    setLoading(true)
    try {
      // 1. Crear expediente heredando datos de la oportunidad
      const { data: expediente, error: expedienteError } = await supabase
        .from('expediente')
        .insert({
          cliente_nif: oportunidad.cliente_nif,
          ayuda_id: oportunidad.ayuda_id,
          oportunidad_origen_id: oportunidadId,
          estado: 'preparacion',
          fecha_inicio: new Date().toISOString().split('T')[0],
          importe_solicitado: oportunidad.importe_estimado,
          observaciones: oportunidad.analisis_encaje || '',
          seguimiento_estado: 'preparacion'
        })
        .select()
        .single()

      if (expedienteError) throw expedienteError

      // 2. Actualizar oportunidad marcándola como convertida
      const { error: updateError } = await supabase
        .from('oportunidades')
        .update({
          estado: 'convertida_expediente',
          convertida_a_expediente_id: expediente.id
        })
        .eq('id', oportunidadId)

      if (updateError) throw updateError

      alert('¡Expediente creado exitosamente!')
      router.push(`/expedientes/${expediente.id}`)
    } catch (error) {
      console.error('Error convirtiendo oportunidad:', error)
      alert('Error al crear expediente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleConvertir}
      disabled={loading || oportunidad.estado === 'convertida_expediente'}
      style={{
        padding: '14px 28px',
        background: oportunidad.estado === 'convertida_expediente' ? 'var(--muted)' : 'var(--green)',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: oportunidad.estado === 'convertida_expediente' ? 'not-allowed' : 'pointer',
        boxShadow: 'var(--s1)',
        opacity: loading ? 0.6 : 1
      }}
    >
      {loading ? 'Convirtiendo...' : oportunidad.estado === 'convertida_expediente' ? 'Ya Convertida' : '✓ Convertir en Expediente'}
    </button>
  )
}
