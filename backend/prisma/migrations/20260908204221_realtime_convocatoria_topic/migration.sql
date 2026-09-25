-- Autorización de Realtime para el topic PÚBLICO de estado de convocatoria de un
-- evento (`convocatoria:<eventoId>`). Ver docs/realtime-migration.md,
-- RealtimeTokenService#mintForConvocatoria y ConvocatoriaService.
--
-- Política aparte de "realtime: tenant recibe su propio topic" (las policies
-- permissive se combinan con OR): el token de convocatoria lleva el claim
-- `evento_id` y NO lleva `iglesia_id`/`is_superadmin`, así que no se pisa con la
-- del tenant. Sin policy de INSERT: los clientes solo escuchan; el backend emite
-- por REST con service_role.
--
-- Se aplica por MCP a `Backend-staging` (y a `Backend` cuando corresponda),
-- igual que las otras migraciones de RLS.

create policy "realtime: estado de convocatoria por token"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and coalesce((current_setting('request.jwt.claims', true))::jsonb ->> 'evento_id', '') <> ''
    and (select realtime.topic())
        = 'convocatoria:' || ((current_setting('request.jwt.claims', true))::jsonb ->> 'evento_id')
  );

comment on policy "realtime: estado de convocatoria por token" on realtime.messages is
  'docs/realtime-migration.md: un cliente con un token de convocatoria (claim evento_id, sin iglesia_id) solo recibe broadcasts del topic convocatoria:<eventoId> de ESE evento. Para la página pública a la que se llega desde el link del correo de invitación.';
