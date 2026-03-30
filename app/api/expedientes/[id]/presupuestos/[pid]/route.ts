import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const { pid } = await params
  const supabase = await createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('presupuestos')
    .update(body)
    .eq('id', pid)
    .select('*, proveedor:proveedores(id, nombre, categoria)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const { pid } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('presupuestos').delete().eq('id', pid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
