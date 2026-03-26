import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Leer rol del usuario
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const rol = (perfil?.rol ?? 'cliente') as 'admin' | 'tramitador' | 'cliente';

  // Solo admin y tramitador acceden al dashboard
  if (rol === 'cliente') redirect('/portal');

  return <DashboardShell userEmail={user.email ?? ""} rol={rol}>{children}</DashboardShell>;
}