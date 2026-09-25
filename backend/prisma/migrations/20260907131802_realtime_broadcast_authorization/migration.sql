-- Migración a Supabase Realtime — autorización de Broadcast (ver docs/realtime-migration.md).
--
-- Gobierna QUIÉN puede RECIBIR mensajes de broadcast en cada topic. El servicio
-- de Realtime evalúa esta policy al momento del channel-join, contra los claims
-- del JWT de corta duración que emite RealtimeTokenService (GET /realtime/token):
--   - role: authenticated
--   - iglesia_id: <cuid> | null
--   - is_superadmin: boolean
--
-- NO se crea policy de INSERT para `authenticated`: los clientes solo escuchan.
-- El backend emite vía el endpoint REST /realtime/v1/api/broadcast con la
-- service_role key, que está exenta de RLS (ver RealtimeBroadcastService).
--
-- Independiente del pendiente DATABASE_URL→app_runtime (docs/supabase-todo.md):
-- esta policy la corre el servicio de Realtime con su propia conexión y su
-- propio rol, no el cliente Prisma de la API.
--
-- Cómo aplicar (este entorno no tiene conectividad directa a la base — P1001):
--   1. Revisar este SQL.
--   2. Aplicar por MCP de Supabase (execute_sql / apply_migration) a
--      `Backend-staging` primero, luego a `Backend`, igual que la migración de
--      RLS (20260820181542). En `Backend` también revisar en el dashboard
--      (Realtime > Settings) que "Allow public access" quede DESACTIVADO, para
--      que solo se acepten canales privados.
--   3. `prisma migrate resolve --applied 20260907131802_realtime_broadcast_authorization`
--      la próxima vez que alguien tenga conectividad directa, para reconciliar
--      `_prisma_migrations`.

create policy "realtime: tenant recibe su propio topic"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (
        (select realtime.topic()) = 'superadmin'
        and coalesce(
          ((current_setting('request.jwt.claims', true))::jsonb ->> 'is_superadmin')::boolean,
          false
        )
      )
      or (
        -- El claim iglesia_id tiene que existir y no estar vacío: sin este guard,
        -- un token sin iglesia_id matchearía el topic literal 'tenant:'.
        coalesce((current_setting('request.jwt.claims', true))::jsonb ->> 'iglesia_id', '') <> ''
        and (select realtime.topic())
            = 'tenant:' || ((current_setting('request.jwt.claims', true))::jsonb ->> 'iglesia_id')
      )
    )
  );

comment on policy "realtime: tenant recibe su propio topic" on realtime.messages is
  'docs/realtime-migration.md: un cliente solo recibe broadcasts del topic de SU iglesia (tenant:<iglesiaId> del claim) o de superadmin si el claim is_superadmin es true. Sin policy de INSERT: los clientes no emiten, solo el backend por REST con service_role.';
