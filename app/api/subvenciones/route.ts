import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/subvenciones?reunionId=xxx
 * Obtiene subvenciones detectadas con checklist y documentos
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reunionId = searchParams.get('reunionId');
  const expedienteId = searchParams.get('expedienteId');

  if (!reunionId && !expedienteId) {
    return NextResponse.json({ error: 'Falta reunionId o expedienteId' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let query = supabase
    .from('subvenciones_detectadas')
    .select(`
      *,
      checklist:subvenciones_checklist(*),
      documentos:subvenciones_documentos(*)
    `)
    .order('puntuacion', { ascending: false });

  if (reunionId)    query = query.eq('reunion_id', reunionId);
  if (expedienteId) query = query.eq('expediente_id', expedienteId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subvenciones: data || [] });
}

/**
 * PATCH /api/subvenciones
 * Actualiza estado de una subvención o checklist item
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { type, id, updates } = body as {
    type: 'subvencion' | 'checklist';
    id: string;
    updates: Record<string, unknown>;
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  if (type === 'checklist') {
    const { data, error } = await supabase
      .from('subvenciones_checklist')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  // type === 'subvencion'
  const { data, error } = await supabase
    .from('subvenciones_detectadas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subvencion: data });
}

/**
 * DELETE /api/subvenciones?id=xxx
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { error } = await supabase.from('subvenciones_detectadas').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
