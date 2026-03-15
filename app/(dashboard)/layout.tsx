import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          {user.email}
        </div>
      </nav>

      {/* BODY */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "32px 36px 60px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}