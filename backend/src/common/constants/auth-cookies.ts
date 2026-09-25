/**
 * Nombres de cookies compartidos entre el módulo de auth (que las setea) y
 * la infraestructura común (guard/middleware que las lee) para evitar que
 * `common` dependa de `modules/auth`.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
