"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const INTERVALO_MS = 60_000;

/**
 * `POST /auth/heartbeat` cada ~60s mientras la pestaña está visible, para
 * alimentar "usuarios activos"/"picos de actividad"/"tiempo utilizado" del
 * dashboard (ver frontend/prompt.md sección 2). Fire-and-forget: no maneja la
 * respuesta ni reintenta si falla una vez.
 *
 * El gate NO es `usuario.onboardingCompletado` a secas: ese flag solo aplica
 * al segundo paso del onboarding obligatorio, que el propio backend limita al
 * rol MANAGER (ver `PersonalDataOnboardingModal`, gatillado con
 * `usuario.rol === "MANAGER" && !usuario.onboardingCompletado`). Si acá se
 * usara el flag a secas para todos los roles, el heartbeat quedaría bloqueado
 * para USUARIO/SUPER_ADMIN/MIEMBRO en caso de que el backend no garantice ese
 * campo en `true` para esos roles — dejaría "usuarios activos" en 0 para casi
 * todo el uso real. Se replica la misma condición de bloqueo que ya usa ese
 * modal en vez de asumir el flag como universal.
 */
export function useActivityHeartbeat() {
  const usuario = useAuthStore((state) => state.usuario);
  const bloqueado = !usuario || usuario.mustChangePassword || (usuario.rol === "MANAGER" && !usuario.onboardingCompletado);

  useEffect(() => {
    if (bloqueado) return;

    function enviarHeartbeat() {
      apiFetch<void>("/auth/heartbeat", { method: "POST" }).catch(() => {
        // Fire-and-forget: un fallo puntual no amerita reintento ni feedback al usuario.
      });
    }

    let interval: ReturnType<typeof setInterval> | null = null;

    function iniciarIntervalo() {
      if (interval) return;
      interval = setInterval(enviarHeartbeat, INTERVALO_MS);
    }

    function detenerIntervalo() {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        enviarHeartbeat();
        iniciarIntervalo();
      } else {
        detenerIntervalo();
      }
    }

    if (document.visibilityState === "visible") {
      enviarHeartbeat();
      iniciarIntervalo();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      detenerIntervalo();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [bloqueado]);
}
