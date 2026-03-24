import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).maybeSingle();
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const sb = createServiceClient();

  const [
    { count: subvenciones },
    { count: clientes },
    { count: matches },
    { count: solicitudes },
    { count: expedientes },
  ] = await Promise.all([
    sb.from('subvenciones').select('*', { count: 'exact', head: true }),
    sb.from('cliente').select('*', { count: 'exact', head: true }),
    sb.from('matches').select('*', { count: 'exact', head: true }),
    sb.from('solicitudes').select('*', { count: 'exact', head: true }),
    sb.from('expediente').select('*', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    subvenciones: subvenciones ?? 0,
    clientes: clientes ?? 0,
    matches: matches ?? 0,
    solicitudes: solicitudes ?? 0,
    expedientes: expedientes ?? 0,
  });
}
