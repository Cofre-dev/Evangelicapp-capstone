"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { ApiError, apiFetch, onSessionRefreshed } from "@/lib/api";
import { getSupabaseRealtimeClient } from "@/lib/supabase-realtime";
import { useAuthStore } from "@/stores/auth-store";
import type { AsistenciaRespondidaPayload, PredicadorRespondioPayload } from "@/components/agenda/types";
import type { IntegranteRegistradoPayload } from "@/components/integrantes/types";
import type { IglesiaListItem } from "@/components/iglesias/types";

/**
 * Tiempo real de las 3 pantallas "en vivo" — dashboard SuperAdmin, detalle de
 * evento (badges de predicadores) y censo QR. Antes esto era un gateway propio
 * de Socket.IO en el backend; ahora el transporte es **Supabase Realtime
 * (Broadcast)**. Los nombres de evento y la forma de los payloads NO cambiaron
 * (ver `frontend/prompt.md`).
 *
 * Contrato con el backend:
 * - `GET /realtime/token` (autenticado con la cookie de sesión vía `apiFetch`)
 *   devuelve `{ token, topic, expiresInSeconds }`. El backend decide el `topic`
 *   (`'superadmin'` o `'tenant:<iglesiaId>'`) según el rol/iglesia de la sesión
 *   — no se le manda ningún parámetro.
 * - El `token` (JWT HS256 de vida corta) autentica la conexión vía
 *   `supabase.realtime.setAuth(token)`. Hay que renovarlo antes de que expire
 *   (`expiresInSeconds - RENEW_MARGIN_SECONDS`) o Realtime corta la conexión.
 * - Un solo canal privado por usuario, con nombre = `topic`. Ahí llegan todos
 *   los eventos que le corresponden. El aislamiento multi-tenant lo garantiza
 *   una policy RLS sobre `realtime.messages` en Supabase, no el cliente.
 * - `GET /realtime/token` puede responder 503 si el entorno no tiene Realtime
 *   configurado — se trata como "sin realtime": las pantallas siguen andando
 *   con su carga/refresh REST normal, sin spamear la consola.
 *
 * Uso: `useRealtimeEvent('predicador:respondio', (payload) => { ... })`.
 * Un `RealtimeChannel` de supabase no expone un `.off(listener)` limpio, así
 * que este módulo mantiene UN canal singleton + un registro de handlers por
 * evento: `.on('broadcast', { event }, ...)` se registra una sola vez por
 * evento y hace fan-out a los handlers que `useRealtimeEvent` haya sumado.
 */

/** Mapa evento -> shape del payload (idéntico al que emitía Socket.IO). */
export interface RealtimeEventPayloads {
  /** Mismo shape que un item de `GET /iglesias` (`IglesiaListItem`). Solo llega
   *  en el topic `'superadmin'`. */
  "iglesia:actualizada": IglesiaListItem;
  /** Topic `'tenant:<iglesiaId>'`. */
  "predicador:respondio": PredicadorRespondioPayload;
  /** Topic `'tenant:<iglesiaId>'`. */
  "integrante:registrado": IntegranteRegistradoPayload;
  /** Topic `'tenant:<iglesiaId>'` — un integrante respondió la convocatoria a
   *  un evento desde el link del correo. */
  "asistencia:respondida": AsistenciaRespondidaPayload;
}

export type RealtimeEventName = keyof RealtimeEventPayloads;

const EVENT_NAMES: RealtimeEventName[] = [
  "iglesia:actualizada",
  "predicador:respondio",
  "integrante:registrado",
  "asistencia:respondida",
];

interface RealtimeTokenResponse {
  token: string;
  topic: string;
  expiresInSeconds: number;
}

/** Margen (segundos) antes de la expiración para renovar el token y volver a
 *  llamar `setAuth`. Con `expiresInSeconds = 1800` y refresh a los ~29 min, el
 *  rate limit de 30/min por IP del endpoint sobra de lejos. */
const RENEW_MARGIN_SECONDS = 60;

// --- Estado singleton del canal --------------------------------------------

type Handler = (payload: unknown) => void;

const handlers = new Map<RealtimeEventName, Set<Handler>>();
let subscriberCount = 0;
let channel: RealtimeChannel | null = null;
let renewTimer: ReturnType<typeof setTimeout> | null = null;
let releaseSessionRefreshed: (() => void) | null = null;
let connecting = false;
/** Entorno sin Realtime (503, o faltan las env vars de Supabase). Sticky: no
 *  cambia dentro de una sesión, así que no se reintenta. */
let unavailable = false;
/** Invalida callbacks async en vuelo cuando hubo un teardown/reconnect. */
let generation = 0;

function dispatch(event: RealtimeEventName, payload: unknown): void {
  const set = handlers.get(event);
  if (!set) return;
  for (const handler of set) {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[realtime] el handler de "${event}" lanzó una excepción`, err);
    }
  }
}

async function fetchRealtimeToken(): Promise<RealtimeTokenResponse | null> {
  try {
    return await apiFetch<RealtimeTokenResponse>("/realtime/token");
  } catch (err) {
    // 503 -> el backend no tiene SUPABASE_JWT_SECRET: no habrá realtime en este
    // entorno, no tiene sentido reintentar. Cualquier otro fallo se trata igual
    // que "sin realtime" pero sin marcarlo sticky: un mount posterior o un
    // refresh de sesión puede volver a intentar (no es un loop).
    if (err instanceof ApiError && err.status === 503) unavailable = true;
    return null;
  }
}

function clearRenewTimer(): void {
  if (renewTimer) {
    clearTimeout(renewTimer);
    renewTimer = null;
  }
}

function scheduleRenew(expiresInSeconds: number): void {
  clearRenewTimer();
  const delayMs = Math.max(expiresInSeconds - RENEW_MARGIN_SECONDS, 30) * 1000;
  renewTimer = setTimeout(() => void renewToken(), delayMs);
}

async function renewToken(): Promise<void> {
  if (!channel) return;
  const mine = generation;
  const tokenRes = await fetchRealtimeToken();
  if (mine !== generation || !channel) return;

  if (!tokenRes) {
    // No pudimos renovar: el token vigente va a expirar y Supabase cortará la
    // conexión. Cerramos prolijo y, si todavía hay consumidores, reconectamos.
    reconnect();
    return;
  }

  await getSupabaseRealtimeClient()?.realtime.setAuth(tokenRes.token);
  if (mine !== generation) return;
  scheduleRenew(tokenRes.expiresInSeconds);
}

async function connect(): Promise<void> {
  if (unavailable || connecting || channel || subscriberCount === 0) return;

  const supabase = getSupabaseRealtimeClient();
  if (!supabase) {
    // Faltan NEXT_PUBLIC_SUPABASE_* — mismo trato que un 503.
    unavailable = true;
    return;
  }

  connecting = true;
  const mine = generation;

  try {
    const tokenRes = await fetchRealtimeToken();
    if (mine !== generation) return;
    if (!tokenRes) return; // "sin realtime" — las pantallas siguen con REST

    await supabase.realtime.setAuth(tokenRes.token);
    if (mine !== generation) return;

    const ch = supabase.channel(tokenRes.topic, { config: { private: true } });
    for (const event of EVENT_NAMES) {
      ch.on("broadcast", { event }, (message) => {
        dispatch(event, (message as { payload?: unknown }).payload);
      });
    }
    ch.subscribe();

    channel = ch;
    scheduleRenew(tokenRes.expiresInSeconds);
  } finally {
    if (mine === generation) connecting = false;
  }
}

function teardown(): void {
  generation += 1;
  connecting = false;
  clearRenewTimer();
  if (channel) {
    getSupabaseRealtimeClient()?.removeChannel(channel);
    channel = null;
  }
}

function reconnect(): void {
  const hadSubscribers = subscriberCount > 0;
  teardown();
  if (hadSubscribers) void connect();
}

// Una request que responde 401 dispara `POST /auth/refresh` y rota la cookie de
// sesión. Cuando eso pasa, re-pedimos un token de Realtime nuevo y volvemos a
// llamar `setAuth` — el `onSessionRefreshed` de `api.ts` existía originalmente
// para que el socket viejo reconectara con la cookie nueva; acá lo reusamos
// para refrescar la credencial del canal.
function handleSessionRefreshed(): void {
  if (unavailable) return;
  if (channel) void renewToken();
  else void connect();
}

const realtimeManager = {
  addHandler(event: RealtimeEventName, handler: Handler): () => void {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    set.add(handler);
    subscriberCount += 1;

    if (subscriberCount === 1 && !releaseSessionRefreshed) {
      releaseSessionRefreshed = onSessionRefreshed(handleSessionRefreshed);
    }
    void connect();

    return () => {
      set!.delete(handler);
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (subscriberCount === 0) {
        releaseSessionRefreshed?.();
        releaseSessionRefreshed = null;
        teardown();
      }
    };
  },
};

// --- Hook público ----------------------------------------------------------

/**
 * Engancha `handler` a un evento de Realtime mientras el componente esté
 * montado y haya sesión. El `handler` puede ser inline: se guarda en un ref y
 * no re-suscribe el canal en cada render.
 */
export function useRealtimeEvent<E extends RealtimeEventName>(
  event: E,
  handler: (payload: RealtimeEventPayloads[E]) => void,
): void {
  const usuarioId = useAuthStore((state) => state.usuario?.id ?? null);

  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!usuarioId) return;
    const stable: Handler = (payload) => handlerRef.current(payload as RealtimeEventPayloads[E]);
    return realtimeManager.addHandler(event, stable);
  }, [event, usuarioId]);
}
