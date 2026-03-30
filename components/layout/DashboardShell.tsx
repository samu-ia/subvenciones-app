"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

// Rutas que son "workspace" — sin sidebar ni padding (usan su propio layout)
const WORKSPACE_PATTERNS = [
  /^\/reuniones\/[^/]+/,
  /^\/expedientes\/[^/]+/,
];

function isWorkspacePath(pathname: string) {
  return WORKSPACE_PATTERNS.some(p => p.test(pathname));
}

export default function DashboardShell({
  userEmail,
  rol,
  children,
}: {
  userEmail: string;
  rol?: 'admin' | 'tramitador' | 'cliente';
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const workspace = isWorkspacePath(pathname);

  if (workspace) {
    // En workspace: sin nav top, sin sidebar, sin padding — la página ocupa toda la pantalla
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* NAV TOP */}
      <nav style={{
        background: "#0d1f3c",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        height: 60,
        display: "flex", alignItems: "center",
        padding: "0 20px 0 0",
        justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        {/* Logo area — same width as sidebar */}
        <div style={{
          width: 232, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 9,
          padding: "0 20px",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          height: "100%",
        }}>
          <div style={{
            width: 30, height: 30, background: "#0d9488",
            borderRadius: 7, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.78rem",
            letterSpacing: "-0.02em",
          }}>AP</div>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff", letterSpacing: "-0.01em" }}>
            AyudaPyme
          </span>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 8 }}>
          {rol === 'tramitador' && (
            <span style={{
              fontSize: "0.68rem", fontWeight: 600, color: "#a78bfa",
              background: "rgba(139,92,246,0.15)", padding: "2px 9px", borderRadius: 20,
              border: "1px solid rgba(139,92,246,0.25)",
            }}>
              Tramitador
            </span>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.06)", borderRadius: 8,
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "#0d9488", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontSize: "0.65rem", fontWeight: 700,
            }}>
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
              {userEmail}
            </div>
          </div>
        </div>
      </nav>

      {/* BODY */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <Sidebar rol={rol} />
        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
