# Autenticación por cookies httpOnly — contrato backend/frontend

Reemplaza el esquema anterior (`accessToken`/`refreshToken` en el body + `localStorage`). Motivo: cerrar el riesgo de robo de tokens vía XSS antes de escalar, dado que la app maneja datos personales y financieros de iglesias a nivel nacional.

Implementado en 2026-07-08 — ver entrada correspondiente en [`FEATURES.md`](../FEATURES.md).

## Cookies

Las tres se setean/rotan juntas en `POST /auth/login` y `POST /auth/refresh`, y se limpian juntas en `POST /auth/logout` (ver `src/modules/auth/cookies.ts`).

| Cookie | httpOnly | Secure | SameSite | Path | Vida | Contenido |
|---|---|---|---|---|---|---|
| `access_token` | Sí | Sí en prod (`NODE_ENV=production`) | `Lax` | `/` | `JWT_ACCESS_EXPIRATION` (15m default) | JWT firmado |
| `refresh_token` | Sí | Sí en prod | `Lax` | `/auth/refresh` | `JWT_REFRESH_EXPIRATION` (7d default) | JWT firmado |
| `csrf_token` | **No** (a propósito) | Sí en prod | `Lax` | `/` | igual que refresh | token opaco aleatorio (32 bytes) |

- `refresh_token` tiene `Path=/auth/refresh` a propósito: el navegador no lo manda en ninguna otra request, reduciendo su superficie de exposición.
- `Domain` no se fija (cookie host-only) — no hay necesidad de compartirla entre subdominios por ahora. Si backend y frontend terminan en subdominios distintos del mismo dominio raíz y hace falta compartir sesión, avisar para agregarlo.
- No hay endpoint que devuelva `csrf_token` en el body — se lee directo de `document.cookie` porque para eso es legible por JS.

## Contrato de los endpoints

### `POST /auth/login`
Body: `{ username, password }` (sin cambios). Respuesta (sin tokens):
```json
{ "usuario": {...}, "requiresPasswordChange": bool, "requiresOnboarding": bool }
```
Setea las 3 cookies. Exento de CSRF (no hay sesión previa que proteger).

### `POST /auth/refresh`
Sin body. Lee `refresh_token` de su cookie. Responde `{ "ok": true }` y rota las 3 cookies (nuevo access, nuevo refresh, nuevo csrf). Responde `401` si el refresh token es inválido/expirado/reusado. **Requiere header `X-CSRF-Token`** igual a la cookie `csrf_token` (viaja porque `Path=/` la incluye en esta ruta).

### `POST /auth/logout`
Requiere `access_token` válido. Revoca en BD todos los refresh tokens activos del usuario y limpia las 3 cookies. Requiere CSRF.

### Resto de endpoints protegidos
Sin cambios de contrato — el `access_token` ahora se lee de la cookie automáticamente (`credentials: "include"` en el fetch). **Durante la transición** el header `Authorization: Bearer` sigue aceptado como fallback; se retirará cuando confirmen que ya no queda ningún cliente usándolo.

## CSRF — double-submit cookie

`CsrfMiddleware` (global, `src/common/middleware/csrf.middleware.ts`) exige, en toda request `POST`/`PUT`/`PATCH`/`DELETE` que traiga `access_token` o `refresh_token` en sus cookies, que el header `X-CSRF-Token` coincida exactamente con el valor de la cookie `csrf_token`. Si no coincide o falta: `403 Forbidden`.

Si la request no trae ninguna cookie de sesión, se deja pasar sin exigir nada — así `POST /auth/login` y la ruta pública `POST /agenda/predicadores/:token/responder` (autenticada por el token de un solo uso, no por sesión) quedan exentas sin necesidad de una lista de exclusión que mantener a mano.

**Qué debe hacer el frontend**: en cada request mutante, leer `csrf_token` de `document.cookie` y mandarlo en el header `X-CSRF-Token`. Recomendación: hacerlo en un solo lugar (el wrapper `apiFetch`), no en cada call site.

Por qué double-submit y no solo `SameSite=Lax`: `Lax` ya bloquea el CSRF clásico por form POST cross-site, pero dado que el módulo de finanzas maneja datos sensibles, se agregó esta segunda capa por defensa en profundidad (cubre además escenarios de misconfiguración de CORS u otros bypasses de `SameSite`).

## CORS

`CORS_ORIGIN` en `.env` acepta uno o varios orígenes separados por coma; `credentials: true` está habilitado (obligatorio para que el navegador mande cookies cross-origin). Un origin no listado no recibe `Access-Control-Allow-Origin` en la respuesta — el navegador bloquea la lectura de la respuesta aunque la request al servidor sí se ejecute (esto es importante para endpoints mutantes: el CSRF middleware es la protección real, CORS por sí solo no evita que la request llegue al servidor).

## Topología de producción (dominios)

- **Frontend**: `app.evangelicapp.cl` — Cloudflare Workers (`@opennextjs/cloudflare`).
- **Backend**: `api.evangelicapp.cl` — Render (custom domain). El dominio de Render `evangelicapp-backend.onrender.com` sigue existiendo pero ya no es el que apunta el frontend.

**`app.` y `api.` son subdominios del mismo dominio raíz `evangelicapp.cl` → same-site.** Con esta topología `SameSite=Lax` alcanzaría para que las cookies viajen en cada `apiFetch`. En la práctica el backend viene seteando las cookies con **`SameSite=None; Secure`** desde la etapa en que el frontend estaba en `evangelicapp.rojascofrem.workers.dev` (cross-site respecto al backend en Render); `None` funciona igual same-site, así que no hubo que tocar el backend al migrar al dominio propio. (La tabla de "Cookies" más arriba describe la config con la que se implementó el esquema en 2026-07 — `Lax`; el valor efectivo en prod es `None`. Confirmar y actualizar la tabla con backend.)

`csrf_token`: `src/lib/api.ts` recibe el valor en el body de `/auth/login` y `/auth/refresh` y lo guarda en memoria (`csrfToken`) — **no** lo lee de `document.cookie`. Esto se hizo cuando frontend y backend eran cross-site (una cookie host-only de otro dominio no es legible por JS); ahora que son same-site se podría volver a leer de `document.cookie`, pero no hay razón para cambiarlo. (Contra lo que dice la nota de la sección "Cookies", también desactualizada.)

Requisito de infra: `CORS_ORIGIN` del backend debe listar el origin del frontend (`https://app.evangelicapp.cl`) explícitamente — sin wildcard, `credentials: true` no lo admite. Ya no incluye `evangelicapp.rojascofrem.workers.dev`. Checklist completo en [`deploy-produccion.md`](./deploy-produccion.md).

## Rotación de refresh token y condición de carrera entre tabs

El refresh token rota en cada uso (`refresh_token` viejo queda `revoked` en BD, se emite uno nuevo). La rotación es atómica en el backend (`updateMany` condicional sobre `revoked: false`): si dos requests llegan casi al mismo tiempo con el mismo refresh token, exactamente una gana y rota; la otra recibe `401` limpio.

Si más tarde alguien reintenta usar un refresh token que **ya fue rotado antes** (no la carrera del mismo instante, sino un reuso posterior), se interpreta como señal de robo: se revocan **todas** las sesiones activas del usuario y debe volver a loguearse en todos sus dispositivos/pestañas. Verificado manualmente: dos "tabs" simulados refrescando con el mismo token viejo terminan ambos deslogueados.

**Implicancia para el frontend**: si dos tabs de la misma persona intentan refrescar en el mismo instante sin coordinarse, el que pierde la carrera fuerza el logout de ambos (falso positivo de "robo"). Recomendación concreta: coordinar el refresh entre tabs con la [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) (`navigator.locks.request('refresh-token', async () => { ... })`) para que solo una tab dispare la request real y las demás esperen su resultado — evita que la carrera ocurra en primer lugar, en vez de intentar tolerarla del lado del backend a costa de debilitar la detección de robo.

## Timeline

Implementado ahora (no se dejó para después del MVP): el costo de retrofitear esto una vez que haya datos reales de iglesias fluyendo es mayor que el costo de hacerlo antes, y de todas formas el frontend tiene que tocar cada fetch mutante para el header CSRF — mejor hacerlo una sola vez.