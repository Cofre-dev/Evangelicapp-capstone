# EvangelicApp — Contexto de producto y negocio

Este archivo lo lee Claude automáticamente al iniciar cualquier sesión en este repositorio. Contiene el **por qué** del proyecto (negocio/producto). Para el **cómo** técnico (stack, arquitectura, setup), ver [`README.md`](./README.md). Para el historial de cambios, ver [`FEATURES.md`](./FEATURES.md).

## Bitácora obligatoria

Cada vez que Claude haga una modificación en este repositorio (código, config, docs), debe agregar una entrada nueva al final de `FEATURES.md` con fecha y hora, los cambios realizados y para qué sirven. Es un archivo de solo agregar: nunca borrar ni reescribir entradas anteriores. Esto aplica dentro de la misma sesión también — si se hacen varios cambios de una sesión, se puede agrupar en una sola entrada al terminar, pero no se debe cerrar una tarea de modificación sin dejarla registrada.

## Qué es

EvangelicApp es una plataforma de gestión para iglesias evangélicas de Chile: agenda de eventos y predicadores, finanzas (ingresos/egresos con auditoría), y notas/tareas internas del equipo pastoral. El objetivo declarado del fundador es que sea una herramienta seria y duradera, con alcance a nivel nacional — no un MVP desechable.

Este repo es **solo el backend**. El frontend (con el que consume esta API) vive en un repositorio aparte, por decisión deliberada de no usar monorepo.

## Estado actual: pre-lanzamiento

**EvangelicApp todavía no está lanzada a producción.** Ninguna iglesia real usa la plataforma
hoy — todo lo que existe en la base de datos (incluidas "Iglesia Evangélica Demo" y las otras
2 iglesias del seed) es data de prueba/demo, no una iglesia real operando con datos propios.
Ha habido demos puntuales (ej. a inversionistas — ver incidente del 2026-08-07 en memoria de
sesiones anteriores), pero no clientes activos todavía.

**Por qué esto importa para el trabajo en este repo:** varias partes de este documento y de
`docs/supabase.md` hablan de "iglesias reales" o "usuarios reales" al justificar decisiones de
cautela (probar en un proyecto de Supabase separado antes de migrar, no romper aislamiento
multi-tenant, etc.). Esa cautela se mantiene igual — es el objetivo declarado de una
herramienta seria y duradera a nivel nacional lo que la justifica, no que haya negocios reales
en riesgo hoy mismo. Pero antes de que exista la primera iglesia real, hay más margen para
decisiones que después serían mucho más costosas de revertir — vale la pena tenerlo presente al
decidir cuánto esperar antes de avanzar en algo. El cutover completo a Supabase Auth (Fase 7 de
`docs/supabase.md`) y la activación de RLS multi-tenant (Fase 8) ya se hicieron aprovechando ese
margen: ambos están **activos en el backend en línea** desde ~2026-08-25 (ver `FEATURES.md`). Lo
que sigue en esa categoría hoy: elegir pasarela de pago, cambios grandes de esquema o del modelo
de tenant. Actualizar esta sección en cuanto la primera iglesia real empiece a operar en la
plataforma.

## Problema que resuelve

Muchas iglesias evangélicas en Chile hoy gestionan esto de forma manual o dispersa: agenda en papel/WhatsApp, finanzas en cuadernos o planillas sueltas sin trazabilidad, coordinación de predicadores por llamadas. EvangelicApp centraliza eso en una sola plataforma pensada para el equipo pastoral (pastor, tesorero, secretaria), con control de acceso por rol y trazabilidad de lo financiero.

## Modelo de tenant (cómo funciona hoy)

Cada **iglesia** es un tenant independiente y aislado — sus datos (eventos, movimientos financieros, notas, usuarios) nunca se cruzan con los de otra iglesia. La plataforma la opera un **SuperAdmin** (el equipo de EvangelicApp), que:

1. Da de alta una nueva iglesia junto con su **Pastor** (transacción única — no existe iglesia sin pastor a cargo).
2. El pastor recibe credenciales temporales, hace login, cambia su contraseña y completa un onboarding (datos personales + tamaño de la congregación).
3. El pastor invita a su propio equipo — Tesorero y/o Secretaria — quienes ven solo su iglesia.
4. El SuperAdmin tiene un dashboard con visibilidad cruzada (todas las iglesias, distribución por región) para operar la plataforma a nivel nacional, pero **no** ve el detalle financiero/operativo interno de cada iglesia.

Roles y para qué sirve cada uno en términos de negocio:

| Rol | Quién es | Qué hace en la plataforma |
|---|---|---|
| SUPER_ADMIN | Equipo de EvangelicApp (operador de la plataforma) | Alta de iglesias, métricas agregadas a nivel nacional |
| PASTOR | Líder de la iglesia, dueño de la cuenta | Gestiona su equipo, agenda, finanzas, notas/tareas |
| TESORERO | Encargado de finanzas de la iglesia | Movimientos financieros, categorías, export contable, agenda |
| SECRETARIA | Apoyo administrativo de la iglesia | Agenda, sus propias tareas asignadas |

> Nota (2026-08-20): el rol `MIEMBRO` que aparecía aquí se eliminó del sistema — nunca tuvo
> funcionalidad propia y se decidió no mantenerlo modelado "por si acaso". Los roles reales hoy
> son exactamente tres: `SUPER_ADMIN`, `MANAGER` y `USUARIO` (ver `README.md` para el mapeo
> técnico — `MANAGER` es el pastor/dueño del tenant, `USUARIO` reemplaza a tesorero/secretaria).

## Modelo de negocio (a completar)

Esta sección está deliberadamente incompleta — no hay información suficiente en el código o en las conversaciones registradas para documentar esto con certeza, y prefiero dejarlo marcado como pendiente en vez de inventarlo. Antes de tomar decisiones de producto que dependan de esto (límites por plan, features premium, etc.), conviene resolver con el fundador:

- **Monetización**: ¿gratis para las iglesias (financiado por donaciones/patrocinio a nivel de organización), suscripción mensual por iglesia, freemium (agenda gratis, finanzas de pago), u otro esquema?
- **Quién paga**: ¿la iglesia individual, una denominación/asociación que agrupa varias iglesias, un patrocinador externo?
- **Métrica de éxito del negocio**: ¿número de iglesias activas, iglesias que completan onboarding, retención mes a mes, algo distinto?
- **Estrategia de distribución**: ¿alguna denominación/red de iglesias como canal de entrada, o adopción iglesia por iglesia?
- **Alcance geográfico real del roadmap**: el modelo de datos ya soporta multi-región (`Iglesia.region`, `Iglesia.comuna`) pensando en escala nacional — confirmar si el lanzamiento es gradual (una región primero) o nacional desde el inicio.

Cuando el usuario entregue esta información, reemplazar esta sección con el modelo real (no dejar ambas versiones).

## Prioridades al trabajar en este repo

Dado el objetivo de que esto persista en el tiempo y tenga impacto nacional:

- **Confiabilidad sobre velocidad**: este software está construido para manejar datos financieros y personales de organizaciones religiosas reales (aunque hoy, pre-lanzamiento, todavía no hay ninguna — ver "Estado actual" arriba); preferir la solución robusta aunque tome más tiempo, pensando en cuando sí los haya.
- **No romper el aislamiento multi-tenant** bajo ninguna circunstancia — es la garantía de seguridad más importante del sistema (ver patrón `iglesiaId` desde JWT en `README.md`).
- **Mantener el patrón existente** en vez de introducir uno nuevo por endpoint/módulo — la consistencia importa más que la elegancia local.
- Antes de agregar una dependencia o reescribir algo grande, confirmar con el usuario — es un proyecto en etapa temprana pero con intención de largo plazo, no un prototipo para tirar.
