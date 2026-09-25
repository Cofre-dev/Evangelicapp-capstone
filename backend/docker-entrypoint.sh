#!/bin/sh
# Arranque del contenedor: aplica migraciones de Prisma y recién ahí levanta la API.
#
# 3 migraciones (20260907131802, 20260908204221, 20260909223000) fueron escritas para
# Supabase y tocan objetos que solo existen ahí (schema "realtime", roles "anon" /
# "authenticated" / "app_runtime") — nunca se aplicaron vía `prisma migrate deploy`, se
# aplicaron a mano por MCP de Supabase (ver el comentario de cada migration.sql). Contra
# un Postgres vanilla (como el de este docker-compose) fallan siempre, por diseño: no es
# un bug de este Dockerfile, es una limitación conocida del repo (ver "Pendientes
# conocidos" en backend/README.md). Acá se resuelven como aplicadas (sin ejecutar su SQL,
# igual que se hizo contra los proyectos reales) para que el resto de las migraciones
# — y por lo tanto la API — puedan arrancar en un Postgres local limpio.
set -e

SUPABASE_ONLY_MIGRATIONS="20260907131802_realtime_broadcast_authorization 20260908204221_realtime_convocatoria_topic 20260909223000_lockdown_internal_public_tables"

if ! npx prisma migrate deploy; then
  echo ">> prisma migrate deploy falló — probablemente en una migración exclusiva de Supabase (schema realtime / roles anon-authenticated-app_runtime, ausentes en un Postgres local)."
  echo ">> Resolviendo esas migraciones puntuales como aplicadas (sin ejecutar su SQL) y reintentando..."
  for m in $SUPABASE_ONLY_MIGRATIONS; do
    npx prisma migrate resolve --applied "$m" || true
  done
  npx prisma migrate deploy
fi

exec node dist/main
