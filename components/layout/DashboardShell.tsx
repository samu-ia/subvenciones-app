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
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        height: 60,
        display: "flex", alignItems: "center",
        padding: "0 32px",
        justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
        boxShadow: "var(--s1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 32, height: 32, background: "var(--navy)",
            borderRadius: 8, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.78rem",
          }}>AP</div>
          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--navy)" }}>
            AyudaPyme
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {rol === 'tramitador' && (
            <span style={{
              fontSize: "0.7rem", fontWeight: 600, color: "#7c3aed",
              background: "#f5f3ff", padding: "2px 8px", borderRadius: 20,
            }}>
              Tramitador
            </span>
          )}
          <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            {userEmail}
          </div>
        </div>
      </nav>

      {/* BODY */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <Sidebar rol={rol} />
        <main style={{ flex: 1, padding: "32px 36px 60px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
