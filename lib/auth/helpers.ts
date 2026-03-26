/**
 * Auth Helpers
 *
 * Funciones helper para obtener información del usuario autenticado
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { createServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';

/**
 * Obtiene el userId del usuario autenticado (Server Component)
 */
export async function getUserIdServer(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Obtiene el userId del usuario autenticado (Client Component)
 */
export async function getUserIdClient(): Promise<string | null> {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Obtiene la sesión completa del usuario (Client Component)
 * Nota: getSession() es seguro client-side pero NO server-side.
 */
export async function getSessionClient() {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// VULN-07: getSessionServer() ELIMINADO — usar getUser() server-side
// getSession() no es seguro en server porque no verifica el JWT con Supabase.

/**
 * VULN-09: Helper para verificar rol del usuario desde la tabla perfiles.
 * Devuelve el usuario y su rol, o un NextResponse 401/403 si no tiene acceso.
 *
 * Uso en API routes:
 *   const result = await requireRole('admin');
 *   if (result instanceof NextResponse) return result;
 *   const { user, perfil } = result;
 */
export async function requireRole(rol: 'admin' | 'cliente') {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const sb = createServiceClient();
  const { data: perfil } = await sb
    .from('perfiles')
    .select('id, rol, nif')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil || perfil.rol !== rol) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return { user, perfil };
}
