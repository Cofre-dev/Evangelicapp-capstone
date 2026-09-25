/**
 * Rutas alcanzables con `mustChangePassword === true`. Todo lo demás responde 403
 * hasta que el usuario cambie la contraseña temporal — sin esto, `mustChangePassword`
 * era solo una señal advisoria para que el FRONTEND mostrara una pantalla obligatoria,
 * pero un cliente que hablara directo con la API podía seguir usando cualquier
 * endpoint de su rol indefinidamente sin cambiar la contraseña temporal.
 *
 * Usada por `JwtAuthGuard` (Fase 7 de docs/supabase.md, corte final — antes vivía
 * duplicada en `JwtStrategy` y `SupabaseJwtAuthGuard`, ahora es un solo guard).
 */
export const MUST_CHANGE_PASSWORD_ALLOWLIST: ReadonlySet<string> = new Set([
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
  '/onboarding/complete',
]);
