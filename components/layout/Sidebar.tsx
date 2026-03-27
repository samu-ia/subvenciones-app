"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Building2, Calendar, FolderOpen, LogOut, Database, Settings,
  ClipboardList, Store, Bell, MessageCircle, LayoutDashboard, AlertTriangle, Sparkles, Inbox, Target,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: boolean; bandejaBadge?: boolean };

const nav: NavItem[] = [
  { href: "/bandeja", label: "Bandeja", icon: Inbox, bandejaBadge: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alertas", label: "Alertas", icon: AlertTriangle, badge: true },
  { href: "/novedades", label: "Novedades", icon: Bell },
  { href: "/matches", label: "Matches", icon: Sparkles },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/prospectos", label: "Prospectos", icon: Target },
  { href: "/reuniones", label: "Reuniones", icon: Calendar },
  { href: "/expedientes", label: "Expedientes", icon: FolderOpen },
  { href: "/solicitudes", label: "Solicitudes", icon: ClipboardList },
  { href: "/proveedores", label: "Proveedores", icon: Store },
  { href: "/subvenciones-bd", label: "Pipeline BDNS", icon: Database },
];

const navBottom = [
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export default function Sidebar({ rol }: { rol?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [alertasCount, setAlertasCount] = useState(0);
  const [bandejaCount, setBandejaCount] = useState(0);

  useEffect(() => {
    // Cargar count de alertas para badge de /alertas
    fetch('/api/alertas')
      .then(r => r.json())
      .then(d => {
        setAlertasCount(d.total || 0);
        // Calcular bandeja: alertas críticas + altas sin resolver
        const alertas: Array<{ prioridad: string; resuelta: boolean }> = d.alertas ?? [];
        const alertasCriticasAltas = alertas.filter(
          a => !a.resuelta && (a.prioridad === 'critica' || a.prioridad === 'alta')
        ).length;

        // Solicitudes pendientes sin expediente
        Promise.resolve(
          supabase
            .from('solicitudes')
            .select('id', { count: 'exact', head: true })
            .in('estado', ['pendiente_encaje', 'encaje_confirmado', 'contrato_firmado', 'pago_pendiente'])
            .is('expediente_id', null)
        ).then(({ count }) => {
          setBandejaCount(alertasCriticasAltas + (count ?? 0));
        }).catch(() => setBandejaCount(alertasCriticasAltas));
      })
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
          {nav.map(({ href, label, icon: Icon, badge, bandejaBadge }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const showBadge = badge && alertasCount > 0;
            const showBandejaBadge = bandejaBadge && bandejaCount > 0;
            const badgeValue = showBandejaBadge ? bandejaCount : alertasCount;
            const isAnyBadge = showBadge || showBandejaBadge;
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
                  {isAnyBadge && (
                    <span style={{
                      background: badgeValue >= 5 ? "#ef4444" : "#f97316",
                      color: "#fff", fontSize: "0.65rem", fontWeight: 700,
                      padding: "1px 6px", borderRadius: "100px", minWidth: "18px",
                      textAlign: "center",
                    }}>
                      {badgeValue > 99 ? "99+" : badgeValue}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0 14px 10px" }}>
        {navBottom.filter(item => !(rol === 'tramitador' && item.href === '/ajustes')).map(({ href, label, icon: Icon }) => {
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