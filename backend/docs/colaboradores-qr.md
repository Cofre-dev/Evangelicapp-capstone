# Plan: módulo de Colaboradores + registro por QR + convocatorias (WhatsApp/email)

Estado: **planificado, no implementado**. Decisiones ya tomadas con el fundador (2026-07-08):

- WhatsApp se envía vía **API oficial de WhatsApp Business (Meta Cloud API)** — no las librerías no oficiales (Baileys/whatsapp-web.js), por el riesgo real de baneo del número que eso implica para algo pensado para durar años a nivel nacional.
- La convocatoria a colaboradores **no es automática**: se dispara con un botón explícito desde el evento, nunca al crear el evento.

## Qué resuelve

Hoy no hay forma de que una iglesia junte los datos de contacto de sus colaboradores/asistentes para poder avisarles de un culto. La idea: el pastor genera un QR propio de su iglesia, la gente lo escanea, ve el logo/nombre de la iglesia y el nombre del pastor, y deja sus datos. Cuando se organiza un culto, alguien del equipo aprieta "Convocar" y les llega WhatsApp + email.

## Modelo de datos (Prisma)

```prisma
model Colaborador {
  id               String   @id @default(cuid())
  nombre           String
  apellido         String
  email            String
  telefono         String   // normalizado a E.164 (+56...) al guardar — WhatsApp lo exige así
  activo           Boolean  @default(true)
  consentimientoAt DateTime @default(now())
  /// Token de un solo uso para el link "darme de baja" en los emails, sin requerir login.
  bajaToken        String   @unique @default(cuid())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  iglesiaId String
  iglesia   Iglesia @relation(fields: [iglesiaId], references: [id], onDelete: Cascade)

  @@unique([iglesiaId, email])
  @@index([iglesiaId])
  @@map("colaboradores")
}
```

En `Iglesia`, agregar:

```prisma
/// Regenerable por el pastor sin tocar el id real del tenant — así puede invalidar
/// un QR viejo (por ejemplo si se filtró de forma indebida) sin romper nada más.
colaboradoresQrToken String? @unique @default(cuid())
colaboradores        Colaborador[]
```

No se agrega un modelo de "log de convocatorias" en esta fase — es fan-out síncrono, la respuesta del endpoint ya trae el resumen de éxitos/fallos. Si más adelante se pide historial de convocatorias enviadas, se agrega ahí (mismo criterio que `MovimientoAuditLog`, pero no hay que adelantarlo sin necesidad real).

## Endpoints

### Públicos (sin guard, como `agenda/predicadores/:token`)

- `GET /public/colaboradores/:qrToken` → `{ iglesiaNombre, iglesiaLogoUrl, pastorNombre }`. 404 si el token no existe o la iglesia no está `ACTIVA`.
- `POST /public/colaboradores/:qrToken` → body `{ nombre, apellido, email, telefono, aceptaConsentimiento: true }` + un campo honeypot oculto. Upsert por `(iglesiaId, email)` — re-escanear el mismo QR con el mismo correo actualiza en vez de duplicar. Rate-limited por IP (`@nestjs/throttler`, ya oficial de Nest, sin dependencias raras).
- `POST /public/colaboradores/baja/:bajaToken` → marca `activo: false`. Sin GET previo necesario, el link del email pega directo acá con confirmación simple del lado del frontend.

### Autenticados (propuesta: `PASTOR` + `SECRETARIA`, mismo criterio que `agenda` — decime si lo ves distinto)

- `GET /colaboradores` — listado de la iglesia (filtro `activo`).
- `PATCH /colaboradores/:id` — editar datos / reactivar.
- `DELETE /colaboradores/:id` — borrado real (derecho a eliminación de datos personales).
- `GET /iglesias/mi-iglesia/qr` — token actual + URL pública ya armada.
- `POST /iglesias/mi-iglesia/qr/regenerar` — rota `colaboradoresQrToken`, invalida el QR anterior.

### Convocatoria

- `POST /agenda/eventos/:id/convocar` (mismos roles que ya gestionan `agenda/eventos`) → dispara WhatsApp + email a todos los `colaboradores` `activo` de la iglesia del evento. Responde con resumen, no un booleano:
  ```json
  { "destinatarios": 45, "whatsapp": { "enviados": 42, "fallidos": 3 }, "email": { "enviados": 45, "fallidos": 0 } }
  ```
  Abierto a cualquier `tipo` de evento (no solo `CULTO`) ya que el botón explícito es el control anti-spam, no el tipo — se puede restringir después si hace falta.

## Email

Extiende `MailService` (Nodemailer, ya en uso) con `enviarConvocatoriaCulto(...)`, mismo patrón que `enviarInvitacionPredicador`. Cero dependencias nuevas.

## WhatsApp — Meta Cloud API

Módulo nuevo `whatsapp` con `WhatsappService` hablando directo contra `https://graph.facebook.com/v20.0/{phone-number-id}/messages`, credenciales por env var (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`).

Punto importante: como el mensaje lo inicia la iglesia (no es respuesta dentro de una conversación abierta por el destinatario), Meta **exige usar una plantilla de mensaje pre-aprobada** — no se puede mandar texto libre. Hay que crear y aprobar en Meta Business Manager una plantilla tipo `convocatoria_culto` con variables (nombre iglesia, título del evento, fecha/hora, ubicación) **antes** de poder mandar el primer mensaje real.

**Esto es lo único que me bloquea para probar esta parte de punta a punta**: puedo escribir la integración contra el contrato documentado de la API ahora mismo, pero necesito que abras (o me des acceso a) una cuenta de Meta Business Manager con WhatsApp Business Platform configurado, un número verificado, y esa plantilla aprobada. El trámite de verificación + aprobación de plantilla tiene demora externa (días, a veces semanas) que no controlamos — conviene iniciarlo ahora, en paralelo, aunque el código recién se pruebe después.

## Anti-abuso y datos personales

- Rate limit por IP en el `POST` público (`@nestjs/throttler`) — nada pesado, solo para frenar bots obvios.
- Campo honeypot oculto en el DTO: si viene con contenido, se descarta la request pero se responde éxito igual (no delatarle al bot que lo detectamos).
- Checkbox de consentimiento obligatorio (`aceptaConsentimiento`), guardado como `consentimientoAt` — dado que es un formulario público pidiendo email/teléfono de gente que no necesariamente tiene cuenta en la plataforma, conviene dejar trazabilidad de que aceptó.
- Link de baja sin login (`bajaToken`), igual patrón que ya usamos para la confirmación de predicadores.

## Qué debe hacer el frontend

**Landing pública `/colaboradores/registro/[qrToken]`** (mobile-first, sin auth): `GET` de los datos de la iglesia al montar; si 404, mensaje de "QR inválido"; muestra logo + nombre de iglesia + "Pastor: Nombre Apellido" + formulario (nombre, apellido, email, teléfono con hint `+56 9...`) + checkbox de consentimiento con texto breve; pantalla de confirmación simple al enviar (sin distinguir "ya estabas registrado" de "te registraste ahora", por privacidad).

**Página pública `/colaboradores/baja/[bajaToken]`**: confirmación simple de "darse de baja", un botón, un `POST`.

**Panel admin** (dentro del dashboard autenticado, sección nueva "Colaboradores"): listado con búsqueda/estado, acciones editar/dar de baja/eliminar; modal o vista "Código QR" que renderiza el QR **del lado del cliente** a partir de la URL pública (librería liviana tipo `qrcode`, no hace falta que el backend genere imágenes) con botón de descarga para imprimir, y botón "Regenerar" con confirmación explícita (avisar que invalida el QR impreso anterior).

**Detalle de Evento**: botón "Convocar a colaboradores" que antes de enviar muestre cuántos destinatarios activos hay, y al volver muestre el resumen parcial (`42/45 WhatsApp, 45/45 email`) en vez de un simple ok/error — los envíos masivos fallan parcialmente por diseño, no hay que ocultarlo.

## Fases sugeridas

1. **Colaboradores + QR + registro público + admin CRUD**, sin ningún canal de notificación todavía. Ya es útil solo (censo de contactos).
2. **Convocatoria por email** — reutiliza `MailService`, se puede probar de inmediato sin depender de nadie externo.
3. **WhatsApp vía Meta Cloud API** — en paralelo, arrancar ya el trámite de verificación en Meta Business Manager y la aprobación de la plantilla, por el lead time externo.

## Qué necesito de tu parte para arrancar

- Confirmar el criterio de roles para gestionar colaboradores (propuse `PASTOR` + `SECRETARIA`).
- Acceso/credenciales de Meta Business Manager + WhatsApp Business Platform cuando lo tengas armado (para fase 3) — si querés, puedo dejarte los pasos exactos de ese trámite en un documento aparte.
