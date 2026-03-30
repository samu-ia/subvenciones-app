import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const subvencionId = searchParams.get('subvencion_id')
  const organismo = searchParams.get('organismo')

  let query = supabase
    .from('subvencion_plantillas')
    .select(`
      *,
      subvencion:subvenciones(id, titulo, organismo),
      plantilla_proveedores(
        id, rol, obligatorio, orden, notas,
        proveedor:proveedores(id, nombre, categoria, servicios, contacto_email, precio_referencia)
      )
    `)
    .eq('activa', true)
    .order('created_at', { ascending: false })

  if (subvencionId) query = query.eq('subvencion_id', subvencionId)
  if (organismo) query = query.ilike('organismo', `%${organismo}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { proveedores: proveedoresInput, ...plantillaData } = body

  // Insertar plantilla
  const { data: plantilla, error } = await supabase
    .from('subvencion_plantillas')
    .insert(plantillaData)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insertar relaciones proveedor-plantilla
  if (proveedoresInput?.length) {
    const rows = proveedoresInput.map((p: any, i: number) => ({
      plantilla_id: plantilla.id,
      proveedor_id: p.proveedor_id,
      rol: p.rol,
      obligatorio: p.obligatorio ?? false,
      orden: i,
      notas: p.notas,
    }))
    await supabase.from('plantilla_proveedores').insert(rows)
  }

  return NextResponse.json(plantilla, { status: 201 })
}
