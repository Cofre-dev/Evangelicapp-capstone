-- Anti-fuerza-bruta del login (ver AuthService#validateUser): contador de intentos
-- fallidos + bloqueo temporal. Columnas nuevas en una tabla ya existente, sin default
-- de datos que recalcular. La RLS de `usuarios` ya cubre estas filas (policy
-- column-agnostic); AuthService las escribe bajo runAsService (rol SERVICE), que ya
-- pasa `app_is_privileged()`.
--
-- Se aplica por MCP a `Backend-staging` (y a `Backend` si se corre el backend local).

ALTER TABLE "usuarios" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usuarios" ADD COLUMN "lockedUntil" TIMESTAMP(3);
