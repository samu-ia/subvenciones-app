"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AjustesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/subvenciones-bd"); }, [router]);
  return null;
}
