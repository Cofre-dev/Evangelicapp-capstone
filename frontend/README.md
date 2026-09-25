# Evangelicapp — Frontend

Aplicación de gestión para iglesias evangélicas en Chile (agenda, finanzas, notas/tareas, usuarios, onboarding, predicación). Este repo es **solo el frontend**. El backend (NestJS + Prisma + MySQL) vive en un repositorio separado.

> Este documento es la referencia técnica del proyecto. Si sos un modelo (Claude, GPT, etc.) o una persona nueva entrando a este repo por primera vez, empezá por acá. Los cambios relevantes de cada sesión de trabajo se registran en [`FEATURES.md`](./FEATURES.md) — léelo después de este README para tener el estado más reciente.

## Stack

- **Next.js 15** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (componentes basados en Radix) — ver `components.json`
- **Zustand** (`persist` middleware) para el estado de sesión — `src/stores/auth-store.ts`
- **react-hook-form** + **zod** para formularios y validación
- Cliente HTTP propio (sin librería externa) en `src/lib/api.ts`

## Requisitos

- Node.js `>=20.11.0` (ver `.nvmrc`; si usás `nvm`, corré `nvm use`)
- El backend corriendo en paralelo (repo separado) para que la app funcione más allá de la pantalla de login

## Setup

```bash
npm install
cp .env.example .env.local   # ajustar NEXT_PUBLIC_API_URL si el backend no está en localhost:3001
npm run dev
```

Scripts disponibles:

| Script             | Qué hace                                              |
| ------------------ | ------------------------------------------------------ |
| `npm run dev`       | Servidor de desarrollo (`next dev`)                    |
| `npm run build`     | Build de producción                                    |
| `npm run start`     | Sirve el build de producción                           |
| `npm run lint`      | ESLint (`eslint-config-next`)                          |
| `npm run typecheck` | `tsc --noEmit`, sin emitir archivos                     |

CI (`.github/workflows/ci.yml`) corre `lint`, `typecheck` y `build` en cada PR/push a `main`.

## Variables de entorno

| Variable                | Descripción                                                                 |
| ------------------------ | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`    | URL base del backend. Se usa tanto en `src/lib/api.ts` como para derivar el dominio permitido de imágenes en `next.config.ts` (`images.remotePatterns`) — no hace falta tocar `next.config.ts` al cambiar de entorno, solo esta variable. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Proyecto Supabase "Backend" — usadas **solo** por el canal de Supabase Realtime (ver "Tiempo real"). La anon key no es secreta (publishable). Si faltan, la app corre sin tiempo real (sin romper). |

Las `NEXT_PUBLIC_*` se hornean en el build — cambiarlas exige un redeploy, no basta con guardarlas en el panel del hosting.

## Deploy

- **Hosting**: **Cloudflare Workers** vía `@opennextjs/cloudflare` (`wrangler.jsonc`, `open-next.config.ts`, scripts `cf:*`), con Workers Builds construyendo el repo en cada push. El backend va aparte en **Render**, con dominio propio `api.evangelicapp.cl`. Frontend (`app.evangelicapp.cl`) y backend (`api.evangelicapp.cl`) quedan bajo el mismo dominio raíz `evangelicapp.cl` (subdominios → same-site).
- El Worker `evangelicapp` construye la rama `staging` y sirve `app.evangelicapp.cl` (custom domain activo). El subdominio por defecto `*.workers.dev` sigue resolviendo en paralelo hasta que se separe un entorno de staging real. Estado y pasos pendientes en el checklist.
- Checklist completo de puesta en producción (DNS a Cloudflare, variables, Supabase, CORS, Workers, orden de cutover, smoke test, rollback): [`docs/deploy-produccion.md`](./docs/deploy-produccion.md).
- Alternativa evaluada y descartada por costo: Vercel (ver "Alternativa: Vercel" en el checklist).

## Estructura del proyecto

```
src/
  app/                  # Rutas (App Router). Cada carpeta = una ruta.
    login/
    agenda/
    finanzas/
    notas/
    usuarios/
    superadmin/
      iglesias/[id]/
    predicacion/[token]/ # Ruta pública (acceso vía token, sin login)
  components/
    ui/                  # Primitivas shadcn/ui (button, dialog, form, table, etc.)
    layout/              # navbar, footer, app-shell
    <dominio>/           # Componentes específicos de cada módulo (agenda, finanzas, notas, usuarios, onboarding, iglesias)
  hooks/
    use-require-auth.ts  # Redirige a /login si no hay sesión hidratada
  lib/
    api.ts               # apiFetch: wrapper de fetch con manejo de errores y auth
    chile-regiones.ts    # Data estática (regiones/comunas de Chile)
    utils.ts             # cn() y utilidades varias
  stores/
    auth-store.ts        # Zustand + persist: sesión del usuario
```

## Roles y dominio

La app es multi-tenant por iglesia. Roles (`Rol` en `auth-store.ts`): `SUPER_ADMIN`, `PASTOR`, `TESORERO`, `SECRETARIA`, `MIEMBRO`. El home (`src/app/page.tsx`) arma los accesos rápidos según rol (`ACCESOS_POR_ROL`). `SUPER_ADMIN` administra iglesias desde `/superadmin`; el resto opera dentro de su propia iglesia (`iglesiaId` en la sesión).

## Autenticación

Sesión basada en cookies `httpOnly` (`access_token`, `refresh_token`, `csrf_token`) seteadas por el backend — el frontend nunca ve ni guarda tokens JWT. `src/stores/auth-store.ts` solo persiste `usuario` (datos no sensibles) para hidratar la UI sin flash.

`src/lib/api.ts` (`apiFetch`) hace todo el trabajo pesado:
- `credentials: "include"` en cada request.
- Lee `csrf_token` de `document.cookie` y lo manda en el header `X-CSRF-Token` en requests mutantes (POST/PUT/PATCH/DELETE) — obligatorio por el `CsrfMiddleware` del backend (double-submit cookie).
- Si una request responde `401`, intenta `POST /auth/refresh` una vez (coordinado entre pestañas con la Web Locks API para no disparar refreshes en paralelo) y reintenta la request original; si el refresh también falla, limpia la sesión y redirige a `/login`.

Contrato completo (nombres/atributos de cookies, endpoints, CSRF, rotación de refresh token) en [`docs/auth-cookies.md`](./docs/auth-cookies.md).

## Tiempo real

Tres pantallas ("en vivo") se actualizan sin refrescar: dashboard de SuperAdmin, detalle de evento (badges de predicadores) y censo QR. El transporte es **Supabase Realtime (Broadcast)** vía `@supabase/supabase-js`, usado **exclusivamente** para eso — los datos de negocio siguen yendo por `apiFetch`.

- `src/lib/supabase-realtime.ts`: cliente singleton (sin sesión de supabase-auth). Requiere `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (proyecto Supabase "Backend"); si faltan, la app arranca en modo "sin realtime" y las pantallas funcionan igual con su carga REST.
- `src/hooks/use-realtime.ts`: `useRealtimeEvent('<evento>', handler)`. Mantiene UN canal privado por sesión, autenticado con un JWT corto de `GET /realtime/token` (renovado antes de expirar y tras cada refresh de sesión).

Detalle en [`FEATURES.md`](./FEATURES.md) (entrada de 2026-09-08).

## Backend

Repo separado (NestJS + Prisma + MySQL). Este frontend solo conoce el contrato HTTP vía `NEXT_PUBLIC_API_URL` — no hay código ni tipos compartidos entre ambos repos todavía.

## Convenciones

- Nombres de rutas, campos y mensajes de UI en español (dominio chileno/eclesiástico); nombres de variables/funciones en inglés donde no haya un término de dominio (`nombre`, `iglesia`, `rol` sí se dejan en español porque son el vocabulario del negocio).
- Sin librería de manejo de servidor-estado (React Query, SWR, etc.) todavía — el fetching es directo con `apiFetch` + estado local/Zustand. Si el número de vistas con caching/revalidación crece, vale la pena reevaluar.
- Sin suite de tests todavía. Antes de agregar un framework de testing, alinear con el equipo qué se quiere cubrir (unit de lógica de dominio vs. e2e de flujos críticos como login/finanzas).
