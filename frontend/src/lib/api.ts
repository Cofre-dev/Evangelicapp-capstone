import { useAuthStore } from "@/stores/auth-store";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Body crudo de la respuesta de error — la mayoría de los llamadores solo
    // necesita `message`, pero algunos endpoints (ej. import de movimientos)
    // devuelven estructura adicional en el 4xx (ej. `errores: {fila, mensaje}[]`)
    // que no cabe en un string.
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

type ApiFetchOptions = RequestInit;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REFRESH_PATH = "/auth/refresh";

// Rutas mutantes públicas, exentas de CSRF en el backend a propósito (no
// requieren sesión: se autentican con un token de un solo uso en la URL o en
// el body, o son anti-enumeración puras como forgot-password). Si el mismo
// navegador además tiene una sesión de staff activa (ej. un pastor probando su
// propio link de QR, o abriendo la landing de "olvidé mi contraseña" en otra
// pestaña), no hay que arrastrar esas requests al circuito de recuperación de
// csrfToken — no lo necesitan y terminarían mandando a un visitante/staff a
// /login sin motivo. Confirmado contra el backend real: estas rutas responden
// sin exigir el header aunque haya cookies de sesión presentes.
const CSRF_EXEMPT_PATHS = [
  /^\/integrantes\/registro\//,
  /^\/agenda\/predicadores\/[^/]+\/responder$/,
  /^\/agenda\/asistencias\/[^/]+\/responder$/,
  /^\/auth\/forgot-password$/,
  /^\/auth\/reset-password$/,
];

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PATHS.some((re) => re.test(path));
}

// Frontend (Vercel) y backend (Render) están en dominios distintos: el JS no
// puede leer la cookie `csrf_token` de otro dominio aunque no sea httpOnly,
// así que el backend manda este valor en el body de /auth/login y
// /auth/refresh y lo guardamos acá en memoria (nunca localStorage/cookie).
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

// El canal de Supabase Realtime (ver src/hooks/use-realtime.ts) se autentica
// con un JWT corto que devuelve `GET /realtime/token` (endpoint protegido por
// la cookie de sesión). Cuando la sesión se refresca acá, el hook re-pide ese
// token y vuelve a llamar `supabase.realtime.setAuth(...)`. Originalmente este
// registro existía para que el socket propio (Socket.IO) reconectara con la
// cookie `access_token` nueva; el transporte cambió, el punto de enganche no.
const refreshListeners = new Set<() => void>();

export function onSessionRefreshed(listener: () => void): () => void {
  refreshListeners.add(listener);
  return () => refreshListeners.delete(listener);
}

async function rawFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { headers, ...rest } = options;
  const method = (rest.method ?? "GET").toUpperCase();

  // FormData (subida de archivos): dejar que el navegador ponga su propio
  // Content-Type con el boundary — si lo fijamos nosotros, el backend no
  // puede parsear el multipart.
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;

  return fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(MUTATING_METHODS.has(method) && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...headers,
    },
  });
}

// Coordina el refresh entre pestañas: sin esto, dos tabs refrescando casi al
// mismo tiempo hacen que el backend interprete el segundo intento como reuso
// de un refresh token ya rotado (su señal de robo) y cierre la sesión en todas.
async function refreshSession(): Promise<boolean> {
  const run = async () => {
    const res = await rawFetch(REFRESH_PATH, { method: "POST" });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    if (body?.csrfToken) setCsrfToken(body.csrfToken);
    refreshListeners.forEach((listener) => listener());
    return true;
  };

  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return navigator.locks.request("evangelicapp-refresh", run);
  }
  return run();
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  // Tras recargar la página la sesión se rehidrata desde localStorage pero el
  // csrfToken (en memoria) se pierde — si ya hay sesión activa, refrescamos
  // una vez antes de la primera request mutante para conseguir uno nuevo en
  // vez de mandar la request sin header y esperar el 403.
  //
  // /auth/refresh también exige X-CSRF-Token (pendiente de que el backend lo
  // exente), así que este refresh preventivo está condenado a fallar con 403
  // en este escenario exacto (recarga completa, sin token en memoria). Si
  // falla, no tiene sentido dejar avanzar la request mutante original hacia
  // el mismo 403 confuso: se trata como sesión no recuperable, igual que el
  // caso de 401 más abajo tras un reintento fallido.
  if (
    MUTATING_METHODS.has(method) &&
    !csrfToken &&
    path !== REFRESH_PATH &&
    !isCsrfExempt(path) &&
    useAuthStore.getState().usuario
  ) {
    const refreshedPreventivo = await refreshSession();
    if (!refreshedPreventivo) {
      setCsrfToken(null);
      useAuthStore.getState().clearSession();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new ApiError(401, "Tu sesión expiró. Inicia sesión de nuevo.");
    }
  }

  let res = await rawFetch(path, options);

  if (res.status === 401 && path !== REFRESH_PATH) {
    const refreshed = await refreshSession();
    res = refreshed ? await rawFetch(path, options) : res;
  }

  if (res.status === 401) {
    setCsrfToken(null);
    useAuthStore.getState().clearSession();
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;

    // Iglesia oculta por mora (ver frontend/prompt.md): cubre tanto el login
    // bloqueado (login/page.tsx además redirige sin depender de esto, para una
    // transición SPA en vez de recarga completa) como una sesión que ya estaba
    // abierta y se corta a mitad de camino cuando el SuperAdmin oculta la
    // iglesia — cualquier request a partir de ahí cae acá.
    if (res.status === 403 && (body as { code?: string } | null)?.code === "IGLESIA_SUSPENDIDA") {
      setCsrfToken(null);
      useAuthStore.getState().clearSession();
      if (typeof window !== "undefined") {
        const dias = (body as { diasEnMora?: number }).diasEnMora ?? 0;
        window.location.href = `/cuenta-suspendida?dias=${dias}`;
      }
    }

    throw new ApiError(res.status, message ?? "Ocurrió un error inesperado", body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
