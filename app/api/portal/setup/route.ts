/**
 * POST /api/portal/setup
 * Primera vez que el cliente entra al portal sin empresa vinculada.
 * Crea el registro cliente y vincula el NIF al perfil del usuario.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const nif = body?.nif?.toUpperCase().trim();
  if (!nif) return NextResponse.json({ error: 'NIF requerido' }, { status: 400 });

  const sb = createServiceClient();

  // Crear cliente si no existe
  const { data: clienteExistente } = await sb
    .from('cliente').select('nif').eq('nif', nif).maybeSingle();

  if (!clienteExistente) {
    await sb.from('cliente').insert({
      nif,
      nombre_empresa: body.nombre_empresa?.trim() || null,
      nombre_normalizado: body.nombre_empresa?.trim() || null,
      email_normalizado: user.email ?? null,
      telefono: body.telefono?.trim() || null,
      actividad: body.actividad?.trim() || null,
      tamano_empresa: body.tamano_empresa || null,
      cnae_descripcion: body.actividad?.trim() || null,
    });
  }

  // Vincular NIF al perfil del usuario
  await sb.from('perfiles').upsert({
    id: user.id,
    nif,
    rol: 'cliente',
  }, { onConflict: 'id' });

  return NextResponse.json({ ok: true, nif });
}
