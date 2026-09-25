# Plan: aprovechar el plan Supabase Pro (Auth, Storage, Realtime, Edge Functions)

**Para el estado actual (qué está hecho, qué falta, qué sigue) ver
[`docs/supabase-todo.md`](./supabase-todo.md) — checklist corto, se actualiza seguido. Lo que
sigue acá abajo es el plan técnico original, con notas de "Actualización" agregadas inline a
medida que cada fase se ejecutó; describe el estado de CADA fase en el momento en que se escribió
esa nota, no necesariamente el estado de hoy.**

Hoy Supabase se usa solo como host de Postgres (confirmado: no hay `@supabase/*` en `package.json` ni referencias a Supabase en `backend/src`) — *nota: esto describía el punto de partida cuando se escribió este documento; ya no es cierto, ver arriba.* Este documento evalúa activar las otras cuatro piezas del plan Pro ($25/mes) para que ese pago se justifique, con impacto en el usuario, pasos técnicos, riesgo y dependencias de cada una — sin escribir código todavía.

**Nota de estado (2026-08-14):** ver "Estado actual: pre-lanzamiento" en `CLAUDE.md` — hoy no hay ninguna iglesia real usando la plataforma, todo lo que hay es data de demo/seed. Las menciones a "iglesias reales"/"usuarios reales" de este documento describen el estándar de cuidado con el que se trabaja (pensando en el lanzamiento nacional), no una situación de riesgo actual con clientes activos.

## Bloqueadores antes de ejecutar cualquier ítem

1. ~~**MCP de Supabase sin autenticar.**~~ Resuelto el 2026-08-09 (ver memoria `supabase-mcp-pending-auth`) — el login OAuth ya se completó.
2. ~~**Proyecto de Supabase pausado.**~~ Resuelto — confirmado `ACTIVE_HEALTHY` de nuevo desde el 2026-08-13.
3. **Pasarela de pago sin definir.** `CLAUDE.md` marca el modelo de negocio como pendiente — bloquea específicamente el ítem de Webhook más abajo.
4. **Alcance de este repo.** Este repo es solo backend; el frontend vive aparte. Los ítems de Realtime requieren trabajo en el repo de frontend, al que solo tengo acceso a `frontend/src/app/agenda/asistencia` — para el resto necesito coordinación contigo o acceso más amplio.

## Cómo se va a ejecutar esto

No voy a implementar los 10 ítems en una sola pasada al terminar este documento. Voy a ir fase por fase (ver secuencia abajo) y pedir tu OK explícito antes de cada una — en particular antes de **Auth** y **RLS**, que tocan el sistema de login/sesión y el aislamiento multi-tenant de un sistema con datos financieros reales de iglesias. Cada fase que implique cambios de esquema o de datos existentes queda registrada en `FEATURES.md` al cerrarla, como pide `CLAUDE.md`.

## Secuencia recomendada

Ordenada de menor a mayor riesgo/esfuerzo, respetando dependencias reales entre ítems:

| # | Fase | Complejidad | Riesgo | Depende de |
|---|------|-------------|--------|------------|
| 1 | Storage (logos/fotos) | M | Bajo | — |
| 2 | Resize/optimización de imagen | S | Bajo | Fase 1 (mismo punto de subida) |
| 3 | Caché de PDFs de certificados | S-M | Bajo | Fase 1 (bucket ya creado) |
| 4 | Cron de recordatorios | S-M | Bajo | Regla de negocio a definir (¿cuántos días antes avisar? - Avisar con una semana de anticipación) |
| 5 | Realtime (3 pantallas) | M c/u | Medio | Coordinación con repo de frontend; idealmente Fase 7 (RLS) ya activa |
| 6 | Webhook de pagos | — | — | **Bloqueado**: sin pasarela elegida |
| 7 | Auth (Supabase Auth reemplaza JWT/bcrypt propio) | XL | Alto | — |
| 8 | RLS (depende de que el JWT traiga `iglesia_id`) | L-XL | Alto | Fase 7 |

Storage va primero porque el propio código ya lo anticipa — `logo-upload.config.ts` dice explícitamente *"Suficiente mientras no haya un bucket (S3/Cloud Storage) configurado"* — y resuelve un riesgo real (disco efímero en la mayoría de hosting: un redeploy en Railway/Render borra `uploads/`). Auth y RLS van al final porque son la reescritura más grande y de más riesgo del proyecto, y RLS no tiene sentido sin que Auth ya esté migrado (RLS necesita leer `iglesia_id` desde el JWT de Supabase, no desde el JWT propio actual).

---
## Fase 1 — Storage: `Iglesia.logoUrl`, `Usuario.fotoUrl`, `Integrante.fotoUrl`

**Qué es:** mover los archivos que hoy se guardan en disco local (`backend/uploads/`) a Supabase Storage.

**Impacto en el usuario:** ninguno visible en el día a día — el cambio es que el logo de la iglesia y las fotos de perfil/integrantes dejan de desaparecer cuando el servidor se reinicia o redeploya.

**Paso a paso:**
1. Crear buckets en Supabase Storage (ej. `logos-iglesias`, `fotos-perfil`, `fotos-integrantes`, o uno solo con carpetas).
2. Definir políticas de acceso: los logos deben ser de lectura pública (se muestran en certificados PDF y en correos de convocatoria a eventos); decidir si las fotos de perfil/integrante van públicas o con URL firmada (afecta privacidad de datos personales del censo).
3. Reemplazar el `diskStorage` de multer por `memoryStorage()` + subida al bucket vía `supabase-js` en los 3 puntos de entrada: `modules/iglesias/logo-upload.config.ts`, `modules/auth/foto-perfil-upload.config.ts`, `modules/integrantes/foto-upload.config.ts`.
4. `logoUrl`/`fotoUrl` siguen siendo `String` en el schema (no cambia el tipo) — solo cambia el valor guardado, de ruta relativa (`/uploads/logos/xxx.png`) a URL del bucket.
5. Actualizar `certificado-pdf.builder.ts#resolverLogoPath`: hoy lee el logo con `fs.existsSync`/ruta absoluta en disco; tiene que pasar a descargar el archivo del bucket a un `Buffer` antes de dárselo a `pdfkit`.
6. Quitar `app.useStaticAssets(... 'uploads' ...)` de `main.ts` una vez migrado.
7. Migrar los archivos ya existentes en `backend/uploads/` al bucket y actualizar las filas correspondientes con la nueva URL.
8. Avisar al equipo de frontend si construye URLs de imagen asumiendo el prefijo `/uploads/`.

---

## Fase 2 — Resize/optimización de imagen al subir

**Qué es:** comprimir/redimensionar logos y fotos antes de guardarlos.

**Impacto en el usuario:** subidas y cargas de imagen más rápidas.

**Paso a paso:**
1. Puede hacerse con una librería (`sharp`) directo en los mismos `*-upload.config.ts` de la Fase 1, antes de subir al bucket — **no depende de Supabase específicamente**, funcionaría igual con el storage local actual.
2. Definir tamaños objetivo (ej. logos 512×512, fotos 256×256).

Nota: si se quiere hacer vía Supabase (Storage transform / Edge Function on-upload) en vez de en el backend, es más trabajo por poco beneficio adicional — recomiendo `sharp` en el backend.

---

## Fase 3 — Caché de PDFs de certificados

**Qué es:** los certificados de `Matrimonio`/`Bautizo`/`Defuncion`/`Presentacion` se generan al vuelo con `pdfkit` (`certificado-pdf.builder.ts`) en cada descarga. Cachear el PDF generado en el bucket la primera vez.

**Impacto en el usuario:** descargas más rápidas después de la primera vez; nada cambia visualmente.

**Paso a paso:**
1. Bucket `certificados-ceremonias`.
2. En cada controller (`bautizos.controller.ts`, `defunciones.controller.ts`, `matrimonios.controller.ts`, `presentaciones.controller.ts`), antes de generar, chequear si ya existe un PDF cacheado con una key basada en `id` + `updatedAt` (para invalidar solo si el registro se edita).
3. Si no existe: generar como hoy, subir el buffer, servir.
4. Si existe: descargar y servir directo del bucket.
5. Invalidar el caché también si cambia el logo de la iglesia (el certificado lo embebe).

---

## Fase 4 — Cron de recordatorios

**Qué es:** función programada (pg_cron o Scheduled Functions de Supabase) que dispara correos automáticos vía el `MailModule`/Resend existente, para:
- Iglesias con `proximaFacturacion` próxima a vencer (hoy el semáforo de `calcularEstadoFacturacion` solo se calcula on-demand cuando el SuperAdmin mira el dashboard — no hay aviso proactivo).
- Integrantes con un evento próximo.

**Paso a paso:**
1. Definir la regla de negocio: ¿cuántos días antes avisar? (hoy existe `DIAS_GRACIA_MORA` para el lado de mora — esto sería el aviso preventivo, antes de vencer).
2. Escribir el Edge Function (Deno) que reutiliza la lógica de envío existente (exponer un endpoint interno protegido, o reimplementar el envío en el propio Edge Function).
3. Programar con `pg_cron` o el scheduler de Supabase.

---

## Fase 5 — Realtime (3 pantallas)

**Qué es:** Supabase Realtime (websockets sobre replicación lógica de Postgres) para reemplazar polling/refresh manual en tres pantallas:

1. **Dashboard SuperAdmin** — se actualiza solo cuando cambia `EstadoIglesia` o `proximaFacturacion` de alguna iglesia.
2. **Pantalla de evento del Pastor** — notificación en vivo cuando un `Predicador` confirma/rechaza (`EstadoConfirmacionPredicador`), sin refrescar.
3. **Censo en vivo** — ver entrar gente a `Integrante` en tiempo real mientras la gente escanea el QR durante un evento.

**Impacto en el usuario:** las tres pantallas se sienten "vivas" sin que el usuario tenga que refrescar.

**Paso a paso (compartido):**
1. Habilitar replication/Realtime en las tablas relevantes (`iglesias`, `predicadores`, `integrantes`).
2. Definir el canal/filtro por `iglesiaId` — **crítico para no romper el aislamiento multi-tenant**: si el filtro se aplica solo del lado del cliente, cualquiera podría suscribirse a eventos de otra iglesia. Realtime respeta RLS si está activo; sin RLS (Fase 8 todavía no hecha), hay que verificar del lado servidor que el canal esté realmente scoped a la iglesia del usuario antes de prender esto para iglesias que no sean de prueba.
3. Trabajo de frontend (repo aparte, Next.js): suscripción con `supabase-js` (`.channel(...).on('postgres_changes', ...)`) en cada pantalla — **fuera del alcance de este repo backend**. Necesito coordinar contigo o acceso al resto del repo de frontend (hoy solo tengo `agenda/asistencia`).

**Recomendación:** no activar Supabase Realtime nativo (`postgres_changes`) para ninguna iglesia hasta que la Fase 8 (RLS) esté lista — es la única forma de tener una garantía real, no solo "el frontend filtra bien", de que una iglesia no reciba eventos de otra. **Actualización (Fase 5 ejecutada, 2026-08-13):** se optó por un WebSocket propio en el backend en vez de Supabase Realtime nativo, precisamente para no depender de RLS — ver entrada correspondiente en `FEATURES.md`. Esta recomendación queda como registro de por qué se tomó ese camino, no como algo pendiente.

---

## Fase 6 — Webhook receptor de pagos (bloqueado)

**Qué es:** Edge Function que recibe notificaciones de una pasarela de pago (Webpay/Transbank, Flow, Mercado Pago, etc.) para marcar `proximaFacturacion`/`ultimoPagoAt` automáticamente en vez del proceso manual actual (`IglesiasService#marcarPagada`).

**Por qué está bloqueado:** `CLAUDE.md` marca explícitamente el modelo de negocio (quién paga, con qué pasarela) como pendiente de definir con el fundador. Construir el receptor de webhooks de un proveedor que todavía no se eligió es trabajo especulativo — el contrato del webhook (firma, payload, eventos) cambia completamente según el proveedor. Lo dejo documentado para no perder la idea, pero no lo empezaría hasta que se decida la pasarela.

---

## Fase 7 — Auth: reemplazar JWT/bcrypt propio por Supabase Auth

**Qué es:** el sistema actual (`auth.service.ts`, `jwt.strategy.ts`, `jwt-refresh.strategy.ts`, `local.strategy.ts`) es JWT propio + bcrypt + rotación de refresh tokens con detección de reuso + cookies httpOnly + CSRF double-submit — no un login genérico. Reemplazarlo por Supabase Auth (GoTrue) implica migrar toda esa lógica.

**Impacto en el usuario:** si se hace bien, invisible — Pastor/Tesorero/Secretaria siguen logueando igual (o se suma magic link como opción). Si se hace mal, puede romper: sesiones activas, el bloqueo forzado por `mustChangePassword`, o el corte de acceso inmediato cuando una iglesia entra en mora (`SUSPENDIDA`).

**Por qué es la fase de mayor riesgo:** el `JwtStrategy.validate()` actual no es solo "verificar el JWT" — revalida en cada request que el usuario siga `activo`, que la iglesia no esté `SUSPENDIDA` (corta sesiones activas al instante si se oculta a mitad de camino), y bloquea todo endpoint fuera de una allowlist mientras `mustChangePassword` sea `true`. Nada de esto lo da Supabase Auth de fábrica — hay que reconstruirlo encima.

**Paso a paso:**
1. Decidir el mapeo `Usuario` (tabla propia) ↔ `auth.users` (tabla de Supabase): ¿login por email en vez de `username`? ¿`username`/`rol`/`iglesiaId` como `user_metadata`/`app_metadata`?
2. Migración de usuarios existentes: Supabase Auth no acepta importar un hash bcrypt directamente — decidir entre reset forzado de contraseña para todos, o convivencia temporal de ambos sistemas durante la transición.
3. Reemplazar `LocalStrategy`/`JwtStrategy` por validación del JWT de Supabase.
4. Reimplementar como guard propio, corriendo después de validar el JWT de Supabase, las tres validaciones per-request que hoy viven en `JwtStrategy.validate()`: `activo`, `iglesia.estado === SUSPENDIDA`, allowlist de `mustChangePassword`.
5. Decidir qué pasa con los módulos delegados (`AccesoModulo`) que hoy viajan como claim en el JWT propio: usar un Custom Access Token Hook (Edge Function) para inyectarlos, o seguir consultándolos en cada request como ya hace `getModulosOtorgados`.
6. Confirmar que Supabase Auth ofrece una garantía equivalente a la rotación + detección de reuso de refresh tokens que hay hoy (`AuthService#refreshTokens`), o aceptar conscientemente el cambio de comportamiento.
7. ~~Decidir esquema de cookies/CSRF: hoy es cookie httpOnly propia + CSRF double-submit; Supabase recomienda `@supabase/ssr` para manejo de cookies, que tiene su propio patrón.~~ **Resuelto (2026-08-14): NO se adopta `@supabase/ssr`.** Su patrón recomienda cookies no-httpOnly a propósito (confirmado contra la documentación oficial: "no es necesario, el lado browser necesita acceso al refresh token de todas formas") y asume que el frontend habla directo con el servidor de Auth de Supabase — un cambio de arquitectura, no solo de cookies, que además bajaría nuestra postura de seguridad (justificada en `docs/auth-cookies.md` por manejar datos financieros/personales). Se mantiene el esquema actual completo (httpOnly + CSRF double-submit, mismos endpoints) sin cambios; lo único que cambiará es qué emite/valida el token por dentro. Ver rationale completo en `FEATURES.md`.
8. ~~Migrar el flujo de invitación de Tesorero/Secretaria (hoy el Pastor los crea con password temporal) al mecanismo de invitación de Supabase Auth.~~ **Cerrado (2026-08-14) sin código, ya estaba cubierto:** el espejo del paso 1-2 (`mirrorUsuario`) corre en cualquier login exitoso sin filtrar por rol, así que un Tesorero/Secretaria queda espejado en su primer login igual que un manager — no hacía falta nada nuevo para el objetivo técnico de la migración. Adoptar de verdad `inviteUserByEmail()` (Supabase le manda el correo directo a la persona, en vez de que el Pastor comparta la contraseña) es un cambio de UX real, no de plomería — se le planteó al fundador y se decidió dejarlo **fuera de la Fase 7**, como mejora de producto separada y opcional a evaluar más adelante. Ver rationale completo en `FEATURES.md`.
9. ~~Actualizar el frontend (repo aparte) para usar `supabase-js` en vez de `POST /auth/login` / `POST /auth/refresh` actuales.~~ **Descartado como consecuencia del punto 7:** el frontend nunca necesita `supabase-js` ni deja de hablarle a nuestra propia API — el contrato de `docs/auth-cookies.md` (endpoints, cookies, CSRF) queda igual de punta a punta, con o sin Supabase Auth por dentro.

**Recomendación:** probar de punta a punta contra un proyecto Supabase de prueba (o el mismo proyecto pero en un ambiente separado) antes de cortar el sistema actual — no migrar en caliente sin haber validado 1:1 que las tres reglas del punto 4 siguen funcionando. Aunque hoy no hay iglesias reales en riesgo (ver nota de estado al inicio del documento), vale la pena mantener esta disciplina para cuando sí las haya. **Actualización (Fase 7 en curso, 2026-08-14):** ya se creó el proyecto de prueba (`Backend-auth-test`) y se implementó/validó el mapeo de usuarios + espejo (paso 1-2), verificación de JWT de Supabase vía JWKS (paso 3), el guard propio con las 3 revalidaciones por-request (paso 4) y la resolución de módulos delegados dentro de ese mismo guard (paso 5, sin Custom Access Token Hook — ver rationale en `SupabaseJwtAuthGuard`) — ver entradas correspondientes en `FEATURES.md`. Todo esto sigue siendo infraestructura en paralelo, inerte: ningún controller usa `SupabaseJwtAuthGuard` todavía, el login real sigue siendo 100% JWT/bcrypt propio. **Paso 6 confirmado (sin código, es garantía nativa del servidor de Supabase Auth):** rotación de un solo uso + detección de reuso son comportamiento default, verificado contra la documentación oficial — con un cambio de postura consciente y aceptado (detección de reuso ahí es por sesión/dispositivo, no cierra todos los dispositivos del usuario como hoy; ver rationale completo en `FEATURES.md`). **Paso 7 decidido:** no se adopta `@supabase/ssr` — se mantiene el esquema de cookies httpOnly + CSRF double-submit propio sin cambios de contrato, y como consecuencia el paso 9 (frontend a `supabase-js`) queda descartado, el frontend nunca deja de hablarle a nuestra propia API (ver puntos 7 y 9 arriba, y rationale completo en `FEATURES.md`). **Paso 8 cerrado sin código:** el espejo del paso 1-2 ya cubre a Tesorero/Secretaria; adoptar el invite-by-email de Supabase queda fuera de la Fase 7 como mejora de producto aparte (decidido con el fundador). **Con esto, los 9 pasos originales quedan resueltos** (3-5 con infraestructura nueva, 6-8 con decisión/documentación, 9 descartado).

**Actualización final (2026-08-15/16): cutover autorizado y completado.** `POST /auth/login`/`POST /auth/refresh` reemplazaron de verdad `LocalStrategy`/`JwtStrategy` — hablan server-to-server con GoTrue. Probado de punta a punta primero en local y después contra la base de datos real de Supabase (`DATABASE_URL` migrado de Postgres local al proyecto real el 2026-08-16), incluyendo dos bugs reales encontrados y corregidos en el camino (identidad de Supabase Auth cruzada entre bases; `verifyPassword`/`changePassword` sin el mismo fallback auto-sanador que `validateUser`, y devolviendo 401 en vez de 403). Ver entradas del 2026-08-15 y 2026-08-16 en `FEATURES.md` para el detalle completo. `JwtStrategy`, `JwtRefreshStrategy`, `JwtRefreshGuard` y `SupabaseJwtAuthGuard` (este último, absorbido en `JwtAuthGuard`) ya no existen como archivos separados.

---

## Fase 8 — RLS (Row Level Security) atada al JWT de Supabase

**Qué es:** políticas a nivel Postgres que filtran filas automáticamente por `iglesiaId`, como segunda capa de defensa además del filtro que ya hace la aplicación en cada query.

**Impacto en el usuario:** ninguno visible — es defensa en profundidad. Si un bug de la aplicación alguna vez olvidara filtrar por `iglesiaId` en una query, RLS igual bloquearía la fuga entre iglesias.

**Por qué depende 100% de la Fase 7:** las policies necesitan leer `iglesia_id` desde un claim confiable del JWT (`auth.jwt() ->> 'iglesia_id'`). Sin Supabase Auth no hay ese claim disponible de forma nativa.

**Paso a paso:**
1. Agregar `iglesia_id` como custom claim vía Custom Access Token Hook (mismo mecanismo que en Fase 7, punto 5).
2. Escribir policies para cada uno de los 14 modelos con `iglesiaId` (`usuarios`, `eventos`, `movimientos_financieros`, `integrantes`, etc.) — ej. `CREATE POLICY ... USING (iglesia_id = (auth.jwt() ->> 'iglesia_id'))`.
3. **Caveat técnico importante:** Prisma no abre conexiones "como el usuario autenticado" — usa su propio rol/connection string. RLS basado en `auth.jwt()` asume que la query corre con el contexto de sesión de Supabase (vía PostgREST o `supabase-js`), no vía el pool de conexión directo que usa Prisma hoy. Hay que resolver esto explícitamente (ej. `set_config` por request, o aceptar que RLS solo protege el acceso vía API de Supabase y no vía Prisma) antes de asumir que "ya quedó protegido".
4. `SUPER_ADMIN` necesita bypass de RLS (visibilidad cross-tenant) — definir un rol de servicio separado para sus queries.

**Actualización (Fase 8 resuelta, 2026-08-20):** implementada de punta a punta — ver
`docs/supabase-todo.md` para el estado y el detalle completo en `FEATURES.md`. Resumen de cómo
se resolvió cada punto:

- El caveat del punto 3 (Prisma no abre conexiones "como el usuario autenticado") se resolvió
  con `set_config` por request — la opción que este documento ya anticipaba, no la alternativa
  de aceptar que RLS solo protegiera el acceso vía API de Supabase (la app nunca usa PostgREST
  para datos de negocio, así que esa alternativa hubiera dejado RLS sin ningún efecto real).
  Mecanismo: `AsyncLocalStorage` por request + middleware de Prisma (`$use`) que antepone
  `set_config` transaction-local a cada query — no `auth.jwt()` como sugería el paso 2 original
  (la app nunca corre queries vía PostgREST/supabase-js contra estas tablas, así que `auth.jwt()`
  nunca tendría nada que leer).
- El punto 1 (custom claim `iglesia_id` vía Access Token Hook) **no hizo falta**: las policies
  leen `current_setting('app.iglesia_id')`, fijado directamente por el backend en cada request
  (mismo dato que ya resuelve `JwtAuthGuard` consultando `Usuario` fresco), no un claim del JWT.
- El punto 4 (bypass de SUPER_ADMIN) se resolvió a nivel de policy (`current_setting('app.rol')
  in ('SUPER_ADMIN', 'SERVICE')`), no con un rol de Postgres de servicio separado — más simple
  dado que ya existe un solo rol de conexión (`app_runtime`, ver abajo).
- **Hallazgo no anticipado por este documento:** el rol `postgres` de `DATABASE_URL` tiene
  `BYPASSRLS` en este proyecto de Supabase — con ese rol, ninguna policy hubiera tenido efecto
  nunca, sin importar `FORCE ROW LEVEL SECURITY`. Se creó un rol nuevo sin ese atributo
  (`app_runtime`) y `DATABASE_URL` pasó a conectar como ese rol para el runtime de la API
  (`postgres` se mantiene para migraciones). **Pendiente real:** el `DATABASE_URL` del backend
  desplegado en Render no se actualizó (esta sesión no tiene acceso a ese dashboard) — hasta que
  alguien lo actualice ahí, el backend en producción sigue conectando como `postgres` y las
  policies no le aplican.

---

## Resumen de lo que NO depende de Supabase

Vale la pena decirlo explícito: Storage (parcialmente — el resize no depende de Supabase) y el bucket en sí son las únicas piezas de esta lista que resuelven algo roto hoy (disco efímero). El resto (Realtime, Edge Functions, Auth, RLS) son mejoras nuevas, no arreglos — importante al priorizar tiempo si hay presión de por medio (como la del 2026-08-07).