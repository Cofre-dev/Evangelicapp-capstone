/**
 * Nombres de rooms/topics y eventos de tiempo real. El scoping por tenant vive
 * acá y en RealtimeGateway#handleConnection / RealtimeTokenService — nunca en el
 * cliente: un socket (o un canal de Supabase Realtime) solo alcanza a SU PROPIA
 * iglesia (o a `superadmin` si el rol lo es), nunca a una elegida por el cliente.
 *
 * Migración a Supabase Realtime (ver docs/realtime-migration.md): durante el
 * parallel-run conviven las dos convenciones de nombres —
 *   - socket.io rooms: `superadmin` / `iglesia:{id}`  (legacy, se remueve al final)
 *   - Supabase Broadcast topics: `superadmin` / `tenant:{id}`
 * Se usan prefijos distintos (`iglesia:` vs `tenant:`) para poder distinguir en
 * logs por qué transporte llegó cada evento mientras dure el solapamiento.
 */
export const SUPERADMIN_ROOM = 'superadmin';

export function iglesiaRoom(iglesiaId: string): string {
  return `iglesia:${iglesiaId}`;
}

/** Topic de Supabase Broadcast para el dashboard del SuperAdmin. */
export const SUPERADMIN_TOPIC = 'superadmin';

/** Topic de Supabase Broadcast scopeado a una iglesia. */
export function tenantTopic(iglesiaId: string): string {
  return `tenant:${iglesiaId}`;
}

/**
 * Topic de Supabase Broadcast para el estado en vivo de la convocatoria de UN
 * evento (predicadores + integrantes). Lo abre gente sin cuenta desde el link
 * del correo de invitación — la autoriza un token de Realtime de vida corta con
 * claim `evento_id` (ver RealtimeTokenService#mintForConvocatoria y la policy
 * RLS `..._realtime_convocatoria_topic`). Solo Supabase Broadcast, nunca
 * socket.io (ese gateway requiere una sesión).
 */
export function convocatoriaTopic(eventoId: string): string {
  return `convocatoria:${eventoId}`;
}

export const REALTIME_EVENTS = {
  IGLESIA_ACTUALIZADA: 'iglesia:actualizada',
  PREDICADOR_RESPONDIO: 'predicador:respondio',
  INTEGRANTE_REGISTRADO: 'integrante:registrado',
  /** Un integrante convocado a un evento confirmó/rechazó su asistencia (RSVP por token). */
  ASISTENCIA_RESPONDIDA: 'asistencia:respondida',
} as const;
