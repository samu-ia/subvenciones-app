import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!user.email?.endsWith('@ayudapyme.es')) {
    return NextResponse.json({ error: 'Solo admins' }, { status: 403 });
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('cliente')
    .select('nif, nombre_empresa, nombre_normalizado, actividad, tamano_empresa, ciudad, comunidad_autonoma, cnae_codigo, num_empleados, facturacion_anual, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
