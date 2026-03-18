/**
 * GET /api/subvenciones/catalogo/[id]
 *
 * Detalle de una subvención normalizada con todas sus tablas auxiliares.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Tabla principal
    const { data: subv, error } = await supabase
      .from('subvenciones')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !subv) {
      return NextResponse.json({ error: 'Subvención no encontrada' }, { status: 404 });
    }

    // Tablas auxiliares en paralelo
    const [requisitos, gastos, documentacion, sectores, tiposEmpresa, actualizaciones] =
      await Promise.all([
        supabase.from('subvencion_requisitos').select('*').eq('subvencion_id', id).order('orden'),
        supabase.from('subvencion_gastos').select('*').eq('subvencion_id', id).order('orden'),
        supabase.from('subvencion_documentacion').select('*').eq('subvencion_id', id).order('orden'),
        supabase.from('subvencion_sectores').select('*').eq('subvencion_id', id),
        supabase.from('subvencion_tipos_empresa').select('*').eq('subvencion_id', id),
        supabase.from('subvencion_actualizaciones').select('*').eq('subvencion_id', id).order('detectada_at', { ascending: false }).limit(10),
      ]);

    return NextResponse.json({
      ...subv,
      requisitos: requisitos.data ?? [],
      gastos: gastos.data ?? [],
      documentacion: documentacion.data ?? [],
      sectores: sectores.data ?? [],
      tipos_empresa: tiposEmpresa.data ?? [],
      actualizaciones: actualizaciones.data ?? [],
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
