import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Permitir rutas API con Bearer token (cron jobs, scripts) sin sesión
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const hasBearerToken = request.headers.get("authorization")?.startsWith("Bearer ");
  if (isApiRoute && hasBearerToken) {
    return supabaseResponse;
  }

  // Rutas públicas: landing page y páginas legales
  const PUBLIC_PATHS = ["/contacto", "/privacidad", "/terminos"];
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);
  if (isPublicPath) {
    return supabaseResponse;
  }

  // Si el usuario ya está logueado y entra a /, redirigir a su área
  if (user && request.nextUrl.pathname === "/") {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();
    const destino = perfil?.rol === 'admin' ? '/clientes' : '/portal';
    return NextResponse.redirect(new URL(destino, request.url));
  }

  // Si no está logueado, / es pública (muestra landing con modal login)
  if (!user && request.nextUrl.pathname === "/") {
    return supabaseResponse;
  }

  // /portal solo accesible con sesión activa (cliente o admin)
  if (!user && request.nextUrl.pathname.startsWith("/portal")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && request.nextUrl.pathname === "/login") {
    // Redirigir según rol
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();
    const destino = perfil?.rol === 'admin' ? '/clientes' : '/portal';
    return NextResponse.redirect(new URL(destino, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};