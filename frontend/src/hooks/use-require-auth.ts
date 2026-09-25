"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Redirige a /login si, una vez rehidratado el store, no hay sesión.
 * `ready` queda en false mientras se espera la rehidratación o se ejecuta
 * el redirect, para que la página no parpadee contenido antes de decidir.
 */
export function useRequireAuth() {
  const router = useRouter();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const usuario = useAuthStore((state) => state.usuario);

  useEffect(() => {
    if (hasHydrated && !usuario) {
      router.replace("/login");
    }
  }, [hasHydrated, usuario, router]);

  return { usuario, ready: hasHydrated && Boolean(usuario) };
}
