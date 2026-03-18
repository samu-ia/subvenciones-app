import { redirect } from "next/navigation";

// La landing real está en app/(public)/page.tsx
// Este archivo no debería existir pero Next.js lo prioriza si está aquí.
// Redirigir a la landing pública.
export default function Home() {
  redirect("/");
}
