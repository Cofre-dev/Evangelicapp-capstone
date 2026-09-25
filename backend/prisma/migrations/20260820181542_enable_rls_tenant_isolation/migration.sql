-- Fase 8 de docs/supabase.md — RLS atada al contexto de tenant que fija PrismaService
-- (ver backend/src/prisma/prisma.service.ts y backend/src/common/context/tenant-context.ts).
--
-- Nota sobre cómo se aplicó: este archivo se escribió a mano (no generado por
-- `prisma migrate dev`, que no tiene conectividad de red directa a la base desde este
-- entorno) y se aplicó al proyecto real vía las herramientas MCP de Supabase
-- (execute_sql/apply_migration). Falta reconciliar `_prisma_migrations` en la base real
-- corriendo `prisma migrate resolve --applied 20260820181542_enable_rls_tenant_isolation`
-- la próxima vez que alguien tenga conectividad directa (ver docs/supabase-todo.md).
--
-- Requiere que exista el rol `app_runtime` (sin BYPASSRLS, a diferencia de `postgres`,
-- que sí lo tiene en este proyecto de Supabase y por eso nunca hubiera quedado sujeto a
-- estas policies) — creado por separado vía SQL directo, no como parte de este archivo,
-- porque CREATE ROLE con password no debe versionarse en texto plano. Ver FEATURES.md.

create or replace function app_iglesia_id() returns text
  language sql stable
  set search_path = ''
  as $$ select nullif(current_setting('app.iglesia_id', true), '') $$;

create or replace function app_usuario_id() returns text
  language sql stable
  set search_path = ''
  as $$ select nullif(current_setting('app.usuario_id', true), '') $$;

create or replace function app_is_privileged() returns boolean
  language sql stable
  set search_path = ''
  as $$ select current_setting('app.rol', true) in ('SUPER_ADMIN', 'SERVICE') $$;

comment on function app_iglesia_id() is
  'Fase 8 de docs/supabase.md: iglesiaId del contexto de tenant fijado por PrismaService en cada query (o NULL si no hay ninguno, p.ej. request anónimo).';
comment on function app_usuario_id() is
  'Fase 8 de docs/supabase.md: usuarioId del contexto de tenant — solo se usa para las policies de auto-lectura (usuarios/sesiones_actividad) que resuelven el bootstrap de JwtAuthGuard antes de conocer iglesiaId.';
comment on function app_is_privileged() is
  'Fase 8 de docs/supabase.md: true si el contexto de tenant es SUPER_ADMIN (cross-tenant real) o SERVICE (bypass explícito y acotado para login/refresh, las 3 rutas públicas por token, y el cron de facturación — ver runAsService en tenant-context.ts).';

-- ==========================================================================
-- Tenant raíz: scoped por "id", no por "iglesiaId" (la tabla ES el tenant).
-- ==========================================================================

alter table iglesias enable row level security;
alter table iglesias force row level security;

create policy tenant_isolation on iglesias
  using ("id" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("id" = (select app_iglesia_id()) or (select app_is_privileged()));

-- ==========================================================================
-- Tablas con "iglesiaId" no nulo: mismo patrón estándar para las 13.
-- ==========================================================================

alter table pagos_iglesia enable row level security;
alter table pagos_iglesia force row level security;
create policy tenant_isolation on pagos_iglesia
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table accesos_modulo enable row level security;
alter table accesos_modulo force row level security;
create policy tenant_isolation on accesos_modulo
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table eventos enable row level security;
alter table eventos force row level security;
create policy tenant_isolation on eventos
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table departamentos_financieros enable row level security;
alter table departamentos_financieros force row level security;
create policy tenant_isolation on departamentos_financieros
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table categorias_financieras enable row level security;
alter table categorias_financieras force row level security;
create policy tenant_isolation on categorias_financieras
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table movimientos_financieros enable row level security;
alter table movimientos_financieros force row level security;
create policy tenant_isolation on movimientos_financieros
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table movimientos_auditoria enable row level security;
alter table movimientos_auditoria force row level security;
create policy tenant_isolation on movimientos_auditoria
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table notas enable row level security;
alter table notas force row level security;
create policy tenant_isolation on notas
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table integrantes enable row level security;
alter table integrantes force row level security;
create policy tenant_isolation on integrantes
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table matrimonios enable row level security;
alter table matrimonios force row level security;
create policy tenant_isolation on matrimonios
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table bautizos enable row level security;
alter table bautizos force row level security;
create policy tenant_isolation on bautizos
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table defunciones enable row level security;
alter table defunciones force row level security;
create policy tenant_isolation on defunciones
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table presentaciones enable row level security;
alter table presentaciones force row level security;
create policy tenant_isolation on presentaciones
  using ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()))
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

-- ==========================================================================
-- Casos especiales: "iglesiaId" nullable + necesitan resolver un bootstrap
-- por "id"/"usuarioId" propio antes de que el guard conozca la iglesia.
-- ==========================================================================

alter table usuarios enable row level security;
alter table usuarios force row level security;
create policy tenant_isolation on usuarios
  using (
    "iglesiaId" = (select app_iglesia_id())
    or "id" = (select app_usuario_id())
    or (select app_is_privileged())
  )
  with check ("iglesiaId" = (select app_iglesia_id()) or (select app_is_privileged()));

alter table sesiones_actividad enable row level security;
alter table sesiones_actividad force row level security;
create policy tenant_isolation on sesiones_actividad
  using (
    "iglesiaId" = (select app_iglesia_id())
    or "usuarioId" = (select app_usuario_id())
    or (select app_is_privileged())
  )
  with check (
    "iglesiaId" = (select app_iglesia_id())
    or "usuarioId" = (select app_usuario_id())
    or (select app_is_privileged())
  );

-- ==========================================================================
-- Sin columna "iglesiaId" propia: scoped indirecto vía eventos."iglesiaId".
-- ==========================================================================

alter table predicadores enable row level security;
alter table predicadores force row level security;
create policy tenant_isolation on predicadores
  using (
    (select app_is_privileged())
    or exists (
      select 1 from eventos e
      where e."id" = predicadores."eventoId" and e."iglesiaId" = (select app_iglesia_id())
    )
  )
  with check (
    (select app_is_privileged())
    or exists (
      select 1 from eventos e
      where e."id" = predicadores."eventoId" and e."iglesiaId" = (select app_iglesia_id())
    )
  );

alter table asistencias_evento enable row level security;
alter table asistencias_evento force row level security;
create policy tenant_isolation on asistencias_evento
  using (
    (select app_is_privileged())
    or exists (
      select 1 from eventos e
      where e."id" = asistencias_evento."eventoId" and e."iglesiaId" = (select app_iglesia_id())
    )
  )
  with check (
    (select app_is_privileged())
    or exists (
      select 1 from eventos e
      where e."id" = asistencias_evento."eventoId" and e."iglesiaId" = (select app_iglesia_id())
    )
  );

-- ==========================================================================
-- Fuera de alcance a propósito: refresh_tokens (tabla ya no usada tras el
-- cutover de Fase 7, pendiente de DROP aparte — ver docs/supabase-todo.md).
-- ==========================================================================
