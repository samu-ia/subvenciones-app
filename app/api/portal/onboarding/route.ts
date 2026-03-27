/**
 * POST /api/portal/onboarding
 * Guarda las respuestas del wizard de onboarding en perfiles.onboarding_data
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });

  const sb = createServiceClient();

  // Guardar onboarding_data en perfiles
  const { error } = await sb
    .from('perfiles')
    .update({
      onboarding_data: body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('[onboarding] Error guardando datos:', error.message);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }

  // Si hay correcciones de empresa en paso 1, actualizar tabla cliente
  const perfil = await sb.from('perfiles').select('nif').eq('id', user.id).maybeSingle();
  if (perfil.data?.nif && body.empresa) {
    const updates: Record<string, unknown> = {};
    if (body.empresa.nombre_empresa) updates.nombre_empresa = body.empresa.nombre_empresa;
    if (body.empresa.sector) updates.cnae_descripcion = body.empresa.sector;
    if (body.empresa.num_empleados !== undefined) updates.num_empleados = body.empresa.num_empleados;
    if (body.empresa.descripcion_actividad) updates.descripcion_actividad = body.empresa.descripcion_actividad;

    if (Object.keys(updates).length) {
      await sb.from('cliente').update(updates).eq('nif', perfil.data.nif);
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/portal/onboarding
 * Devuelve si el usuario necesita completar el onboarding
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nif, onboarding_data')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    needsOnboarding: perfil?.nif && !perfil?.onboarding_data,
    hasNif: !!perfil?.nif,
  });
}
