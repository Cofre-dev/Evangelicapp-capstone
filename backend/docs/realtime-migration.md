# Migración: socket.io propio → Supabase Realtime (Broadcast)

Plan y estado de la migración del tiempo real. Mismo criterio de bitácora que
`FEATURES.md`/`docs/supabase-todo.md`: se actualiza cada vez que avanza algo.

> **Contexto de la decisión.** La Fase 5 de `docs/supabase.md` (2026-08-13) montó
> un WebSocket propio en el backend (socket.io + `@nestjs/websockets`) en vez de
> Supabase Realtime nativo, porque el aislamiento multi-tenant de `postgres_changes`
> dependía de RLS y RLS todavía no existía. RLS ya está implementada (Fase 8,
> 2026-08-20). El fundador pidió (2026-09-07) sacar socket.io y no mantener un
> servicio stateful propio pudiendo usar Realtime, que ya viene con el plan Pro.

## Qué mueve esto

Tres pantallas "en vivo", con un solo evento cada una:

| Pantalla | Evento | Destino | Se dispara desde |
|---|---|---|---|
| Dashboard SuperAdmin (`/superadmin`, `/superadmin/iglesias`) | `iglesia:actualizada` | topic `superadmin` | `IglesiasService` (`marcarPagada`/`ocultar`/`mostrar`/`actualizarFacturacion`) |
| Evento del Pastor (`agenda/evento-dialog`) | `predicador:respondio` | topic `tenant:{iglesiaId}` | `PredicadoresService#responder` (ruta pública por token) |
| Censo en vivo (`integrantes/qr-dialog`) | `integrante:registrado` | topic `tenant:{iglesiaId}` | `IntegrantesService#registrar` (ruta pública por QR) |

Los payloads son DTOs ya curados (no filas crudas). El backend es el único
emisor; los clientes solo escuchan.

## Decisiones (confirmadas con el fundador, 2026-09-07)

1. **Primitiva: Broadcast, no Postgres Changes.** Los payloads ya vienen armados
   por el backend y 2 de 3 eventos salen de rutas públicas sin identidad.
   Broadcast deja el control de forma y destino del mensaje en el servidor, igual
   que hoy. Postgres Changes obligaría a reformar payloads, exponer columnas y
   depender de RLS de tablas afinada para el caso de lectura.

2. **Autorización del WebSocket del navegador: token corto emitido por el backend.**
   - El `access_token` de la sesión **no sirve**: lo emite el proyecto
     `Backend-auth-test` (`grcywqjcqwpbuekqbupj`), distinto del proyecto donde
     corren BD y Realtime (`Backend`, `lkcgiqmgdefhxhckedga`). Un JWT del proyecto
     A no lo acepta Realtime del proyecto B. Además vive en cookie `httpOnly`: el
     JS no lo puede leer.
   - `GET /realtime/token` (autenticado con la cookie actual) devuelve un JWT
     HS256 de ~30 min firmado con el **JWT secret del proyecto `Backend`**, con
     `role: authenticated` y los claims `iglesia_id` / `is_superadmin`. El
     frontend lo tiene en memoria (no cookie), hace `realtime.setAuth()`, abre su
     canal privado y re-pide otro antes de que expire.
   - Exposición aceptada: un XSS podría leer ese token y escuchar los eventos de
     **su propio** tenant por ≤30 min (nombres, estado de RSVP — sensibilidad
     baja). **No** puede leer datos de negocio por PostgREST (esas policies van
     por `current_setting('app.*')`, que PostgREST nunca setea) ni emitir (no hay
     policy de `INSERT` para `authenticated`).

3. **Corte: parallel-run y después limpiar.** El backend emite por socket.io **y**
   por Supabase Broadcast a la vez. Se migran los 4 consumidores del frontend. Se
   verifica en `Backend-staging`. Recién ahí se borra la mitad de socket.io
   (gateway + deps) en un PR de limpieza.

### Reversa explícita de una decisión documentada

Hasta hoy: "el navegador nunca corre `supabase-js` ni le habla a Supabase
directamente" (`README.md`, sección Auth). Con Supabase Realtime **el navegador
sí abre un WebSocket directo a Supabase** — no hay forma de evitarlo con Realtime
nativo. El frontend suma `@supabase/supabase-js`, pero **solo para Realtime**: la
API REST de negocio se sigue consumiendo igual que hoy (cookies httpOnly contra
este backend, nada de `supabase-js` para datos).

## Arquitectura destino

```
Ruta de negocio (marcar pagada / responder / registrar)
        │
        ▼
RealtimeService  ── emitAIglesia / emitASuperAdmin
        │
        ├─(parallel-run, legacy)→ socket.io Server → rooms superadmin / iglesia:{id}
        │
        └→ RealtimeBroadcastService
                POST https://<ref>.supabase.co/realtime/v1/api/broadcast
                headers: apikey + Authorization: Bearer  (service_role)
                body: { messages: [{ topic, event, payload, private: true }] }
                        │
                        ▼
              Supabase Realtime  ──WebSocket──▶  navegador (supabase-js)
                        ▲                         canal .channel(topic,{config:{private:true}})
                        │                         .on('broadcast', {event}, cb)
             RLS en realtime.messages (SELECT)
             chequeada al channel-join con el
             JWT de GET /realtime/token
```

### Topics

| Topic | Quién recibe | Token de |
|---|---|---|
| `superadmin` | JWT con claim `is_superadmin = true` | `GET /realtime/token` (sesión) |
| `tenant:{iglesiaId}` | JWT con claim `iglesia_id = {iglesiaId}` | `GET /realtime/token` (sesión) |
| `convocatoria:{eventoId}` | JWT con claim `evento_id = {eventoId}` (sin `iglesia_id`) | `GET /agenda/convocatoria/:token/realtime` (público, `:token` = tokenConfirmacion del destinatario) |

Un usuario de sesión abre **un** canal (`tenant:` o `superadmin`). La página
pública de estado de convocatoria (link del correo) abre `convocatoria:{eventoId}`
con su propio token, sin cuenta.

### Policy RLS (`realtime.messages`)

Dos policies permissive (se combinan con OR), solo `SELECT` para `authenticated`,
sin `INSERT` (el backend emite por REST con `service_role`, exento de RLS):
- `20260907131802_realtime_broadcast_authorization` — topics `superadmin` /
  `tenant:{id}` contra los claims `is_superadmin` / `iglesia_id`.
- `20260908204221_realtime_convocatoria_topic` — topic `convocatoria:{eventoId}`
  contra el claim `evento_id` (que solo lleva el token público de convocatoria).

## Piezas del backend (ya implementadas — parallel-run)

| Archivo | Qué |
|---|---|
| `src/modules/realtime/realtime-broadcast.service.ts` | POST al endpoint REST de broadcast con `service_role`. Best-effort (no lanza). Escotilla `REALTIME_BROADCAST_ENABLED`. |
| `src/modules/realtime/realtime-token.service.ts` | Firma el JWT HS256 de corta duración (`jose`), resuelve el topic según rol/iglesiaId del JWT de sesión. |
| `src/modules/realtime/realtime-token.controller.ts` | `GET /realtime/token` (solo `JwtAuthGuard`, `@Throttle` 30/min). |
| `src/modules/realtime/realtime.service.ts` | Ahora hace fan-out a socket.io **y** a `RealtimeBroadcastService`. Las 3 services de negocio no cambian. |
| `src/modules/realtime/realtime-rooms.util.ts` | Suma `SUPERADMIN_TOPIC` / `tenantTopic()` junto a las rooms legacy. |
| `prisma/migrations/20260907131802_realtime_broadcast_authorization/` | Policy RLS en `realtime.messages`. **Aplicada a `Backend-staging` (2026-09-08); prod pendiente.** |
| `.env.example` | `SUPABASE_JWT_ACCESS_SECRET`, `REALTIME_TOKEN_TTL_SECONDS`, `REALTIME_BROADCAST_ENABLED`. |

Nada de socket.io se removió todavía.

## Pendiente

### Backend / infra

- [x] **Migración de RLS aplicada a `Backend-staging`** (`woerftoeqarupnrggupl`) por
      MCP el 2026-09-08. La policy se probó con 9 casos simulados (superadmin y
      tenant, topic propio / ajeno / vacío / claim ausente) — todos correctos.
      Verificado: `realtime.messages` tiene RLS activa y `authenticated` con
      `SELECT`. **En staging quedó como 2 migraciones** (`realtime_broadcast_authorization`
      + `..._harden_tenant_claim`); el archivo Prisma
      `20260907131802_realtime_broadcast_authorization/migration.sql` ya tiene la
      versión endurecida en un solo `CREATE POLICY` — es lo que se aplica a `Backend`.
      También se insertó la fila de reconciliación en `_prisma_migrations` de
      `Backend-staging` (equivale a `prisma migrate resolve --applied`), checksum
      `5079323e...`.
- [x] **"Allow public access" desactivado en `Backend-staging`** (dashboard, el
      fundador, 2026-09-08). Falta hacerlo en `Backend` (prod).
- [x] **Env var en Render staging**: `SUPABASE_JWT_ACCESS_SECRET` = "Legacy JWT
      secret" de `Backend-staging` (el fundador, 2026-09-08). Confirmado que
      `SUPABASE_URL` del servicio Render `Evangelicapp-backend`
      (`srv-da700lq6iojc7380qmjg`, rama `staging`) apunta a `Backend-staging`
      (los `logoUrl`/`fotoUrl` de la sesión salen de `woerftoeqarupnrggupl`).
      Nota: ese servicio **no** corre `prisma migrate deploy` (buildCommand =
      `npm install && npx prisma generate && npm run build`) — las migraciones a
      staging se aplican a mano por MCP.
- [x] **Smoke test end-to-end en staging — PASA (2026-09-08).**
  - `GET /realtime/token` en el backend desplegado → `{ token, topic:
    "tenant:<iglesiaId>", expiresInSeconds: 1800 }`; JWT con `role: authenticated`,
    `iglesia_id`, `is_superadmin: false`, HS256.
  - Cliente `supabase-js` con ese token → `SUBSCRIBED` al canal privado
    `tenant:<iglesiaId>` (la RLS de `realtime.messages` lo deja pasar).
  - Registro real por QR público → `IntegrantesService#registrar` →
    `RealtimeBroadcastService` (service_role) → **el cliente recibe
    `integrante:registrado` con el payload correcto**.
  - Negativo: el mismo token intentando unirse a `tenant:<otro>` →
    `CHANNEL_ERROR "Unauthorized: You do not have permissions to read from this
    Channel topic"`. Aislamiento multi-tenant confirmado también para Realtime.
  - `iglesia:actualizada` (topic `superadmin`) no se probó en vivo por falta de
    sesión SuperAdmin, pero usa el mismo `publish()` y la rama `superadmin` de la
    policy quedó cubierta por los 9 casos SQL.
  - **Verificado además en el navegador** por el fundador (2026-09-08) contra el
    frontend de staging en Cloudflare: el censo en vivo se actualiza en directo
    al registrarse un integrante por QR.
- [ ] **Aplicar la migración a `Backend`** (`lkcgiqmgdefhxhckedga`, prod) por MCP +
      desactivar "Allow public access" ahí + `SUPABASE_JWT_ACCESS_SECRET` en el
      Render de prod. Cuando el frontend de prod despliegue con Realtime.

### Frontend (ver `prompt.md`)

- [ ] Agregar `@supabase/supabase-js`, quitar `socket.io-client`.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (proyecto `Backend`).
- [ ] Reemplazar `use-socket.ts` por `use-realtime.ts` (token + `setAuth` + canal
      privado + refresh antes de expirar + reconexión tras refresh de sesión).
- [ ] Migrar los 4 consumidores (`superadmin/page`, `superadmin/iglesias/page`,
      `agenda/evento-dialog`, `integrantes/qr-dialog`) — la forma de los payloads
      y los nombres de evento no cambian.

### Limpieza (PR aparte, después de verificar en staging)

- [ ] Borrar `realtime.gateway.ts`, quitar `RealtimeGateway` del módulo.
- [ ] `npm rm socket.io @nestjs/websockets @nestjs/platform-socket.io` (backend).
- [ ] `RealtimeService` se queda solo con `broadcast`; quitar `setServer`/`Server`.
- [ ] Quitar `resolveCorsOrigins()` del gateway si no lo usa nada más (lo usa
      `main.ts`, así que el util se queda).
- [ ] `REALTIME_BROADCAST_ENABLED` deja de tener sentido (ya no hay con qué
      compararlo) — se puede quitar o dejar como kill-switch.
- [ ] Actualizar `README.md` (tabla de módulos, fila `realtime`), `docs/supabase.md`
      (nota de la Fase 5) y `FEATURES.md`.

## Riesgos / notas

- **`SUPABASE_JWT_ACCESS_SECRET` disponible.** El proyecto `Backend` todavía
  emite anon keys legacy HS256 (verificado 2026-09-07), o sea tiene un JWT secret
  simétrico (el "Legacy JWT secret") utilizable para firmar — el fundador lo
  configuró el 2026-09-08. Si en algún momento se migra a signing keys solo
  asimétricas y se revoca el secret legacy, hay que repensar el minteo (firmar
  asimétrico con un keypair propio agregado a Supabase, o consolidar Auth en el
  proyecto `Backend`).
- **Independiente de `DATABASE_URL`→`app_runtime`.** La policy de `realtime.messages`
  la evalúa el servicio de Realtime con su propia conexión — no depende de que la
  API conecte como `app_runtime` en vez de `postgres`. Esta migración puede ir
  antes que ese pendiente.
- **El token dura ≤30 min tras suspender una iglesia.** Igual que la limitación ya
  documentada del gateway ("un socket abierto no se corta a mitad"), pero más
  corto. `GET /realtime/token` sí revalida `iglesia.estado` en cada llamada (vía
  `JwtAuthGuard`), así que no se renueva.
- **`Backend-auth-test` está pausado** (tope de 2 proyectos activos del plan free).
  No afecta esta migración —el token de Realtime lo firma el backend con el secret
  de `Backend`, no se toca Auth— pero si el login real se rehabilita con un
  proyecto de Auth distinto, `iglesia_id`/`is_superadmin` los pone el backend a
  mano en el token, no salen del `access_token`, así que sigue funcionando igual.
- **Rollback**: `REALTIME_BROADCAST_ENABLED=false` en Render apaga el emit por
  Supabase sin redeploy. Mientras el frontend no haya migrado, socket.io sigue
  siendo el transporte real y esto no tiene efecto en usuarios.
- **Particiones de `realtime.messages` (`MissingPartition`).** `realtime.messages`
  está particionada por día (`RANGE (inserted_at)`). En el primer intento de
  conexión en staging el join falló con `MissingPartition: Realtime was unable to
  find the expected messages partition` y funcionó al reintentar — el servicio de
  Realtime crea las particiones on-demand / al despertar y se auto-corrige.
  `Backend-staging` tiene particiones 2026-09-07 → 2026-09-11; **`Backend` (prod)
  tiene 0** al 2026-09-08 — se van a crear solas cuando Realtime se active ahí
  (primera conexión tras aplicar la policy). `pg_cron` no está instalado en
  ninguno de los dos, así que las particiones las mantiene el propio servicio de
  Realtime, no un cron SQL — **vigilar que siempre haya unos días de particiones
  hacia adelante**; si se agotan, los broadcasts fallan con `MissingPartition`
  hasta que se creen (a mano: `create table realtime.messages_YYYY_MM_DD partition
  of realtime.messages for values from ('YYYY-MM-DD') to ('YYYY-MM-DD'+1)`).
