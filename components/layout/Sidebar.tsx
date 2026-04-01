"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Building2, Calendar, FolderOpen, LogOut, Database, Settings,
  ClipboardList, Store, Bell, MessageCircle, LayoutDashboard,
  AlertTriangle, Sparkles, Inbox, Target, Radar, Layers,
} from "lucide-react";

const SECTIONS = [
  {
    label: "Principal",
    items: [
      { href: "/bandeja", label: "Bandeja", icon: Inbox, bandejaBadge: true },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/expedientes", label: "Expedientes", icon: FolderOpen },
      { href: "/solicitudes", label: "Solicitudes", icon: ClipboardList },
      { href: "/clientes", label: "Clientes", icon: Building2 },
      { href: "/chats", label: "Chats", icon: MessageCircle },
      { href: "/alertas", label: "Alertas", icon: AlertTriangle, badge: true },
      { href: "/reuniones", label: "Reuniones", icon: Calendar },
    ],
  },
  {
    label: "Captación",
    items: [
      { href: "/matches", label: "Matches IA", icon: Sparkles },
      { href: "/novedades", label: "Novedades", icon: Bell },
      { href: "/prospectos", label: "Prospectos", icon: Target },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/subvenciones-bd", label: "Pipeline BDNS", icon: Database },
      { href: "/sector-scan", label: "Radar sectorial", icon: Radar },
      { href: "/proveedores", label: "Proveedores", icon: Store },
      { href: "/plantillas", label: "Plantillas", icon: Layers },
    ],
  },
];

export default function Sidebar({ rol }: { rol?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [alertasCount, setAlertasCount] = useState(0);
  const [bandejaCount, setBandejaCount] = useState(0);

  useEffect(() => {
    fetch('/api/alertas')
      .then(r => r.json())
      .then(d => {
        setAlertasCount(d.total || 0);
        const alertas: Array<{ prioridad: string; resuelta: boolean }> = d.alertas ?? [];
        const alertasCriticasAltas = alertas.filter(
          a => !a.resuelta && (a.prioridad === 'critica' || a.prioridad === 'alta')
        ).length;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside style={{
      width: 232,
      flexShrink: 0,
      background: "#0d1f3c",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      padding: "0",
      position: "sticky",
      top: 60,
      height: "calc(100vh - 60px)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      overflowY: "auto",
    }}>
      {/* Navegación principal */}
      <div style={{ padding: "12px 8px", flex: 1 }}>
        {SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: 4 }}>
            <div style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.3)",
              padding: "10px 10px 5px",
            }}>
              {section.label}
            </div>
            {section.items
              .filter(() => !(rol === 'tramitador' && ['Sistema'].includes(section.label)))
              .map(({ href, label, icon: Icon, badge, bandejaBadge }: {
                href: string; label: string;
                icon: React.ComponentType<{ size?: number }>;
                badge?: boolean; bandejaBadge?: boolean
              }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                const showBadge = badge && alertasCount > 0;
                const showBandejaBadge = bandejaBadge && bandejaCount > 0;
                const badgeValue = showBandejaBadge ? bandejaCount : alertasCount;
                const isAnyBadge = showBadge || showBandejaBadge;

                return (
                  <Link key={href} href={href} style={{ textDecoration: "none" }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "7px 10px",
                      borderRadius: 7,
                      fontSize: "0.83rem",
                      fontWeight: active ? 600 : 400,
                      color: active ? "#fff" : "rgba(255,255,255,0.55)",
                      background: active ? "rgba(13,148,136,0.25)" : "transparent",
                      marginBottom: 1,
                      cursor: "pointer",
                      transition: "all 0.12s",
                      justifyContent: "space-between",
                      borderLeft: active ? "2px solid #0d9488" : "2px solid transparent",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <Icon size={15} />
                        {label}
                      </div>
                      {isAnyBadge && (
                        <span style={{
                          background: badgeValue >= 5 ? "#ef4444" : "#f97316",
                          color: "#fff",
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "100px",
                          minWidth: "17px",
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
        ))}
      </div>

      {/* Fondo: Ajustes + Logout */}
      <div style={{ padding: "8px 8px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {rol !== 'tramitador' && (
          <Link href="/ajustes" style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "7px 10px", borderRadius: 7,
              fontSize: "0.83rem", fontWeight: 400,
              color: pathname === "/ajustes" ? "#fff" : "rgba(255,255,255,0.45)",
              background: pathname === "/ajustes" ? "rgba(13,148,136,0.25)" : "transparent",
              marginBottom: 2, cursor: "pointer",
              borderLeft: pathname === "/ajustes" ? "2px solid #0d9488" : "2px solid transparent",
            }}>
              <Settings size={15} />
              Ajustes
            </div>
          </Link>
        )}
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "7px 10px", borderRadius: 7, width: "100%",
            fontSize: "0.83rem", fontWeight: 400,
            color: "rgba(255,255,255,0.35)",
            background: "transparent", border: "none",
            cursor: "pointer", fontFamily: "inherit",
            borderLeft: "2px solid transparent",
          }}
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
