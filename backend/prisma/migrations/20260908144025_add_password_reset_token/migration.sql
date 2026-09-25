-- "Olvidé mi contraseña" desde el login (ver AuthService#requestPasswordReset /
-- #resetPassword y prompt.md). Tabla nueva y aislada: no toca ninguna existente.
--
-- Cómo se aplica (este entorno no tiene conectividad directa a la base — P1001,
-- igual que las migraciones de RLS): por MCP de Supabase (apply_migration) a
-- `Backend-staging` y a `Backend`. El Render de staging NO corre
-- `prisma migrate deploy` (ver docs/realtime-migration.md), así que la reconciliación
-- de `_prisma_migrations` se hace a mano — `prisma migrate resolve --applied
-- 20260908144025_add_password_reset_token` la próxima vez que haya conectividad directa.

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_usuarioId_idx" ON "password_reset_tokens"("usuarioId");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- Fase 8 de docs/supabase.md (RLS). A diferencia de `refresh_tokens` (que quedó
-- SIN RLS, ver esa migración), esta tabla sí la activa: todo su acceso ocurre
-- bajo `runAsService` (rutas públicas /auth/forgot-password y /auth/reset-password,
-- sin identidad de Usuario), así que basta con permitir el bypass privilegiado
-- (SERVICE / SUPER_ADMIN) y negar todo lo demás. `app_is_privileged()` ya existe
-- (creada en 20260820181542_enable_rls_tenant_isolation).
-- ==========================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "password_reset_tokens" TO app_runtime;
  END IF;
END $$;

ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" FORCE ROW LEVEL SECURITY;

CREATE POLICY service_only ON "password_reset_tokens"
  USING ((SELECT app_is_privileged()))
  WITH CHECK ((SELECT app_is_privileged()));
