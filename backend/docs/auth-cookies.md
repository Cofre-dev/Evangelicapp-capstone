# Autenticación por cookies httpOnly — contrato backend/frontend

Reemplaza el esquema anterior (`accessToken`/`refreshToken` en el body + `localStorage`). Motivo: cerrar el riesgo de robo de tokens vía XSS antes de escalar, dado que la app maneja datos personales y financieros de iglesias a nivel nacional.

Implementado en 2026-07-08 — ver entrada correspondiente en [`FEATURES.md`](../FEATURES.md).

**Actualización 2026-08-16 (Fase 7 de `docs/supabase.md`, corte final):** este contrato de
cookies/CSRF **no cambió ni un poco** — mismos 3 nombres, mismos atributos, mismos endpoints. Lo
que cambió es qué emite/valida el contenido de `access_token`/`refresh_token` por dentro: ahora es
Supabase Auth (GoTrue), no un JWT propio firmado por este backend. Ver `FEATURES.md` para el
detalle completo del corte.

## Cookies

Las tres se setean/rotan juntas en `POST /auth/login` y `POST /auth/refresh`, y se limpian juntas en `POST /auth/logout` (ver `src/modules/auth/cookies.ts`).

| Cookie | httpOnly | Secure | SameSite | Path | Vida | Contenido |
|---|---|---|---|---|---|---|
| `access_token` | Sí | Sí en prod (`NODE_ENV=production`) | `Lax` en dev, `None` en prod | `/` | `JWT_ACCESS_EXPIRATION` (15m default) | JWT real de **Supabase Auth** (ES256, verificable vía JWKS) — ya no lo firma este backend |
| `refresh_token` | Sí | Sí en prod | `Lax` en dev, `None` en prod | `/auth/refresh` | `JWT_REFRESH_EXPIRATION` (7d default) | **String opaco de Supabase — no es un JWT.** No hay nada que verificar localmente; se valida presentándoselo de nuevo a GoTrue (`grant_type=refresh_token`) |
| `csrf_token` | **No** (a propósito) | Sí en prod | `Lax` en dev, `None` en prod | `/` | igual que refresh | token opaco aleatorio — 100% propio, no tiene relación con Supabase |

- `refresh_token` tiene `Path=/auth/refresh` a propósito: el navegador no lo manda en ninguna otra request, reduciendo su superficie de exposición.
- `Domain` no se fija (cookie host-only) — no hay necesidad de compartirla entre subdominios por ahora. Si backend y frontend terminan en subdominios distintos del mismo dominio raíz y hace falta compartir sesión, avisar para agregarlo.
- No hay endpoint que devuelva `csrf_token` en el body — se lee directo de `document.cookie` porque para eso es legible por JS.

## Contrato de los endpoints

### `POST /auth/login`
Body: `{ email, password }` (Fase 7 de docs/supabase.md, 2026-08-14: antes era `{ username, password }` — `username` sigue existiendo en el modelo pero dejó de ser la credencial de login). Respuesta (sin tokens):
```json
{ "usuario": {...}, "requiresPasswordChange": bool, "requiresOnboarding": bool }
```
Setea las 3 cookies. Exento de CSRF (no hay sesión previa que proteger).

### `POST /auth/refresh`
Sin body. Lee `refresh_token` de su cookie (string opaco, se lo presenta a GoTrue). Responde `{ "ok": true, "csrfToken": "..." }` y rota las 3 cookies (nuevo access, nuevo refresh, nuevo csrf). Responde `401` si el refresh token es inválido/expirado/reusado — ver nota sobre el período de gracia de reuso más abajo. **Requiere header `X-CSRF-Token`** igual a la cookie `csrf_token` (viaja porque `Path=/` la incluye en esta ruta).

### `POST /auth/logout`
Requiere `access_token` válido. Cierra la sesión del lado de Supabase (`admin.signOut(accessToken, 'global')` — revoca todas las sesiones de la cuenta, no solo la actual, mismo alcance que tenía antes revocar todos los `RefreshToken` locales) y limpia las 3 cookies. Requiere CSRF.

### Confirmación de contraseña (`ConfirmPasswordDto`)
Usado en acciones sensibles (borrar ceremonias/movimientos, corregir fecha de facturación) — no es parte del flujo de sesión, pero comparte el mismo mecanismo de verificación que el login (Supabase primero, bcrypt local como fallback con resincronización — ver `AuthService#confirmarPassword`). Responde **`403 Forbidden`**, no `401`, si la contraseña no coincide: el usuario sigue autenticado, solo falló esta confirmación puntual. Importante para el frontend — un interceptor que trate cualquier `401` como "cerrar sesión" no debe aplicar esa lógica a un `403` de esta ruta.

### Resto de endpoints protegidos
Sin cambios de contrato — el `access_token` ahora se lee de la cookie automáticamente (`credentials: "include"` en el fetch). **Durante la transición** el header `Authorization: Bearer` sigue aceptado como fallback; se retirará cuando confirmen que ya no queda ningún cliente usándolo.

## CSRF — double-submit cookie

`CsrfMiddleware` (global, `src/common/middleware/csrf.middleware.ts`) exige, en toda request `POST`/`PUT`/`PATCH`/`DELETE` que traiga `access_token` o `refresh_token` en sus cookies, que el header `X-CSRF-Token` coincida exactamente con el valor de la cookie `csrf_token`. Si no coincide o falta: `403 Forbidden`.

Si la request no trae ninguna cookie de sesión, se deja pasar sin exigir nada — así `POST /auth/login` y la ruta pública `POST /agenda/predicadores/:token/responder` (autenticada por el token de un solo uso, no por sesión) quedan exentas sin necesidad de una lista de exclusión que mantener a mano.

**Qué debe hacer el frontend**: en cada request mutante, leer `csrf_token` de `document.cookie` y mandarlo en el header `X-CSRF-Token`. Recomendación: hacerlo en un solo lugar (el wrapper `apiFetch`), no en cada call site.

Por qué double-submit y no solo `SameSite=Lax`: `Lax` ya bloquea el CSRF clásico por form POST cross-site, pero dado que el módulo de finanzas maneja datos sensibles, se agregó esta segunda capa por defensa en profundidad (cubre además escenarios de misconfiguración de CORS u otros bypasses de `SameSite`).

## CORS

`CORS_ORIGIN` en `.env` acepta uno o varios orígenes separados por coma; `credentials: true` está habilitado (obligatorio para que el navegador mande cookies cross-origin). Un origin no listado no recibe `Access-Control-Allow-Origin` en la respuesta — el navegador bloquea la lectura de la respuesta aunque la request al servidor sí se ejecute (esto es importante para endpoints mutantes: el CSRF middleware es la protección real, CORS por sí solo no evita que la request llegue al servidor).

## Rotación de refresh token y condición de carrera entre tabs

**Actualizado 2026-08-16 — esta sección describía la rotación local (tabla `RefreshToken`
propia); desde el corte de la Fase 7, la rotación y detección de reuso las hace Supabase del lado
de GoTrue, no este backend.** El comportamiento real, verificado contra el servidor:

- GoTrue tiene un **período de gracia de reuso** (~10 segundos): si se reintenta un refresh token
  que se acaba de rotar dentro de esa ventana, NO lo trata como robo — devuelve la sesión vigente
  otra vez, pensado justo para reintentos de red del cliente o dos tabs refrescando casi al mismo
  tiempo. **Esto es distinto al sistema anterior**, que revocaba todo ante cualquier reuso, sin
  ventana de gracia.
- Fuera de esa ventana (un token efectivamente viejo/ya no vigente), GoTrue responde `401` al
  refresh — el comportamiento exacto de revocación más allá de eso (si afecta solo esa sesión o
  todas) es interno de GoTrue, no algo que este backend controle o pueda documentar con precisión
  sin ver su código.

**Implicancia para el frontend**: sigue siendo buena práctica coordinar el refresh entre tabs con
la [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
(`navigator.locks.request('refresh-token', async () => { ... })`) para que solo una tab dispare la
request real — pero el riesgo de falso-positivo por carrera entre tabs es menor ahora que existe
el período de gracia de GoTrue.

## Timeline

Implementado ahora (no se dejó para después del MVP): el costo de retrofitear esto una vez que haya datos reales de iglesias fluyendo es mayor que el costo de hacerlo antes, y de todas formas el frontend tiene que tocar cada fetch mutante para el header CSRF — mejor hacerlo una sola vez.
