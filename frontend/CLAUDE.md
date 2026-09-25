# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este repo

Frontend (solo frontend) de Evangelicapp — app de gestión para iglesias evangélicas en Chile (agenda, finanzas, notas/tareas, usuarios, onboarding, predicación, multi-tenant por iglesia). El código vive en `frontend/`, no en la raíz. El backend (NestJS + Prisma + MySQL) está en un repositorio separado; este repo no tiene tipos ni código compartido con él, solo el contrato HTTP vía `NEXT_PUBLIC_API_URL`.

**Antes de tocar código, leé en este orden:**
1. `frontend/README.md` — referencia técnica del proyecto.
2. `frontend/FEATURES.md` — bitácora de ingeniería, entradas más recientes arriba. Registra qué se hizo, por qué, y qué queda pendiente/abierto. Agregá una entrada nueva ahí después de cualquier sesión de trabajo relevante (no es changelog de usuario final).
3. `frontend/docs/auth-cookies.md` y `frontend/docs/colaboradores-qr.md` si el trabajo toca auth o el módulo de colaboradores/QR (este último todavía no implementado, solo planificado).

## Comandos (correr dentro de `frontend/`)

```bash
npm install
cp .env.example .env.local   # ajustar NEXT_PUBLIC_API_URL si el backend no está en localhost:3001
npm run dev                  # servidor de desarrollo
npm run build                # build de producción
npm run start                # sirve el build de producción
npm run lint                 # ESLint (eslint-config-next)
npm run typecheck            # tsc --noEmit
```

No hay suite de tests todavía (decisión explícita — ver README). CI (`.github/workflows/ci.yml`) corre `lint` + `typecheck` + `build` en cada PR/push a `main`, sin step de tests. Antes de introducir un framework de testing, alinear con el equipo qué cubrir (unit de lógica de dominio vs. e2e de flujos críticos como login/finanzas).

Node `>=20.11.0` (ver `.nvmrc`; `nvm use` si aplica). El backend debe correr en paralelo para que la app funcione más allá del login.

## Arquitectura

**Stack**: Next.js 15 (App Router) + React 18 + TypeScript, Tailwind + shadcn/ui (Radix), Zustand (`persist`) para sesión, react-hook-form + zod para formularios. Sin librería de server-state (React Query/SWR) — fetching directo con `apiFetch` + estado local/Zustand; revaluar solo si el número de vistas con caching/revalidación crece.

**Autenticación (cookies httpOnly, no JWT en JS)** — pieza central, tocarla con cuidado:
- El frontend nunca ve ni guarda tokens. `src/stores/auth-store.ts` (Zustand + persist) solo guarda `usuario` (datos no sensibles) para hidratar la UI sin flash de contenido. `hasHydrated` existe porque la rehidratación de `persist` es async: sin esperarla, una página protegida redirigiría a `/login` por una fracción de segundo con sesión real guardada.
- `src/lib/api.ts` (`apiFetch`) concentra toda la lógica: `credentials: "include"` en cada request; lee `csrf_token` de `document.cookie` y lo manda en `X-CSRF-Token` en requests mutantes (POST/PUT/PATCH/DELETE) — obligatorio por el `CsrfMiddleware` del backend (double-submit cookie); si una request responde `401`, intenta `POST /auth/refresh` una vez (coordinado entre pestañas con la Web Locks API — sin esto, dos tabs refrescando a la vez disparan la detección de robo de refresh token del backend y fuerzan logout de ambas) y reintenta; si el refresh también falla, limpia la sesión y redirige a `/login`.
- `src/hooks/use-require-auth.ts` es el guard estándar de página: redirige a `/login` si `hasHydrated && !usuario`; las páginas deben esperar `ready` antes de renderizar contenido protegido.
- Contrato completo (cookies, endpoints, CSRF, rotación de refresh token) en `frontend/docs/auth-cookies.md`. No modificar `auth-store.ts` ni `api.ts` respecto a auth sin confirmar el contrato con el backend primero.

**Roles y multi-tenancy**: `Rol` (`src/stores/auth-store.ts`) = `SUPER_ADMIN | PASTOR | TESORERO | SECRETARIA | MIEMBRO`. `SUPER_ADMIN` administra iglesias desde `/superadmin`; el resto opera dentro de su propia iglesia (`iglesiaId` en la sesión). `MIEMBRO` no tiene forma de crearse todavía (ni seed ni UI) — no es un caso real hoy. Los accesos rápidos del home (`src/app/page.tsx`, `ACCESOS_POR_ROL`) y el acceso a secciones enteras (ej. `ROLES_CON_AGENDA`, `ROLES_CON_ACCESO` en cada página) se gobiernan por listas de roles hardcodeadas por módulo — no asumir que el mismo criterio de roles aplica entre módulos distintos (ej. agenda usa 3 roles, colaboradores propuso 2; confirmar explícitamente en vez de copiar el patrón de otro módulo).

**Estructura** (`frontend/src/`):
```
app/              # Rutas (App Router), una carpeta = una ruta
  login/ agenda/ finanzas/ notas/ usuarios/
  superadmin/iglesias/[id]/
  predicacion/[token]/   # ruta pública, sin login, acceso vía token
components/
  ui/              # primitivas shadcn/ui
  layout/          # navbar, footer, app-shell
  <dominio>/       # componentes específicos por módulo (agenda, finanzas, notas, usuarios, onboarding, iglesias)
hooks/use-require-auth.ts
lib/
  api.ts               # apiFetch — ver arriba
  chile-regiones.ts     # data estática (regiones/comunas de Chile)
  utils.ts              # cn() y utilidades varias
stores/auth-store.ts
```

**Rutas públicas sin sesión** (patrón `predicacion/[token]`): `apiFetch` funciona sin cookie de sesión sin cambios — al no existir `csrf_token` para un visitante anónimo, simplemente no manda `X-CSRF-Token`. No hace falta un cliente HTTP aparte para estas rutas.

**Imágenes**: `next.config.ts` deriva `images.remotePatterns` de `NEXT_PUBLIC_API_URL` (para logos de iglesia servidos por el backend en `/uploads/**`) — cambiar de entorno solo requiere cambiar la variable, no tocar `next.config.ts`.

## Convenciones

- Nombres de rutas, campos y mensajes de UI en español (dominio chileno/eclesiástico: `nombre`, `iglesia`, `rol`, etc. se dejan en español porque son vocabulario del negocio); nombres de variables/funciones en inglés donde no haya término de dominio.
- Alias de import `@/*` → `src/*`.
