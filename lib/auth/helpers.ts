/**
 * Auth Helpers
 * 
 * Funciones helper para obtener información del usuario autenticado
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';

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
 */
export async function getSessionClient() {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Obtiene la sesión completa del usuario (Server Component)
 */
export async function getSessionServer() {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
