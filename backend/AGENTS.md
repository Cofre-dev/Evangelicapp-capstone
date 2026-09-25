# AGENTS.md

Backend NestJS + Prisma de **EvangelicApp** (gestión multi-tenant para iglesias evangélicas de Chile). Todo el código vive en `backend/`. Solo el backend está en este repo; el frontend está en un repo aparte.

Fuentes de contexto que debes leer antes de trabajar:
- `CLAUDE.md` — contexto de negocio/producto y **bitácora obligatoria** (regla: toda modificación del repo se registra al final de `FEATURES.md`; es solo-agregar, nunca se borra).
- `README.md` — referencia técnica (módulos, arquitectura, roles).
- `github.md` — convenciones de commits y migraciones.
- `docs/auth-cookies.md` — flujo de auth.

## Comandos (siempre desde `backend/`)

```bash
npm run lint:ci        # lint sin autofix (lo que corre en CI)
npm run build          # nest build
npm test               # jest (solo *.spec.ts en src/)
npm run start:dev
```

Verificación completa antes de terminar un cambio (orden del CI): `npm run lint:ci` → `npm run build` → `npm test` → `npx prisma migrate status` (confirmar sin drift).

Test individual: `npx jest --testPathPattern=src/modules/auth/auth.service.spec.ts` (rootDir de jest es `src`). No hay tests de integración — solo 5 specs unitarios en `src/common/**` y `src/modules/auth/auth.service.spec.ts`; los de service usan mocks directos de `PrismaService`, sin `@nestjs/testing`.

Setup local: `docker compose up -d postgres` (Postgres 16 local), `cp .env.example .env`, `npm run prisma:generate`, `npm run prisma:migrate` (contra la base LOCAL), `npm run prisma:seed`.

## Base de datos — el gotcha más importante

`backend/.env` apunta a **Supabase** (`DATABASE_URL`), que tiene **datos reales** (1 iglesia, usuarios, movimientos financieros). Reglas:
- **Nunca** correr `npm run prisma:migrate` (ejecuta `prisma migrate dev`) contra la `DATABASE_URL` de Supabase — puede resetear la base por drift. Contra Supabase solo: `npx prisma migrate status` → `npx prisma migrate deploy`.
- Una migración nueva se escribe a mano y se aplica con `migrate deploy`, y la carpeta de la migración se commitea **en el mismo commit** que el `schema.prisma` que la originó. No editar migraciones ya aplicadas en `main`; generar una correctiva.
- `npm run prisma:seed` crea 3 iglesias demo + SuperAdmin — **no correrlo contra Supabase** salvo que quieras datos demo ahí.
- Prisma está en Postgres; enums nativos, `snake_case` de tablas vía `map` (ver schema).

## Multi-tenancy — regla de oro

`Iglesia` es el tenant raíz; todo recurso transaccional tiene `iglesiaId` con `onDelete: Cascade`. **El `iglesiaId` siempre sale del JWT** (`@CurrentUser()`), nunca del body/params. Cada controller de recurso tiene un helper privado `requireIglesiaId(user)` (lanza 403 para SUPER_ADMIN que no pertenece a iglesia). Los services reciben `iglesiaId` como primer argumento explícito y lo usan en cada `where`. Ver `src/modules/finanzas/movimientos.service.ts` como referencia. Nunca romper este aislamiento.

## Auth y roles

- Login por **username** (no email). Tokens en cookies `httpOnly`, nunca en body/localStorage. CSRF: double-submit — toda request mutante con cookie de sesión debe reflejar el valor en `X-CSRF-Token`.
- Access token 15m + refresh 7d con rotación atómica (reuso = posible robo, revoca todas las sesiones). Refresh tokens hasheados (SHA-256) en BD.
- `JwtStrategy#validate` revalida `usuario.activo` e iglesia `estado` en **cada** request. `JwtStrategy` acepta también `Authorization: Bearer` como fallback de transición.
- Roles actuales: `SUPER_ADMIN` (global, `iglesiaId: null`), `MANAGER`, `USUARIO`. **No existen** `PASTOR`/`TESORERO`/`SECRETARIA`/`MIEMBRO` (este último se eliminó del enum `Rol` el 2026-08-20 — nunca tuvo endpoints propios).
- Autorización: `JwtAuthGuard` + `RolesGuard` + `@Roles(...)`; módulos delegables (Agenda, Finanzas, Ceremonias, Integrantes) agregan `ModuloAccessGuard` + `@Modulo(...)` — USUARIO solo si MANAGER otorgó `AccesoModulo`. `Notas` no es delegable (MANAGER, salvo `mis-tareas` y `marcar-hecha`).
- Rutas públicas sin guard (token de un solo uso en la URL): `agenda/predicadores/:token`, `agenda/asistencias/:token`, `integrantes/registro/:qrToken`.
- Errores de constraint única de Prisma (`P2002`) se traducen con `translateUniqueConstraintError`.

## Convenciones

- DTOs con `class-validator`; `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted` (cualquier campo no declarado se rechaza).
- Login y requests revalidan `estado` de iglesia → 403 `code: "IGLESIA_SUSPENDIDA"` si oculta por mora (planes: no hay plan por defecto; `CreateIglesiaDto` exige `plan` y `proximaFacturacion`; topes por plan en `common/constants/plan.ts`, validados solo al crear, nunca retroactivos).
- Comentarios solo donde el código no explica el *por qué* (reglas de negocio no obvias). Sin comentarios de relleno.
- Storage de logos local `uploads/` servido en `/uploads/*`. `CORS_ORIGIN` (obligatorio, separado por comas) porque las cookies exigen `credentials: true`.
- `main.ts` usa `trust proxy: 1` (necesario para el rate-limit por IP de `forgot-password`).
- Mensajes de commit: `tipo(alcance): resumen` en español; un commit = un cambio describible en una frase; `FEATURES.md` se commitea junto al código que documenta; nunca `git add -A` a ciegas (historial de `.env` y `uploads/` commiteados por error). Detalles en `github.md`.
