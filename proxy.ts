import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // APIs: siempre pasar
  if (pathname.startsWith('/api/')) return supabaseResponse;

  // Rutas públicas: siempre pasar
  const PUBLIC = ['/', '/login', '/contacto', '/privacidad', '/terminos'];
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return supabaseResponse;
  }

  // Rutas privadas sin sesión: volver a landing
  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Dashboard admin: solo @ayudapyme.es
  const DASHBOARD_PATHS = [
    '/clientes', '/reuniones', '/expedientes', '/solicitudes',
    '/subvenciones', '/subvenciones-bd', '/proveedores', '/ajustes',
  ];
  const esDashboard = DASHBOARD_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (esDashboard && !user.email?.endsWith('@ayudapyme.es')) {
    // Redirigir al portal del cliente
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)"],
};
