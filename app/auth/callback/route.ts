/**
 * GET /auth/callback
 * Supabase redirige aquí tras la confirmación de email o magic link.
 * Intercambia el code por una sesión y redirige al portal.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/portal';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Si algo falla, redirigir a login con error
  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`);
}
