-- Elimina el valor 'MIEMBRO' del enum Rol (decisión de producto, 2026-08-20: el
-- sistema solo tiene 3 roles reales -- SUPER_ADMIN, MANAGER, USUARIO -- MIEMBRO
-- nunca tuvo funcionalidad propia). Postgres no soporta DROP VALUE en un enum,
-- así que se recrea el tipo sin el valor y se migra la columna.
--
-- Verificado antes de aplicar: 0 filas en `usuarios` con rol = 'MIEMBRO' (query
-- directa contra la base real). No hay funciones/policies de RLS (Fase 8, ver
-- 20260820181542_enable_rls_tenant_isolation) que dependan del tipo `Rol`:
-- `app_is_privileged()` compara un `current_setting` de texto contra literales
-- ('SUPER_ADMIN', 'SERVICE'), no el enum de la columna -- así que este cambio
-- no interactúa con la Fase 8.
--
-- Aplicado a mano vía las herramientas MCP de Supabase (mismo motivo que la
-- migración de RLS: este entorno no tiene conectividad de red directa a la
-- base). Verificado post-aplicación contra la base real: `enum_range(NULL::"Rol")`
-- devuelve exactamente ('SUPER_ADMIN','MANAGER','USUARIO'), y las 8 filas de
-- `usuarios` (1 SUPER_ADMIN, 3 MANAGER, 4 USUARIO) mantienen su rol intacto.
-- Falta reconciliar `_prisma_migrations` con
-- `prisma migrate resolve --applied 20260821035755_remove_rol_miembro`
-- la próxima vez que alguien tenga conectividad directa a la base.

ALTER TYPE "Rol" RENAME TO "Rol_old";

CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'USUARIO');

ALTER TABLE "usuarios"
  ALTER COLUMN "rol" TYPE "Rol" USING ("rol"::text::"Rol");

DROP TYPE "Rol_old";
