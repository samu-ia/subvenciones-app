import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subvencion_plantillas')
    .select(`
      *,
      subvencion:subvenciones(id, titulo, organismo),
      plantilla_proveedores(
        id, rol, obligatorio, orden, notas,
        proveedor:proveedores(id, nombre, categoria, servicios, contacto_email, precio_referencia, descripcion)
      )
    `)
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()
  const { proveedores: proveedoresInput, ...plantillaData } = body

  const { data, error } = await supabase
    .from('subvencion_plantillas')
    .update(plantillaData)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reemplazar proveedores si se envían
  if (proveedoresInput !== undefined) {
    await supabase.from('plantilla_proveedores').delete().eq('plantilla_id', id)
    if (proveedoresInput.length) {
      const rows = proveedoresInput.map((p: { proveedor_id: string; rol?: string }, i: number) => ({
        plantilla_id: id,
        proveedor_id: p.proveedor_id,
        rol: p.rol,
        obligatorio: p.obligatorio ?? false,
        orden: i,
        notas: p.notas,
      }))
      await supabase.from('plantilla_proveedores').insert(rows)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('subvencion_plantillas').update({ activa: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
