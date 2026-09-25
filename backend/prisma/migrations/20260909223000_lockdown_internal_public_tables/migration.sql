-- Hotfix de seguridad (advisor `rls_disabled_in_public`, nivel ERROR en el Advisor Center
-- de Supabase). `public._prisma_migrations` y `public.refresh_tokens` estaban en el schema
-- expuesto por PostgREST SIN RLS, y el rol `anon` (cuya API key viaja en el bundle del
-- frontend, ver NEXT_PUBLIC_SUPABASE_ANON_KEY) tenía DELETE/INSERT/UPDATE/TRUNCATE/SELECT
-- sobre ambas vía `/rest/v1/`. Vector real: cualquiera con esa key podía vaciar
-- `_prisma_migrations` y romper el tracking de migraciones (denial-of-deploy), o inyectar
-- filas en `refresh_tokens`. Las 18 tablas de negocio ya estaban protegidas por RLS `FORCE`
-- + policy `tenant_isolation` (ver 20260820181542); estas 2 se colaron porque ningún
-- `enable RLS` las cubría.
--
-- Fix: RLS `ENABLE` sin policy (para `anon`/`authenticated` — sin BYPASSRLS — eso significa
-- 0 filas en SELECT y writes denegados) + `REVOKE` explícito de los grants. `postgres`
-- (owner, con BYPASSRLS en este proyecto) no se ve afectado → `prisma migrate` sigue
-- operando normal. La API corre como `app_runtime`, que nunca toca estas 2 tablas.
--
-- `refresh_tokens` está muerta desde el cutover de Fase 7 (0 filas, Supabase Auth maneja
-- los refresh tokens) — el DROP definitivo sigue pendiente como migración aparte, junto con
-- sacar el modelo de `schema.prisma` (ver README "Pendientes conocidos").
--
-- Aplicado a `Backend-staging` (producción) vía MCP de Supabase (apply_migration) el
-- 2026-09-09 — este entorno no tiene conectividad directa a la base. Falta reconciliar
-- `_prisma_migrations`: `prisma migrate resolve --applied 20260909223000_lockdown_internal_public_tables`
-- la próxima vez que alguien tenga esa conectividad.

ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."_prisma_migrations" FROM anon, authenticated;

ALTER TABLE "public"."refresh_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."refresh_tokens" FROM anon, authenticated, app_runtime;

-- Defensa en profundidad: que las próximas tablas que cree `prisma migrate deploy` (como
-- `postgres`) NO nazcan con grants automáticos para `anon`/`authenticated`. Las tablas de
-- negocio igual llevan su propia RLS explícita; esto evita repetir el agujero si alguna
-- migración futura se olvida. `app_runtime` conserva su default privilege (arwd), así que
-- la API sigue viendo las tablas nuevas sin re-grant manual.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "public" REVOKE ALL ON TABLES FROM anon, authenticated;
