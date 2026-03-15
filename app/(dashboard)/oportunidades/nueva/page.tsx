'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NuevaOportunidadPage() {
  const router = useRouter()
  const supabase = createClient()

  const [clientes, setClientes] = useState<any[]>([])
  const [ayudas, setAyudas] = useState<any[]>([])

  const [formData, setFormData] = useState({
    cliente_nif: '',
    ayuda_id: '',
    nombre_ayuda: '',
    organismo: '',
    importe_estimado: '',
    probabilidad_estimada: '',
    estado: 'detectada',
    resumen_ayuda: '',
    requisitos: '',
    analisis_encaje: ''
  })

  useEffect(() => {
    cargarClientes()
    cargarAyudas()
  }, [])

  const cargarClientes = async () => {
    const { data } = await supabase
      .from('cliente')
      .select('nif, nombre')
      .order('nombre')
    if (data) setClientes(data)
  }

  const cargarAyudas = async () => {
    const { data } = await supabase
      .from('ayudas')
      .select('id, nombre, organismo')
      .order('nombre')
    if (data) setAyudas(data)
  }

  const handleAyudaChange = (ayudaId: string) => {
    const ayuda = ayudas.find(a => a.id === ayudaId)
    if (ayuda) {
      setFormData(prev => ({
        ...prev,
        ayuda_id: ayudaId,
        nombre_ayuda: ayuda.nombre,
        organismo: ayuda.organismo || ''
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.from('oportunidades').insert({
      cliente_nif: formData.cliente_nif,
      ayuda_id: formData.ayuda_id || null,
      nombre_ayuda: formData.nombre_ayuda,
      organismo: formData.organismo || null,
      importe_estimado: formData.importe_estimado ? parseFloat(formData.importe_estimado) : null,
      probabilidad_estimada: formData.probabilidad_estimada ? parseInt(formData.probabilidad_estimada) : null,
      estado: formData.estado,
      resumen_ayuda: formData.resumen_ayuda || null,
      requisitos: formData.requisitos || null,
      analisis_encaje: formData.analisis_encaje || null
    })

    if (error) {
      console.error('Error creando oportunidad:', error)
      alert('Error al crear oportunidad')
      return
    }

    alert('Oportunidad creada exitosamente')
    router.push('/oportunidades')
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        color: 'var(--ink)',
        marginBottom: '8px'
      }}>
        Nueva Oportunidad
      </h1>
      <p style={{ color: 'var(--ink2)', fontSize: '15px', marginBottom: '32px' }}>
        Registrar una nueva oportunidad de subvención para un cliente
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{
          background: 'var(--surface)',
          padding: '32px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--s1)',
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
              onChange={(e) => setFormData(prev => ({ ...prev, cliente_nif: e.target.value }))}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                color: 'var(--ink)',
                background: 'var(--surface)'
              }}
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map(cliente => (
                <option key={cliente.nif} value={cliente.nif}>
                  {cliente.nombre} ({cliente.nif})
                </option>
              ))}
            </select>
          </div>

          {/* Ayuda */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Ayuda (opcional)
            </label>
            <select
              value={formData.ayuda_id}
              onChange={(e) => handleAyudaChange(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                color: 'var(--ink)',
                background: 'var(--surface)'
              }}
            >
              <option value="">Ninguna (crear nueva)</option>
              {ayudas.map(ayuda => (
                <option key={ayuda.id} value={ayuda.id}>
                  {ayuda.nombre}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
              Si la ayuda no existe, déjalo vacío y completa los campos siguientes
            </p>
          </div>

          {/* Nombre Ayuda */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Nombre de la Ayuda *
            </label>
            <input
              type="text"
              required
              value={formData.nombre_ayuda}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre_ayuda: e.target.value }))}
              placeholder="Ej: Kit Digital, Bonos TIC..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                color: 'var(--ink)'
              }}
            />
          </div>

          {/* Organismo */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Organismo
            </label>
            <input
              type="text"
              value={formData.organismo}
              onChange={(e) => setFormData(prev => ({ ...prev, organismo: e.target.value }))}
              placeholder="Ej: Ministerio, Comunidad Autónoma..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                color: 'var(--ink)'
              }}
            />
          </div>

          {/* Importe y Probabilidad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--ink)',
                marginBottom: '8px'
              }}>
                Importe Estimado (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.importe_estimado}
                onChange={(e) => setFormData(prev => ({ ...prev, importe_estimado: e.target.value }))}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '15px',
                  color: 'var(--ink)'
                }}
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
                Probabilidad (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.probabilidad_estimada}
                onChange={(e) => setFormData(prev => ({ ...prev, probabilidad_estimada: e.target.value }))}
                placeholder="0-100"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '15px',
                  color: 'var(--ink)'
                }}
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
              Estado *
            </label>
            <select
              required
              value={formData.estado}
              onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                color: 'var(--ink)',
                background: 'var(--surface)'
              }}
            >
              <option value="detectada">Detectada</option>
              <option value="en_analisis">En Análisis</option>
              <option value="pendiente_reunion">Pendiente de Reunión</option>
              <option value="presentada_cliente">Presentada al Cliente</option>
              <option value="interesada">Interesada</option>
              <option value="descartada">Descartada</option>
            </select>
          </div>

          {/* Resumen */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Resumen de la Ayuda
            </label>
            <textarea
              value={formData.resumen_ayuda}
              onChange={(e) => setFormData(prev => ({ ...prev, resumen_ayuda: e.target.value }))}
              rows={4}
              placeholder="Descripción breve de la ayuda..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                color: 'var(--ink)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
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
              value={formData.requisitos}
              onChange={(e) => setFormData(prev => ({ ...prev, requisitos: e.target.value }))}
              rows={4}
              placeholder="Requisitos principales de la ayuda..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                color: 'var(--ink)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Análisis de Encaje */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--ink)',
              marginBottom: '8px'
            }}>
              Análisis de Encaje
            </label>
            <textarea
              value={formData.analisis_encaje}
              onChange={(e) => setFormData(prev => ({ ...prev, analisis_encaje: e.target.value }))}
              rows={6}
              placeholder="¿Por qué esta ayuda es adecuada para este cliente?"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                color: 'var(--ink)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                color: 'var(--ink2)',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: '12px 32px',
                background: 'var(--teal)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: 'var(--s1)'
              }}
            >
              Crear Oportunidad
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
