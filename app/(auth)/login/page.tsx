"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// El login es ahora un modal en la landing page.
// Redirigir a / para que el usuario use el modal.
export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
