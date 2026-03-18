// Layout para las rutas públicas de la landing page.
// NO requiere autenticación — el middleware excluye estas rutas.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
