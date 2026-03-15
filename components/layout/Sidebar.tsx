"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, Building2, Lightbulb, FileText,
  FolderOpen, LogOut, Target, Settings, Calendar, Brain,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/reuniones", label: "Reuniones", icon: Calendar },
  { href: "/oportunidades", label: "Oportunidades", icon: Target },
  { href: "/expedientes", label: "Expedientes", icon: FolderOpen },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/asistentes", label: "Asistentes IA", icon: Brain },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      padding: "20px 0",
      position: "sticky", top: 60,
      height: "calc(100vh - 60px)",
      display: "flex", flexDirection: "column",
      justifyContent: "space-between",
    }}>
      <div>
        <div style={{ padding: "0 14px", marginBottom: 4 }}>
          <div style={{
            fontSize: "0.6rem", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.1em",
            color: "var(--muted)", padding: "0 8px", marginBottom: 6,
          }}>Menú</div>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 10px", borderRadius: 8,
                  fontSize: "0.82rem", fontWeight: active ? 600 : 500,
                  color: active ? "var(--blue)" : "var(--ink2)",
                  background: active ? "var(--blue-bg)" : "transparent",
                  marginBottom: 1, cursor: "pointer",
                  transition: "all 0.15s",
                }}>
                  <Icon size={16} />
                  {label}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0 14px 10px" }}>
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "8px 10px", borderRadius: 8, width: "100%",
            fontSize: "0.82rem", fontWeight: 500,
            color: "var(--muted)", background: "transparent",
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}