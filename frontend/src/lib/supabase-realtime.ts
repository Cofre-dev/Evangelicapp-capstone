import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente(s) Supabase — usados EXCLUSIVAMENTE para el canal de Realtime
 * (`.channel()` / `.realtime`) de las pantallas "en vivo" (ver
 * `src/hooks/use-realtime.ts`, `src/hooks/use-convocatoria-realtime.ts` y
 * `frontend/prompt.md`).
 *
 * Reemplaza al gateway propio de Socket.IO que mantenía el backend. Todo lo
 * demás sigue igual: los datos de negocio se piden con `apiFetch` (cookies
 * httpOnly contra el backend NestJS) y NO por este cliente — nada de
 * `supabase.from(...)`, auth de supabase, ni storage. Solo Realtime.
 *
 * `persistSession`/`autoRefreshToken` van en `false` a propósito: acá no hay
 * sesión de supabase-auth. La conexión de Realtime se autentica con un JWT
 * corto (HS256) que devuelve un endpoint del backend y que el hook renueva vía
 * `client.realtime.setAuth(token)` antes de cada expiración.
 *
 * `makeClient()` devuelve `null` si faltan las variables de entorno (entorno
 * sin Realtime configurado): los hooks lo tratan como "sin realtime" y las
 * pantallas siguen funcionando con su carga/refresh normal.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function makeClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let sessionClient: SupabaseClient | null = null;

/**
 * Cliente singleton para el canal de sesión (`tenant:<iglesiaId>` /
 * `superadmin`) — lo usa `use-realtime.ts` mientras haya sesión.
 */
export function getSupabaseRealtimeClient(): SupabaseClient | null {
  if (!sessionClient) sessionClient = makeClient();
  return sessionClient;
}

/**
 * Instancia NUEVA e independiente para un canal público por-evento (la página
 * `/agenda/convocatoria/[token]`, ver `use-convocatoria-realtime.ts`). A
 * propósito NO comparte instancia con el cliente de sesión: los dos llaman
 * `realtime.setAuth()` con tokens distintos y se pisarían. El hook la crea al
 * montar y la descarta (`realtime.disconnect()`) al desmontar.
 */
export function createPublicRealtimeClient(): SupabaseClient | null {
  return makeClient();
}
