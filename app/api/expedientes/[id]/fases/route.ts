/**
 * GET /api/expedientes/[id]/fases — historial de fases de un expediente
 * Accesible por admin, tramitador y el cliente dueño del expediente
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth: verificar que el usuario tiene acceso
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const sb = createServiceClient();

  // Verificar permisos: admin/tramitador ven todo, clientes solo sus expedientes
  const { data: perfil } = await sb.from('perfiles')
    .select('rol, nif')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });

  if (perfil.rol === 'cliente') {
    // Verificar que el expediente pertenece al cliente
    const { data: exp } = await sb.from('expediente')
      .select('nif')
      .eq('id', id)
      .maybeSingle();
    if (!exp || exp.nif !== perfil.nif) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  } else if (!['admin', 'tramitador', 'gestor'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { data, error } = await sb
    .from('expediente_fases')
    .select('id, fase, orden, fecha_inicio, fecha_completada')
    .eq('expediente_id', id)
    .order('orden', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
