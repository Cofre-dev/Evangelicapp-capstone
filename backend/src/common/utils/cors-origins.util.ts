/**
 * CORS_ORIGIN admite varios orígenes separados por coma (ej. dev + prod, ver
 * .env.example). Compartido entre main.ts (CORS del servidor HTTP) y
 * RealtimeGateway (CORS del handshake de socket.io) para no duplicar el parseo.
 */
export function resolveCorsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
