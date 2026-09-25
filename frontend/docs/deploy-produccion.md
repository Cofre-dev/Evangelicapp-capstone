# Puesta en producción — checklist

Frontend (este repo) en **Cloudflare Workers**, dominio `app.evangelicapp.cl`.
Backend en **Render**, dominio `api.evangelicapp.cl`.
Complementa `README.md` y `FEATURES.md`.

> Última revisión: 2026-09-10.

---

## Estado real (verificado 2026-09-10)

Ya está sirviendo en el dominio propio: `app.evangelicapp.cl` + `api.evangelicapp.cl`.

- ✅ **DNS**: `evangelicapp.cl` delegado a Cloudflare (nameservers
  `ignacio/zoe.ns.cloudflare.com` en nic.cl). Zona activa. Landing + `www` por
  Cloudflare.
- ✅ **Frontend en `app.evangelicapp.cl`**: custom domain del Worker `evangelicapp`
  activo (Cloudflare → Worker → Settings → Domains & Routes). Certificado emitido.
  El Worker construye la rama `staging` en cada push vía Workers Builds.
- ✅ **Backend en `api.evangelicapp.cl`**: custom domain en Render, con `CNAME api`
  en Cloudflare DNS (**Proxy: DNS only**) al target de Render. Responde.
- ✅ **`CORS_ORIGIN` del backend** incluye `https://app.evangelicapp.cl` con
  `credentials: true`, y ya **no** acepta `evangelicapp.rojascofrem.workers.dev`
  (verificado).
- ✅ **`FRONTEND_URL` / `BACKEND_URL` en Render** → `https://app.evangelicapp.cl` /
  `https://api.evangelicapp.cl`. Los links que arma el backend (confirmar
  asistencia, QR de integrantes, invitación a predicador, "ver quién confirmó",
  recuperación de contraseña, botón "Ir a EvangelicApp" de los correos de
  facturación) y el link de convocatoria por WhatsApp ya salen con el dominio bueno.
- ✅ **Variables del Worker** (panel de Build):
  - `NEXT_PUBLIC_API_URL` = `https://evangelicapp-backend.onrender.com` —
    **pendiente** de pasar a `https://api.evangelicapp.cl` (ver abajo). Funciona
    igual mientras tanto: ese dominio de Render sigue resolviendo.
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://woerftoeqarupnrggupl.supabase.co` (**evangelicapp-prod**)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_...` (de ese proyecto)
- ✅ **Sesión**: `app.` y `api.` son subdominios del mismo raíz `evangelicapp.cl`
  → same-site. Las cookies siguen con `SameSite=None; Secure` (heredado de cuando
  el frontend estaba en `*.workers.dev`), que funciona igual same-site — no hubo
  que tocar el backend al migrar. (La tabla vieja de `docs/auth-cookies.md` dice
  `Lax`; el valor efectivo es `None`.)

### Pendiente

1. ⚠️ **`NEXT_PUBLIC_API_URL` del Worker → `https://api.evangelicapp.cl`**.
   Cloudflare → Worker `evangelicapp` → Settings → **Build** → Variables →
   editar → **Save** → **Retry / Deploy**. `next.config.ts` deriva de esa var el
   host permitido de `next/image` — no hay que tocar código.
   Verificar tras el deploy: los chunks servidos por `app.evangelicapp.cl` ya no
   mencionan `onrender.com`, y login + pantallas autenticadas siguen andando.
2. ⬜ **Apagar `*.workers.dev`** (opcional, es lo que pidió el fundador):
   `evangelicapp.rojascofrem.workers.dev` sigue resolviendo en paralelo. Worker →
   Settings → Domains & Routes → `workers.dev` → **Disable** (o `"workers_dev": false`
   en `wrangler.jsonc` + deploy). **Ojo**: los preview deployments de Workers Builds
   usan ese subdominio — dejarlo hasta separar un entorno de staging real (ver
   "Separar staging de producción" más abajo).
3. ⬜ **Backend prod al día** + **merge `staging → main`** (secciones siguientes).
4. ⬜ Reimprimir los QR de integrantes ya compartidos con la URL vieja.

---

## QA sobre `app.evangelicapp.cl`

Entrar con un usuario real y confirmar:

- [ ] Login → entra al panel.
- [ ] Navegar a Finanzas y que cargue (GET autenticado funciona).
- [ ] Crear/editar un registro (mutación con CSRF).
- [ ] Abrir 2 pestañas, dejar la sesión un rato, navegar → ninguna se desloguea.
- [ ] Una pantalla "en vivo" (censo QR / convocatoria) actualiza desde otro
      dispositivo, o degrada limpio a "sin realtime".
- [ ] Logos de iglesia cargan.
- [ ] Rutas públicas sin sesión: `/predicacion/[token]`, `/agenda/asistencia/[token]`,
      `/integrantes/registro/[qrToken]`.
- [ ] `/cuenta-suspendida` y `/facturacion` muestran `contacto@evangelicapp.cl`.

Links que arma el backend (dependen de `FRONTEND_URL` en Render, ya corregida):

- [ ] Evento con "notificar integrantes" → el correo trae botones **Sí/No voy a
      asistir** que abren `https://app.evangelicapp.cl/agenda/asistencia/<token>`, y
      el POST de respuesta funciona.
- [ ] Integrantes → diálogo del QR → el texto de la URL y el QR muestran
      `https://app.evangelicapp.cl/integrantes/registro/<token>` (sin necesidad de
      "Regenerar"); escanearlo desde el celular abre el formulario y el registro se
      guarda.
- [ ] "Olvidé mi contraseña" → el link del correo es
      `https://app.evangelicapp.cl/recuperar-contrasena/<token>`.
- [ ] (Si se apagó `*.workers.dev`) `curl -I https://evangelicapp.rojascofrem.workers.dev`
      → 404 / no resuelve.

Verificación de CORS del backend:
  ```bash
  curl -s -i -X OPTIONS https://api.evangelicapp.cl/auth/login \
    -H "Origin: https://app.evangelicapp.cl" \
    -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
  ```
  Tiene que devolver `access-control-allow-origin: https://app.evangelicapp.cl`.

Con eso, **estás en producción en `app.evangelicapp.cl`**.

---

## `api.evangelicapp.cl` — hecho

El backend ya está en `api.evangelicapp.cl` (custom domain en Render + `CNAME api`
en Cloudflare DNS, **Proxy: DNS only**). `CORS_ORIGIN` quedó con
`https://app.evangelicapp.cl` y sin el Worker. `FRONTEND_URL` / `BACKEND_URL` en
Render apuntan a `app.` / `api.`.

Lo único que falta del lado del frontend es apuntar `NEXT_PUBLIC_API_URL` del Worker
al dominio nuevo (ver "Pendiente" arriba): hoy sigue en
`evangelicapp-backend.onrender.com`, que resuelve igual, así que la app funciona —
pero conviene pasarlo a `https://api.evangelicapp.cl` y redeployar.

---

## Antes de considerar "producción de verdad"

El código productivo vive en `staging` (rama), no en `main` — `main` está ~1 mes
atrás. El Worker construye `staging`, así que hoy sirve el código bueno. Cuando
quieras alinear:

```bash
git checkout main && git pull origin main
git merge --no-ff staging && git push origin main
```

Y, del lado del backend (repo aparte): confirmar que Render prod tiene desplegado
lo que el frontend de `staging` asume (Realtime a Supabase Broadcast, bloqueo de
login, convocatoria, recuperación de contraseña) y que las migraciones están
aplicadas a `evangelicapp-prod`. Varias entradas de `FEATURES.md` marcan "backend
en staging, prod todavía no".

---

## Separar staging de producción (más adelante, no urgente)

Hoy no hay entorno de staging real: el Worker `evangelicapp` es a la vez QA y
producción (`app.evangelicapp.cl`). Si querés un colchón:

- **Opción A**: crear un Worker `evangelicapp-staging` nuevo, conectarlo al repo
  por Workers Builds en una rama de QA, con su propio proyecto Supabase si hace
  falta. `evangelicapp` queda de producción con `app.evangelicapp.cl`.
- **Opción B**: usar preview deployments de Workers Builds (ramas no-producción
  generan URLs `<hash>-evangelicapp...workers.dev` automáticamente).

---

## Rollback

- **Frontend**: Cloudflare → Worker → **Deployments** → versión anterior →
  **Rollback** (instantáneo). O `git revert` + push.
- **Backend**: rollback del deploy en Render aparte. Ojo con migraciones ya
  aplicadas a la BD prod.

---

## Alternativa: Vercel

Si algún día preferís pagar (~USD 20/mes, plan Pro — Hobby es no comercial) para
no lidiar con Workers: proyecto con root `frontend/`, Node 20.x, las 3
`NEXT_PUBLIC_*`, custom domain `app.evangelicapp.cl`. `next/image` funciona sin
config. El resto del checklist (DNS ya está, Supabase, backend, CORS, QA) es igual.
