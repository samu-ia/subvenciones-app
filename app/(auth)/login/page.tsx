"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }

    // Consultar rol del usuario
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', authData.user.id)
      .maybeSingle();

    const rol = perfil?.rol ?? 'cliente';
    router.push(rol === 'admin' ? '/clientes' : '/portal');
    router.refresh();
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 400,
        boxShadow: "var(--s2)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36,
            background: "var(--navy)",
            borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: "0.85rem",
          }}>AP</div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--navy)" }}>
            AyudaPyme
          </span>
        </div>

        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>
          Bienvenido a AyudaPyme
        </h1>
        <p style={{ fontSize: "0.83rem", color: "var(--muted)", marginBottom: 24 }}>
          Introduce tus credenciales para acceder
        </p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink2)", display: "block", marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              style={{
                width: "100%", padding: "10px 13px",
                border: "1px solid var(--border)", borderRadius: 8,
                fontSize: "0.87rem", color: "var(--ink)",
                outline: "none", fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink2)", display: "block", marginBottom: 5 }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: "100%", padding: "10px 13px",
                border: "1px solid var(--border)", borderRadius: 8,
                fontSize: "0.87rem", color: "var(--ink)",
                outline: "none", fontFamily: "inherit",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "var(--red-bg)", border: "1px solid #fecaca",
              borderRadius: 8, padding: "9px 13px",
              fontSize: "0.8rem", color: "var(--red)", fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--navy)", color: "#fff",
              border: "none", borderRadius: 8,
              padding: "11px", fontFamily: "inherit",
              fontWeight: 700, fontSize: "0.87rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}