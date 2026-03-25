"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Building2, Calendar, FolderOpen, LogOut, Database, Settings,
  ClipboardList, Store, Bell, MessageCircle, LayoutDashboard, AlertTriangle,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: boolean };

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alertas", label: "Alertas", icon: AlertTriangle, badge: true },
  { href: "/novedades", label: "Novedades", icon: Bell },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/reuniones", label: "Reuniones", icon: Calendar },
  { href: "/expedientes", label: "Expedientes", icon: FolderOpen },
  { href: "/solicitudes", label: "Solicitudes", icon: ClipboardList },
  { href: "/proveedores", label: "Proveedores", icon: Store },
  { href: "/subvenciones-bd", label: "Pipeline BDNS", icon: Database },
];

const navBottom = [
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [alertasCount, setAlertasCount] = useState(0);

  useEffect(() => {
    fetch('/api/alertas')
      .then(r => r.json())
      .then(d => setAlertasCount(d.total || 0))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
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
          {nav.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const showBadge = badge && alertasCount > 0;
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
                  justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Icon size={16} />
                    {label}
                  </div>
                  {showBadge && (
                    <span style={{
                      background: alertasCount >= 5 ? "#ef4444" : "#f97316",
                      color: "#fff", fontSize: "0.65rem", fontWeight: 700,
                      padding: "1px 6px", borderRadius: "100px", minWidth: "18px",
                      textAlign: "center",
                    }}>
                      {alertasCount > 99 ? "99+" : alertasCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0 14px 10px" }}>
        {navBottom.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "8px 10px", borderRadius: 8,
                fontSize: "0.82rem", fontWeight: active ? 600 : 500,
                color: active ? "var(--blue)" : "var(--ink2)",
                background: active ? "var(--blue-bg)" : "transparent",
                marginBottom: 4, cursor: "pointer",
                transition: "all 0.15s",
              }}>
                <Icon size={16} />
                {label}
              </div>
            </Link>
          );
        })}
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