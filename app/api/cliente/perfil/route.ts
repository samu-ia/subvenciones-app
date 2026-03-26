/**
 * PATCH /api/cliente/perfil
 *
 * Permite al cliente autenticado actualizar los datos de su empresa.
 * Después de guardar, dispara un recálculo de matching solo para ese NIF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const CAMPOS_PERMITIDOS = [
  'nombre_empresa', 'cnae_codigo', 'cnae_descripcion',
  'comunidad_autonoma', 'provincia', 'ciudad',
  'num_empleados', 'facturacion_anual', 'forma_juridica',
  'anos_antiguedad', 'descripcion_actividad', 'tamano_empresa',
] as const;

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nif')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.nif) return NextResponse.json({ error: 'No tienes empresa asociada' }, { status: 400 });

  const body = await request.json().catch(() => ({}));

  // Filtrar solo campos permitidos
  const update: Record<string, unknown> = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) update[campo] = body[campo];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Upsert en tabla cliente
  const { error } = await sb
    .from('cliente')
    .update(update)
    .eq('nif', perfil.nif);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Disparar recálculo de matching para este cliente (background, no bloqueamos la respuesta)
  // Lo hacemos con fetch interno para no bloquear
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${request.headers.get('host')}`;
  fetch(`${baseUrl}/api/matching/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.INGEST_SECRET ?? ''}`,
    },
    body: JSON.stringify({ nif: perfil.nif }),
  }).catch(() => {/* best effort */});

  return NextResponse.json({ ok: true, nif: perfil.nif });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nif')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.nif) return NextResponse.json({ nif: null, cliente: null });

  const { data: cliente } = await supabase
    .from('cliente')
    .select('nif,nombre_empresa,cnae_codigo,cnae_descripcion,comunidad_autonoma,provincia,ciudad,num_empleados,facturacion_anual,forma_juridica,anos_antiguedad,descripcion_actividad,tamano_empresa')
    .eq('nif', perfil.nif)
    .maybeSingle();

  return NextResponse.json({ nif: perfil.nif, cliente });
}
