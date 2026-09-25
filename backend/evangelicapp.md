# EvangelicApp — Conversación de venta con una iglesia

*(Guion de un vendedor de EvangelicApp presentando la plataforma al equipo pastoral de una iglesia — pastor, tesorero y secretaria.)*

---

Buenas tardes, pastor. Gracias por recibirme.

Sé que su tiempo vale oro, así que voy directo al grano: ¿cómo llevan hoy la agenda de la iglesia, las finanzas y el registro de la congregación? ¿Cuaderno? ¿Planillas sueltas? ¿WhatsApp para coordinar a los predicadores? Eso es exactamente lo que EvangelicApp reemplaza — con una sola plataforma pensada específicamente para el trabajo de un equipo pastoral, no un programa genérico de oficina adaptado a la fuerza.

Le voy a mostrar los cinco módulos, cómo protegemos los datos de su iglesia, y por qué el módulo de Finanzas es, sin exagerar, lo mejor que tenemos.

## 1. Agenda — coordinación sin llamadas ni malentendidos

Cada culto, reunión o actividad de limpieza queda en un calendario único, visible para todo su equipo. Pero lo importante no es el calendario — es la confirmación:

- Cuando invita a un predicador, él recibe un correo con un link único y confirma o rechaza su participación con un clic, **sin necesitar cuenta ni contraseña**. Usted ve el estado en tiempo real: pendiente, confirmado, rechazado.
- Si quiere avisar a toda la congregación de un evento, con un solo checkbox se les notifica y cada persona puede confirmar su asistencia — también con un link seguro, también sin cuenta. Nada de eso es automático por accidente: usted decide caso a caso cuándo notificar, para que nunca se sienta como spam.
- Cada evento se puede exportar directo a Google Calendar.

## 2. Finanzas — el módulo estrella

Acá está la diferencia real entre EvangelicApp y llevar la plata en un cuaderno o en Excel.

**Trazabilidad total, sin excepciones.** Cada ingreso o egreso queda registrado con quién lo hizo, cuándo, por cuánto y con qué medio de pago (efectivo o transferencia). Pero lo más importante: **si alguien edita o elimina un movimiento, no desaparece nada**. Queda un historial de auditoría inmutable con una fotografía completa de cómo era ese registro antes del cambio. Si en seis meses el tesorero anterior ya no está y hay una pregunta sobre un movimiento de hace un año, la respuesta sigue ahí — no depende de la memoria de nadie.

**Organización por departamentos.** Si su iglesia tiene ministerios con caja propia — música, jóvenes, misiones — puede crear subdepartamentos financieros independientes, cada uno con sus propias categorías (diezmos, ofrendas, arriendo, servicios), pero todo consolidado en la misma vista general cuando el pastor necesita el panorama completo.

**Categorías a su medida.** No le imponemos una lista fija de categorías contables. Las define su propia iglesia, según cómo realmente trabaja.

**Importación y exportación.** Si hoy llevan sus movimientos en una planilla, hay una plantilla de importación para no partir de cero. Y el Tesorero tiene su propia exportación contable para rendir cuentas cuando corresponda.

**Roles claros.** El pastor ve todo. El tesorero gestiona movimientos y categorías. Cada centavo tiene nombre y apellido de quién lo registró.

Este no es un módulo agregado — es el corazón del sistema, y está construido con el mismo estándar de auditoría que usaría un sistema contable profesional, no una hoja de cálculo.

## 3. Notas y tareas — el equipo pastoral coordinado

Recordatorios con fecha límite, asignables a un miembro específico del equipo. La persona asignada marca la tarea como hecha, y queda "en revisión" hasta que el pastor la aprueba — así nada se da por completado sin que usted lo confirme. Las notas completadas se archivan sin perderse, para tener historial de lo que se ha hecho.

## 4. Integrantes — el censo de su congregación, sin planillas

Genera un código QR único de su iglesia. Lo imprime, lo pone en la entrada o lo comparte en pantalla, y cada persona se registra sola desde su celular — nombre, contacto, foto si quiere. El sistema evita duplicados automáticamente, así que si alguien se registra dos veces, no le ensucia el censo. Con el tiempo, esto se convierte en la base de datos real de su congregación, sin que nadie tenga que digitar una sola fila a mano.

## 5. Ceremonias — su libro de actas, pero digital y a prueba de pérdida

Matrimonios, bautizos, defunciones, presentaciones de niños — cada uno con su folio correlativo, igual que el libro físico de toda la vida, pero sin el riesgo de que se moje, se pierda o se queme. El sistema genera automáticamente el certificado en PDF, listo para entregar, con el logo de su iglesia. Y cada emisión queda con historial completo — quién lo generó y cuándo.

## Seguridad — porque estamos hablando de datos reales de personas reales

Sé que esta pregunta siempre está, aunque no siempre se diga en voz alta: "¿qué tan seguro es esto?" Se lo explico sin vueltas:

- **Su iglesia es un compartimento cerrado.** Ningún dato de su iglesia — ni un movimiento financiero, ni un integrante, ni una nota — es visible para ninguna otra iglesia de la plataforma. Es una garantía de arquitectura, no una promesa de buena voluntad.
- **Ni siquiera nosotros vemos el detalle.** El equipo que opera la plataforma administra el alta de iglesias y ve métricas generales de uso — pero no entra al detalle financiero ni operativo interno de su iglesia. Eso es entre usted y su equipo.
- **Permisos a la medida de cada persona.** Usted, como pastor, decide exactamente qué módulos puede ver cada colaborador — uno puede tener acceso solo a Agenda, otro solo a Finanzas, otro a ambos. No es todo o nada.
- **Contraseñas nunca en texto plano** — se guardan encriptadas con el estándar de la industria. Las sesiones usan renovación de token con revocación real: cuando alguien cierra sesión, esa sesión queda muerta de verdad, no solo "vencida a futuro".
- **Protección contra ataques comunes de robo de sesión** (CSRF) en cada acción que modifica datos.
- **Los links públicos de confirmación** (predicadores, asistencia a eventos, registro de integrantes) usan tokens generados criptográficamente, de un solo propósito — no exponen ni comprometen el resto de su información.

## Personalización — su iglesia, a su manera

- **Su logo**, en la plataforma y en cada certificado que emite.
- **Sus propias categorías y departamentos financieros** — usted define cómo organiza su plata, no nosotros.
- **Colores propios para sus eventos** en el calendario.
- **Permisos delegables módulo por módulo**, como ya le conté.
- **Planes según el tamaño de su iglesia:**

| Plan | Usuarios de equipo | Subdepartamentos financieros |
|---|---|---|
| Básico | Hasta 3 | — |
| Medio | Hasta 8 | — |
| **Pro** | Hasta 15 | Hasta 10 |

Si su iglesia tiene varios ministerios con caja propia, el plan Pro es el que le da control financiero completo, departamento por departamento.

## Para cerrar

No le estoy vendiendo un programa genérico de administración con el logo de una iglesia pegado encima. Cada decisión de este sistema — desde cómo se audita un movimiento financiero hasta cómo se confirma un predicador sin que tenga que crear una cuenta — está pensada para cómo trabaja *realmente* un equipo pastoral. Y el módulo de Finanzas, en particular, le va a dar una trazabilidad que probablemente hoy no tiene con cuadernos o planillas sueltas.

¿Partimos con una demo real, con los datos de su propia iglesia?
