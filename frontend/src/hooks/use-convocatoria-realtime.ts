"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { apiFetch } from "@/lib/api";
import { createPublicRealtimeClient } from "@/lib/supabase-realtime";
import type { EstadoAsistencia, EstadoConfirmacionPredicador } from "@/components/agenda/types";

/**
 * Realtime de la página PÚBLICA `/agenda/convocatoria/[token]` (ver
 * `frontend/prompt.md`, bloque B). Distinto de `use-realtime.ts`:
 * - Canal por-EVENTO (`convocatoria:<eventoId>`), no por-tenant.
 * - Sin sesión: el JWT corto sale de `GET /agenda/convocatoria/:token/realtime`.
 * - **Cliente Supabase propio** (`createPublicRealtimeClient()`), NO el
 *   singleton de sesión: los dos llaman `realtime.setAuth()` y se pisarían.
 *
 * El backend emite los mismos eventos que el canal de tenant pero con el
 * payload SIN email. `503` en el endpoint del token → `sinRealtime: true`: la
 * página funciona igual, solo sin actualización automática.
 */

interface ConvocatoriaRealtimeToken {
  token: string;
  topic: string;
  expiresInSeconds: number;
}

/** Payload de `predicador:respondio` en el canal público (sin email). */
export interface PredicadorRespondioBroadcast {
  eventoId: string;
  predicadorId: string;
  nombre: string | null;
  estado: EstadoConfirmacionPredicador;
  respondidoAt: string;
}

/** Payload de `asistencia:respondida` en el canal público (sin email). */
export interface AsistenciaRespondidaBroadcast {
  eventoId: string;
  integranteId: string;
  nombreCompleto: string;
  estado: Extract<EstadoAsistencia, "CONFIRMADO" | "RECHAZADO">;
  respondidoAt: string;
}

interface ConvocatoriaRealtimeHandlers {
  onPredicadorRespondio: (payload: PredicadorRespondioBroadcast) => void;
  onAsistenciaRespondida: (payload: AsistenciaRespondidaBroadcast) => void;
}

/** Margen (segundos) antes de la expiración para re-pedir el token y volver a
 *  llamar `setAuth`. Si el token expira, Supabase corta la conexión. */
const RENEW_MARGIN_SECONDS = 60;

export function useConvocatoriaRealtime(
  token: string | null,
  handlers: ConvocatoriaRealtimeHandlers,
): { sinRealtime: boolean } {
  const [sinRealtime, setSinRealtime] = useState(false);

  // Los handlers van por ref para no re-suscribir el canal si el componente
  // los pasa inline.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let renewTimer: ReturnType<typeof setTimeout> | null = null;

    // Devuelve null (y marca "sin realtime") ante 503 o cualquier otro fallo,
    // sin spamear la consola en loop.
    async function fetchToken(): Promise<ConvocatoriaRealtimeToken | null> {
      try {
        return await apiFetch<ConvocatoriaRealtimeToken>(`/agenda/convocatoria/${token}/realtime`);
      } catch {
        if (!cancelled) setSinRealtime(true);
        return null;
      }
    }

    function scheduleRenew(expiresInSeconds: number): void {
      if (renewTimer) clearTimeout(renewTimer);
      const delayMs = Math.max(expiresInSeconds - RENEW_MARGIN_SECONDS, 30) * 1000;
      renewTimer = setTimeout(() => void renew(), delayMs);
    }

    async function renew(): Promise<void> {
      const next = await fetchToken();
      // No se pudo renovar: el token vigente va a expirar y Supabase cortará la
      // conexión. `fetchToken` ya dejó `sinRealtime` en true.
      if (cancelled || !client || !next) return;
      await client.realtime.setAuth(next.token);
      if (cancelled) return;
      scheduleRenew(next.expiresInSeconds);
    }

    async function start(): Promise<void> {
      const created = createPublicRealtimeClient();
      if (!created) {
        if (!cancelled) setSinRealtime(true);
        return;
      }
      client = created; // asignar ya, para que el cleanup pueda descartarlo

      const first = await fetchToken();
      if (cancelled || !first) return;

      await client.realtime.setAuth(first.token);
      if (cancelled) return;

      const ch = client.channel(first.topic, { config: { private: true } });
      ch.on("broadcast", { event: "predicador:respondio" }, ({ payload }) => {
        handlersRef.current.onPredicadorRespondio(payload as PredicadorRespondioBroadcast);
      });
      ch.on("broadcast", { event: "asistencia:respondida" }, ({ payload }) => {
        handlersRef.current.onAsistenciaRespondida(payload as AsistenciaRespondidaBroadcast);
      });
      ch.subscribe();

      channel = ch;
      scheduleRenew(first.expiresInSeconds);
    }

    void start();

    return () => {
      cancelled = true;
      if (renewTimer) clearTimeout(renewTimer);
      if (client && channel) void client.removeChannel(channel);
      client?.realtime.disconnect();
    };
  }, [token]);

  return { sinRealtime };
}
