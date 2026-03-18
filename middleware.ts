import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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

  // ── 1. APIs con Bearer token: siempre pasar ─────────────────────────────
  if (pathname.startsWith("/api/") && request.headers.get("authorization")?.startsWith("Bearer ")) {
    return supabaseResponse;
  }

  // ── 2. Rutas completamente públicas ─────────────────────────────────────
  const PUBLIC = ["/", "/login", "/contacto", "/privacidad", "/terminos"];
  if (PUBLIC.includes(pathname)) {
    return supabaseResponse;
  }

  // ── 3. Rutas protegidas: requieren sesión ────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)"],
};
