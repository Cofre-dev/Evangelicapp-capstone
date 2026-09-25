# web.md — Brief de diseño y contenido para la landing de Evangelicapp

> Destinatario: diseñador/a web + el/la desarrollador/a que va a maquetar. Este documento **no define la estructura de página a página** (secciones, orden, wireframe) — eso ya viene resuelto en las plantillas que se van a usar. Lo que sí define, con el máximo detalle posible: identidad visual completa (colores, tipografía, dimensiones), cuántas landings necesita el sitio y para qué sirve cada una, el contenido y valor de cada módulo del producto (con Finanzas como prioridad), y las métricas/KPIs a comunicar. Todo está sacado del código real de la app (`frontend/src/`), no inventado desde cero — la idea es que la landing se sienta como la puerta de entrada natural al producto real, no como un wrapper de marketing genérico pegado encima.

---

## 0. Cómo usar este documento

1. **Identidad visual (sección 3)**: es la fuente de verdad. Todos los valores de color están sacados literalmente de `frontend/src/app/globals.css` y `tailwind.config.ts`, no aproximados a ojo — así la landing y la app comparten el mismo lenguaje visual exacto el día que un visitante hace clic en "Probar gratis" y entra al producto real.
2. **Landings (sección 4)**: dice cuántas páginas necesita el sitio y qué debe comunicar cada una. No dicta layout — eso lo resuelven las plantillas.
3. **Módulos (sección 5)**: el contenido real que hay que redactar/diagramar. Cada módulo trae una historia de usuario (persona real, situación antes/después), qué hace técnicamente, el valor agregado en lenguaje de beneficio, y un ícono/color sugerido ya coherente con el resto del sistema. **Finanzas va primero y con más profundidad** — es el módulo estrella, a pedido explícito.
4. **KPIs (sección 6)**: números para usar como titulares ("ahorra X horas al mes", etc.), con el cálculo detrás de cada uno a la vista. Están marcados `[ESTIMADO]` porque son proyecciones razonadas a partir del flujo de trabajo real que el producto reemplaza, **no datos verificados de clientes todavía** — hay que decirlo así internamente y, ojalá, reemplazarlos por datos reales de las primeras iglesias piloto en cuanto existan. Publicar un número cuantificado como si fuera un dato verificado sin tenerlo es un riesgo real de marketing engañoso (Chile: Ley del Consumidor / SERNAC) — mejor un "hasta" o un asterisco con la metodología, como se dejó acá.
5. **Especificaciones técnicas (sección 7)**: performance, accesibilidad, SEO, breakpoints exactos, specs de assets a entregar.

---

## 1. Qué es Evangelicapp (resumen ejecutivo)

**Evangelicapp es el sistema operativo administrativo de una iglesia evangélica chilena.** Reemplaza la combinación real que hoy usa casi cualquier iglesia — un cuaderno de actas, una planilla de Excel que vive en el celular de la tesorera, grupos de WhatsApp para coordinar todo, y un libro físico para matrimonios/bautizos — por una sola plataforma web, multi-usuario, con roles y permisos, pensada específicamente para el vocabulario y los procesos de una iglesia (cultos, departamentos, diezmos y ofrendas, ceremonias, censo de congregación), no para una empresa genérica con la palabra "iglesia" pegada encima.

**Categoría**: SaaS vertical B2B (con un componente B2C liviano: cualquier persona de la congregación interactúa con partes públicas del producto — QR de registro, confirmación de asistencia, respuesta de predicación — sin crear cuenta).

**Multi-tenant real**: cada iglesia es un tenant aislado con sus propios datos, su propio equipo, su propio plan comercial y su propia URL de acceso vía QR/links públicos. Evangelicapp (la empresa) administra todas las iglesias desde un panel SuperAdmin — es, en el fondo, una plataforma para operar decenas o cientos de iglesias a la vez, no una app de una sola congregación.

**La tesis central del producto — y de la landing**: una iglesia vive y muere por la confianza de su congregación, y esa confianza se construye en dos terrenos muy concretos — **la transparencia del dinero** (¿a dónde va la ofrenda?) y **la organización del tiempo** (¿el culto empieza cuando dice que empieza? ¿alguien se acuerda de avisarme del bautizo de mi sobrino?). Evangelicapp ataca los dos al mismo tiempo, pero el primero — finanzas — es donde el producto es más profundo, más diferenciado, y donde vive el mayor valor percibido. Por eso es el módulo estrella de la comunicación.

**A quién le habla**:
- El **Manager** (dueño de la cuenta — típicamente el pastor principal o quien administra la iglesia): quiere control y visibilidad total sin tener que operar él mismo cada detalle.
- El **Usuario delegado** (tesorero, secretaria, encargado de un departamento): opera un módulo específico que el Manager le habilitó, sin ver lo que no le corresponde.
- El **congregante/integrante**: nunca crea una cuenta, pero toca el producto en varios puntos (QR de registro, confirmación de asistencia a un evento, respuesta a una invitación de predicación) — su experiencia ahí también construye o destruye confianza en la marca.

---

## 2. A quién le hablamos: personas y sus historias

Estas cuatro personas son la base narrativa de toda la landing. No son arquetipos genéricos de SaaS ("Busy Manager Persona") — están construidas directamente sobre los cuatro roles reales del sistema (`SUPER_ADMIN`, `MANAGER`, `USUARIO`, y el congregante sin cuenta) y sobre flujos que existen de verdad en el producto.

### Persona 1 — Pastor Ricardo, 54 años, Manager de una iglesia de ~180 personas en San Bernardo

Ricardo administra su iglesia hace 22 años. Tiene un teléfono con demasiados grupos de WhatsApp, una libreta para las visitas pastorales, y confía en Marcela (la tesorera, voluntaria, contadora de profesión) para las finanzas — pero cada vez que el concilio le pide un informe, Marcela tiene que armarlo a mano desde tres planillas distintas (una por departamento: Jóvenes, Damas, general).

> **Historia de usuario**: Como Manager de mi iglesia, quiero ver en un solo lugar el estado financiero, la agenda de la semana y las tareas pendientes de mi equipo, para poder tomar decisiones y rendir cuentas sin depender de que alguien me arme un resumen a mano.

Lo que cambia con Evangelicapp: Ricardo abre el panel y ve, sin pedirle nada a nadie, el balance del mes, los próximos eventos, y qué tareas están atrasadas. Cuando el concilio pide el informe trimestral, es un clic de exportar — no una noche de trabajo de Marcela.

### Persona 2 — Marcela, 47 años, tesorera voluntaria (rol Usuario, módulo Finanzas delegado)

Contadora de profesión, tesorera de su iglesia por vocación, no por trabajo — le dedica un par de horas a la semana, no una jornada completa. Antes de Evangelicapp, cuadrar el mes significaba juntar boletas físicas, un Excel por departamento, y confiar en su propia memoria para no duplicar ni olvidar un registro.

> **Historia de usuario**: Como tesorera, quiero registrar cada ingreso y egreso apenas ocurre, con su categoría y medio de pago, para no tener que reconstruir el mes completo el día 28 con una pila de boletas sobre la mesa.

Lo que cambia: cada movimiento se registra en el momento, categorizado, con su departamento correcto. El día que el concilio pide cuentas, Marcela no arma nada — exporta. Y si alguien pregunta "¿por qué esa boleta no está?", el historial de auditoría (quién registró qué y cuándo) responde sin que ella tenga que defenderse de memoria.

### Persona 3 — Camila, 29 años, secretaria (rol Usuario, módulos Agenda + Ceremonias + Integrantes delegados)

Coordina la agenda de cultos, actividades y ceremonias. Antes: un grupo de WhatsApp para confirmar quién predica, llamadas una por una para saber quién va al retiro, y un cuaderno para anotar matrimonios y bautizos con el folio a mano.

> **Historia de usuario**: Como secretaria, quiero mandar la invitación de un evento y ver en tiempo real quién confirmó, quién rechazó y quién no ha respondido, para no tener que llamar uno por uno la noche anterior.

Lo que cambia: crea el evento, marca "avisar a la congregación", y el sistema manda el correo con RSVP de un clic. El día del evento, Camila ya sabe cuántas sillas necesita sin haber hecho una sola llamada.

### Persona 4 — Un integrante nuevo, cualquier edad, sin cuenta ni contraseña

Llega un domingo por primera vez. Ve un afiche con un código QR en la entrada. Lo escanea, ve el nombre y el logo de la iglesia (así sabe que no es un link raro), deja su nombre, correo, teléfono y opcionalmente una foto, y en menos de un minuto ve una tarjeta con su nombre: "Miembro desde 2026".

> **Historia de usuario**: Como visitante, quiero dejar mis datos de contacto sin tener que crear una cuenta ni hablar con nadie si no quiero, para sentirme parte sin fricción ni compromiso forzado.

Este momento — sin login, sin fricción, con una respuesta cálida instantánea — es probablemente el punto de contacto más emocional de todo el producto, y vale la pena que la landing lo muestre tal cual se ve en la app real (la pantalla usa `font-display` en itálica color primario para el "¡Gracias, {nombre}!" — es, literalmente, el mismo momento de calidez que se puede reproducir en el hero de una landing).

---

## 3. Identidad visual: el sistema de diseño real de la app

Esta no es una paleta propuesta desde cero — es la paleta que ya está en producción, sacada línea por línea de `frontend/src/app/globals.css` y `tailwind.config.ts`. El criterio de diseño (ver principios de diseño de producto aplicados): **la landing debe poder pasarle el testigo a la app sin que el visitante note el cambio de color, tipografía o forma**. Es, en sí mismo, el "elemento de firma" de este sitio: no es un micro-interacción o una animación puntual, es la continuidad total entre promesa (marketing) y producto (app) — algo que casi ningún SaaS hace bien y que acá cuesta cero, porque el sistema ya existe.

### 3.1 Paleta de colores

#### Núcleo de marca (idéntico a `:root` en `globals.css`)

| Token | HSL (fuente, no aproximar) | HEX aprox. | Uso |
|---|---|---|---|
| `background` | `hsl(210, 60%, 98%)` | `#F7FAFD` | Fondo base de toda la app — blanco con un tinte azul frío casi imperceptible, nunca blanco puro |
| `foreground` | `hsl(215, 28%, 24%)` | `#2C3A4E` | Texto principal — gris azulado oscuro, nunca negro puro |
| `card` | `hsl(0, 0%, 100%)` | `#FFFFFF` | Fondo de tarjetas/paneles, contraste sutil contra `background` |
| `primary` | `hsl(199, 84%, 62%)` | `#4DBCEF` | **El azul cielo de marca.** Botones primarios, links, acentos de identidad, el ícono de iglesia del login |
| `primary` (glow, variante clara) | `hsl(199, 84%, 70%)` | `#72CAF3` | Usado en resplandores/blur decorativos detrás de paneles (ver login) |
| `secondary` | `hsl(200, 45%, 94%)` | `#E9F2F7` | Fondos secundarios muy suaves, superficies de apoyo |
| `muted` | `hsl(210, 40%, 96%)` | `#F1F5F9` | Fondos neutros (barras vacías, placeholders) |
| `muted-foreground` | `hsl(215, 16%, 47%)` | `#65758B` | Texto secundario/metadata (fechas, labels pequeños) |
| `accent` | `hsl(187, 60%, 90%)` | `#D6F1F5` | Turquesa muy pálido, resaltados suaves (ítem activo en menú) |
| `destructive` | `hsl(0, 72%, 51%)` | `#DC2828` | Errores, acciones destructivas, alertas de mora/vencimiento |
| `border` | `hsl(210, 30%, 89%)` | `#DBE3EB` | Bordes de tarjetas, inputs, separadores |
| **`chart-accent`** | `hsl(16, 75%, 58%)` | `#E46E44` | **Terracota/naranja — reservado en el propio código exclusivamente para visualizar tiempo/actividad** (heartbeat de uso, minutos en la app). Ver nota abajo. |

> **Nota sobre `chart-accent` (terracota `#E46E44`)**: en el código real, este color está deliberadamente separado del resto para que "un canal de dato = un color" — nunca se usa para navegación ni identidad, solo para visualizaciones de tiempo/actividad. Es, sin buscarlo, el color perfecto para la sección de KPIs de "tiempo ahorrado" de la landing (sección 6): usar exactamente este naranja ahí — ni un naranja genérico de stock de íconos — crea una asociación de color consistente entre "esto mide tiempo" en el marketing y "esto mide tiempo" en el producto real. **Este es el acento de firma sugerido para toda la narrativa de KPIs de tiempo ahorrado.**

#### Gradiente hero (idéntico al panel de marca del login real, `src/app/login/page.tsx`)

El login ya resolvió "cómo se ve el hero de marca de Evangelicapp" — un gradiente diagonal de 160° con tres paradas, más dos manchas de resplandor (`blur-3xl`) detrás. Reusar exactamente esto para el hero de Home (y opcionalmente Finanzas) en vez de inventar un gradiente nuevo:

```
Gradiente: linear-gradient(160deg, #2FA4DA 0%, #2170A1 55%, #183659 100%)
           (hsl(199 70% 52%) → hsl(203 66% 38%) → hsl(212 58% 22%))

Resplandor 1: radial-gradient, centro 30% 20%, blanco al 16% de opacidad, desvanece a 55%
Resplandor 2: círculo blur-3xl, #72CAF3 al 35% de opacidad, esquina superior derecha
Resplandor 3: círculo blur-3xl, hsl(210 60% 30%) al 50% de opacidad, esquina inferior izquierda
```

Sobre este fondo: texto e íconos siempre en blanco (`primary-foreground`), nunca `foreground` oscuro.

#### Colores semánticos financieros (Tailwind estándar, ya en uso en toda la app — no cambiar por ningún motivo, es el lenguaje visual que la gente de finanzas ya reconoce)

| Concepto | Clase Tailwind | HEX | Dónde se usa hoy |
|---|---|---|---|
| **Ingreso / positivo** | `emerald-400` a `emerald-700` | `#34D399` → `#047857` | Barras, badges "Ingreso", montos positivos, línea de ingresos en el gráfico de analítica |
| **Egreso / atención** | `amber-400` a `amber-700` | `#FBBF24` → `#B45309` | Barras, badges "Egreso", montos negativos, línea de egresos |

**Regla de oro para la landing**: en cualquier pieza visual que hable de dinero (mockups, íconos, gráficos ilustrativos de la sección Finanzas), usar **siempre** verde esmeralda para ingreso/positivo y ámbar para egreso/atención — nunca rojo para "egreso" (el rojo está reservado a `destructive`, errores reales) ni verde/rojo genéricos de stock.

#### Extensión de marca solo-marketing (nueva, no está en el código — para dar variedad sin romper el sistema)

La paleta de la app es funcional por diseño (UI de trabajo diario), así que para las piezas más "editoriales" de la landing (hero, ilustraciones grandes, fondos de sección) se puede respirar con dos variantes tonales del mismo azul de marca, nunca con un color ajeno a la familia:

- **Azul profundo de marca** (para fondos de sección oscuros, footer): `hsl(212, 58%, 14%)` ≈ `#0F2338` — una parada más abajo que el extremo oscuro del gradiente del login, coherente con la misma familia.
- **Celeste de respiro** (para fondos de sección alternos, no blancos): `hsl(199, 60%, 96%)` ≈ `#EAF6FC` — más saturado que `background` pero igual de liviano, para alternar secciones sin salirse de la familia cromática.

No introducir un tercer color de acento "de marketing" (ej. un violeta o un verde-menta que no exista en el producto) — sería exactamente el tipo de identidad desconectada de la app real que este documento busca evitar.

### 3.2 Tipografía

La app ya define un pairing deliberado y con personalidad (`src/app/layout.tsx`, `tailwind.config.ts`) — **usar exactamente el mismo, no un pairing "parecido"**:

- **Cuerpo / UI / funcional**: **Inter** (Google Fonts, variable, `subsets: latin`). Todo el texto de trabajo: párrafos, labels, botones, tablas, formularios, navegación.
- **Display / momentos cálidos**: **Playfair Display** (Google Fonts, cargada como `--font-display`, mapeada a `font-display` en Tailwind, con fallback `serif`). En la app se usa **siempre en itálica** y casi siempre en `text-primary`, reservada para los momentos de mayor carga emocional o de mayor jerarquía: el nombre "Evangelicapp" en el login, el titular "¡Gracias, {nombre}!" al registrarse por QR, los números grandes de los stat tiles del dashboard (`text-5xl font-display tabular-nums`), el nombre protagonista en el detalle de una ceremonia ("Juan y María").

**Para la landing**: el titular principal del hero de cada página (`H1`) va en Playfair Display itálica, igual que "Evangelicapp" en el login — es la firma tipográfica de la marca. Subtítulos y todo el cuerpo de copy van en Inter. Nunca usar Playfair en párrafos largos (es una serif de alto contraste, pensada para tamaños grandes y frases cortas, no para bloques de lectura).

**Tratamiento numérico**: cualquier cifra destacada (precios, KPIs, montos de ejemplo en CLP) debe llevar `font-variant-numeric: tabular-nums` (clase Tailwind `tabular-nums`) — la app ya lo hace en todos los stat tiles para que los dígitos no "bailen" al animarse o compararse en columna. Es un detalle chico que un ojo financiero nota de inmediato.

**Escala tipográfica sugerida** (extendiendo la que ya usa la app: `text-sm`/`text-xl`/`text-2xl`/`text-3xl`/`text-5xl` de Tailwind por defecto — 0.875rem / 1.25rem / 1.5rem / 1.875rem / 3rem):

| Uso | Tamaño | Familia | Peso/estilo |
|---|---|---|---|
| H1 hero (por página) | 3rem–4.5rem (48–72px), responsive | Playfair Display | Italic, `text-balance` |
| H2 de sección | 1.875rem–2.25rem (30–36px) | Playfair Display o Inter semibold | Italic si es un momento cálido, Inter si es un título funcional ("Preguntas frecuentes") |
| H3 / título de tarjeta de módulo | 1.25rem (20px) | Inter | Semibold |
| Cuerpo | 1rem (16px), `line-height: 1.6` | Inter | Regular |
| Cifra destacada / KPI | 2.25rem–3.75rem | Playfair Display o Inter, `tabular-nums` | Semibold/Bold |
| Label / eyebrow / metadata | 0.75rem–0.875rem, uppercase, tracking amplio | Inter | Medium, `text-muted-foreground` |

### 3.3 Espaciado, grilla y dimensiones

Tomado directo de `tailwind.config.ts` (que usa los breakpoints por defecto de Tailwind, sin overrides) y de los contenedores reales de cada página:

- **Breakpoints**: `sm` 640px · `md` 768px · `lg` 1024px · `xl` 1280px · `2xl` 1536px. El propio contenedor global de Tailwind (`container`) está centrado, con `padding: 2rem` y tope de ancho `1400px` en `2xl`.
- **Anchos de contenido observados en la app real**: `max-w-4xl` (896px) para vistas de trabajo densas tipo tabla (Finanzas — movimientos), `max-w-6xl` (1152px) para dashboards con múltiples columnas (Finanzas — analítica). Para la landing, un contenedor de **1152px–1280px** de ancho máximo para el cuerpo de contenido es coherente con lo que ya usa el producto — evitar anchos "de agencia" de 1440px+ que no tienen relación con la app.
- **Radios de borde**: el token `--radius` está en `0.75rem` (12px) y alimenta los componentes base de shadcn/ui (`rounded-md`≈10px para inputs/botones pequeños, `rounded-sm`≈8px). **Pero las tarjetas/paneles de contenido en toda la app usan consistentemente `rounded-2xl` de Tailwind (16px)** — dashboards, stat tiles, tarjetas de módulo, diálogos. Para la landing: **16px en tarjetas y bloques de contenido, 10–12px en botones e inputs**, `rounded-full` en badges/píldoras (así se usan los chips "Ingreso"/"Egreso" y los selectores de vista de agenda).
- **Sombra**: `shadow-sm` de Tailwind (muy sutil) es el único nivel de elevación usado en toda la app — nunca sombras dramáticas. Mantener esa contención en la landing; una landing con sombras mucho más pesadas que la app se va a sentir como "otro producto".
- **Padding de página**: la convención más reciente del código es mobile-first `p-4 sm:p-8` (16px en mobile, 32px desde 640px) — coherente para el padding lateral de secciones de la landing en mobile vs. desktop.

### 3.4 Iconografía

**Librería**: `lucide-react` — trazo fino, esquinas redondeadas, 1.5–2px de grosor. No mezclar con otra librería de íconos (Font Awesome, Heroicons, etc.) ni con ilustraciones flat de stock — rompe la coherencia de inmediato.

Cada módulo ya tiene un ícono asignado en el código real — **reusar exactamente estos, no reinterpretarlos**, para que el icono que alguien ve en el marketing sea el mismo que va a reconocer dentro de la app:

| Módulo | Ícono (lucide-react) |
|---|---|
| Finanzas | `Wallet` (usado en el panel del login) / `LineChart` para la vista de Analítica |
| Agenda | `CalendarDays` |
| Notas / Tareas | `NotebookPen` |
| Ceremonias — Matrimonios | `Heart` |
| Ceremonias — Bautizos | `Droplet` |
| Ceremonias — Defunciones | `Flower2` |
| Ceremonias — Presentaciones | `Baby` |
| Integrantes (censo QR) | `QrCode` |
| Equipo | `Users` |
| Identidad de marca / iglesia | `Church`, `Building2` (respaldo cuando no hay logo) |
| Perfil de usuario (placeholder) | `UserRound` |
| Auditoría / logs | `FileClock` |
| Notificaciones / avisos | `Bell`, `Mail`, `AlertTriangle` |

### 3.5 Imágenes y capturas de producto

- El producto real ya tiene una identidad visual fuerte y fotogénica (kanban de tareas a color, gráficos de ingreso/egreso en verde y ámbar, certificados con folio, tarjetas de bienvenida en itálica) — **priorizar capturas reales de la UI por sobre ilustraciones genéricas o mockups de dispositivo con contenido inventado**. Es más creíble y más barato de producir.
- Para fotografía de personas (heroes, sección "Nosotros", testimonios eventuales): comunidades reales, diversidad etaria real de una congregación chilena (no el stock genérico de oficina corporativa con gente en sus 20-30 años en ropa de tecnología). Luz natural, cálida, nunca el filtro azul frío corporativo típico de SaaS B2B genérico.
- **Logo**: existe `frontend/logo.png` (2048×2048px, PNG). Es el asset fuente de mayor resolución disponible — pedir al diseñador que derive de ahí: favicon (32×32, 180×180 para Apple touch icon), variante monocromática blanca (para usar sobre el gradiente hero oscuro), y un lockup horizontal con el nombre "Evangelicapp" en Playfair Display itálica (replicando el tratamiento ya usado junto al ícono `Church` en el login) para el header del sitio.
- **Imagen Open Graph** (para compartir en redes/WhatsApp — muy relevante, este producto se comparte boca a boca entre iglesias): 1200×630px, fondo con el gradiente hero de marca, logo + titular corto.

### 3.6 Movimiento (motion)

La app es deliberadamente sobria en animación (documentado explícitamente en comentarios del código: se evitó agregar librerías de gráficos o motion "que se sienta generado por IA", priorizando SVG simple y transiciones nativas). **Seguir el mismo criterio en la landing**:

- Una secuencia de entrada orquestada en el hero (fade + slight rise, ~400–600ms, easing suave) está bien — es un único momento, no un efecto repetido en cada scroll.
- Micro-interacciones en hover de tarjetas de módulo: elevación sutil o cambio de borde, nunca escalado exagerado ni rotación 3D.
- Nada de scroll-jacking, parallax pesado, ni contadores que "cuentan hacia arriba" en cada KPI si no aportan información real — si se anima un número, que sea una sola vez, con propósito (ej. la cifra de tiempo ahorrado en el color terracota de la sección 3.1).
- Respetar `prefers-reduced-motion` en todo momento.

### 3.7 Voz y tono de copy

- **Español chileno, natural, sin anglicismos de sistema**: nunca "tenant", "endpoint", "dashboard" en copy público (sí "panel"), nunca "usuario" en el sentido técnico de account cuando se puede decir "tu equipo" o "las personas de tu iglesia".
- **Voz activa, verbos concretos**: "Registra un movimiento en segundos", no "Los movimientos pueden ser registrados". Un botón dice exactamente lo que va a pasar.
- **Nombrar las cosas como las nombra quien las usa, no como las nombra el sistema**: "diezmos y ofrendas", "el libro de matrimonios", "el QR de la entrada" — vocabulario de iglesia, no de software.
- **Sin venta agresiva ni superlativos vacíos**: nada de "la mejor plataforma del mercado" sin sustento. El tono es el de alguien que conoce genuinamente el día a día de una iglesia chilena (voluntariado, poco tiempo, mucha responsabilidad) y ofrece ayuda concreta, no una promesa inflada.
- **Los KPIs siempre con su base de cálculo visible o accesible** (aunque sea en un tooltip/nota al pie) — ver sección 6.

---

## 4. Cuántas landings necesita el sitio, y qué debe decir cada una

**9 documentos/páginas para el lanzamiento v1** (más un ítem opcional a futuro, marcado abajo). Para cada una: propósito, intención de búsqueda/tráfico, y qué contenido tiene que estar presente — sin dictar layout, eso lo resuelven las plantillas.

### 1. Home (`/`)
**Propósito**: convertir tráfico frío (recomendación boca a boca entre pastores, búsqueda genérica) en un lead o en un "quiero ver más". Es la única página que tiene que resumir *todo* el producto en capas de profundidad creciente.
**Debe incluir**: la tesis central (transparencia financiera + organización = confianza de la congregación), un resumen visual de los módulos con su valor en una frase cada uno (con Finanzas destacado por sobre el resto, no en igualdad de peso visual con los demás), al menos 2–3 KPIs cuantificados de la sección 6, prueba visual real de producto (capturas reales, no mockups inventados), y llamadas a la acción claras hacia Precios y hacia Contacto/Demo.

### 2. Funcionalidades / Producto (`/producto` o `/funcionalidades`)
**Propósito**: para quien ya está evaluando en serio y quiere el detalle de cada módulo antes de decidir. Es la página más larga y más técnica de contenido (aunque no de lenguaje).
**Debe incluir**: los 8 módulos de la sección 5 completos, cada uno con su historia de usuario, su detalle funcional real, y su valor — en el mismo orden de prioridad que este documento (Finanzas primero).

### 3. Finanzas (`/finanzas` o `/finanzas-para-iglesias`) — página dedicada
**Propósito**: página de conversión y SEO específica para el dolor #1 (transparencia y control del dinero de la iglesia). Quien llega buscando "cómo controlar las finanzas de mi iglesia" o similar aterriza directo acá, no tiene que pasar por el resto del producto primero.
**Debe incluir**: todo el contenido de la sección 5.0 de este documento (la más extensa), la historia de Marcela completa, capturas reales del dashboard de analítica (gráfico de líneas ingreso/egreso, desglose por departamento), y los KPIs financieros de la sección 6 en primer plano.

### 4. Precios y Planes (`/precios`)
**Propósito**: transparencia comercial — los 3 planes reales del producto (Básico/Medio/Pro), con sus topes reales de usuarios y de subdepartamentos financieros. Nada de "contactar para cotizar" como único camino; el modelo ya es simple y hay que mostrarlo así.
**Debe incluir**: los 3 planes con sus diferencias reales (topes de usuarios, si incluye subdepartamentos de Finanzas o no), y una nota honesta sobre el modelo de pago actual (confirmación manual, sin pasarela automática todavía — mejor decir "nuestro equipo confirma tu pago personalmente" en tono cercano que insinuar un checkout automático que no existe).

### 5. Nosotros / Quiénes somos (`/nosotros`)
**Propósito**: confianza — quién construye esto y por qué. Muy relevante en un producto que maneja el dinero de una comunidad religiosa: la gente quiere saber quién está detrás antes de confiarle sus finanzas.
**Debe incluir**: la motivación del producto (nace de un problema real de gestión eclesiástica en Chile), el compromiso con la transparencia y protección de datos, y un canal de contacto humano.

### 6. Preguntas frecuentes (`/faq`)
**Propósito**: resolver objeciones de compra antes del contacto directo, reducir fricción de venta.
**Debe incluir** (temas mínimos, no el texto final): cómo funciona el cobro/facturación manual, qué pasa si la iglesia se atrasa en el pago (el producto ya maneja esto con un semáforo de mora y una pantalla de cuenta suspendida — comunicarlo con transparencia, no esconderlo), quién puede ver los datos financieros dentro de la iglesia (control de accesos por rol), qué pasa con los datos si la iglesia deja de usar el servicio, si los feligreses necesitan crear una cuenta (no, ver QR de Integrantes), y soporte/onboarding.

### 7. Contacto (`/contacto`)
**Propósito**: capturar el lead — ya sea para agendar una demo o para que una iglesia interesada escriba directo.
**Debe incluir**: formulario simple (nombre, iglesia, correo, teléfono, mensaje) y un canal directo alternativo (correo/WhatsApp), coherente con `contacto@evangelic.app` ya usado en el producto real como canal de soporte.

### 8. Términos y Condiciones (`/terminos`)
**Propósito**: documento legal — uso del servicio, límites de responsabilidad, condiciones de los planes.

### 9. Política de Privacidad (`/privacidad`)
**Propósito**: documento legal, especialmente sensible acá porque el producto procesa datos personales de menores (presentaciones, ceremonias), datos de contacto de feligreses (censo QR) y datos financieros de la organización. Debe alinearse con la **Ley 19.628 sobre Protección de la Vida Privada** de Chile (marco vigente al día de hoy — si para cuando se publique el sitio ya rige la Ley 21.719 de nueva Agencia de Protección de Datos, actualizar la referencia). Recomendado tratarla como página separada de Términos, no fusionada, por claridad legal y de SEO.

> **Opcional / roadmap, no contar en el v1**: una sección de Blog/Recursos (contenido de valor para pastores y tesoreros — ej. "cómo llevar la contabilidad de una iglesia en Chile") es una palanca de SEO orgánico fuerte a mediano plazo, pero no es necesaria para el lanzamiento. No planificarla en el v1 salvo que el proyecto lo pida explícitamente.

---

## 5. Los módulos del producto (contenido central)

Formato por módulo: **historia de usuario** (persona + antes/después) → **qué hace, en detalle técnico real** → **valor agregado** → **color/ícono**.

### 5.0 FINANZAS — el módulo estrella

**Color de sección**: `primary` (azul de marca) para el marco general, con `emerald` (ingreso) y `amber` (egreso) como el lenguaje cromático interno — igual que en la app real. Ícono: `Wallet` / `LineChart`.

#### La historia de Marcela, completa

Antes de Evangelicapp, el cierre de mes de Marcela se veía así: juntar las boletas físicas de la semana, revisar tres chats de WhatsApp donde distintos líderes de departamento le avisaban de un gasto, actualizar tres planillas de Excel por separado (una por departamento — Jóvenes, Damas, Ministerio General), y después consolidar las tres a mano en una cuarta planilla para el informe que el concilio pide cada trimestre. Si alguien preguntaba "¿por qué no está el gasto del retiro de jóvenes?", la respuesta dependía de que Marcela se acordara o encontrara la boleta física entre papeles.

Con Evangelicapp: cada movimiento (ingreso o egreso) se registra en el momento — con fecha, tipo, medio de pago, categoría y departamento. El dashboard financiero muestra en tiempo real ingresos, egresos y balance, tanto general como por departamento. No hay una planilla por departamento que consolidar a mano: cada "sub-libro" de departamento vive dentro del mismo sistema y se puede exportar consolidado con un clic. Si alguien pregunta por un movimiento puntual, el historial de auditoría (quién lo registró, cuándo, qué cambió) responde solo — Marcela no tiene que defender su memoria.

> **Historia de usuario**: "Como tesorera de mi iglesia, quiero un sistema donde cada ingreso y egreso quede registrado con su categoría y su departamento en el momento en que ocurre, para que el cierre de mes sea revisar un resumen ya armado — no reconstruir el mes completo desde cero."

#### Qué hace, en detalle (esto es real, no aspiracional — está construido y funcionando hoy)

- **Registro de movimientos**: ingresos y egresos con fecha, monto (formato CLP nativo), tipo, medio de pago, categoría (creable sobre la marcha) y descripción. Cada movimiento se puede editar o eliminar con confirmación por contraseña (protección extra en una acción sensible).
- **Departamentos / sub-libros financieros**: una iglesia puede llevar la contabilidad de "Finanzas general" y, además, un libro separado por cada departamento (Jóvenes, Damas, Escuela Dominical, etc. — a discreción de cada iglesia). Cada departamento se puede archivar (conserva su historial, deja de recibir movimientos nuevos) sin perder ni un dato. **Disponible en el plan Pro** — un diferenciador comercial real, no solo de producto (ver sección Precios).
- **Dashboard financiero**: totales de ingresos/egresos/balance del mes, desglose por categoría (barras horizontales, verde para ingreso y ámbar para egreso), y desglose por departamento cuando se está viendo "Finanzas general" — cuánto aporta cada departamento al total de la iglesia.
- **Analítica anual** (`/finanzas/analitica`): vista de año calendario completo — totales anuales, un gráfico de líneas de ingresos vs. egresos mes a mes, el top 6 de categorías de ingreso y de egreso del año, y el mismo desglose por departamento pero acumulado en los 12 meses. Es la vista que responde "¿cómo venimos este año?" sin que nadie tenga que sumar nada a mano.
- **Importar movimientos**: carga masiva desde una plantilla Excel — para la migración inicial desde la planilla que la iglesia ya tenía, sin perder el historial previo.
- **Exportar a Excel**: el mes actual de un departamento puntual, o "todo consolidado" (todos los departamentos + general en un solo archivo) — un clic, listo para presentar al concilio o para un contador externo.
- **Logs de auditoría descargables**: cada creación/edición/eliminación de un movimiento queda registrada — quién, qué, cuándo — y se puede descargar como `.xlsx`, filtrado por departamento o consolidado. Esto es, en esencia, **transparencia financiera demostrable**, no solo declarada.
- **Categorías por contexto**: las categorías de ingreso/egreso son propias de cada iglesia (o de cada departamento, si aplica) — no hay una lista genérica impuesta, cada iglesia arma su propia taxonomía (diezmo, ofrenda, misiones, arriendo del templo, luz/agua, etc.).

#### Valor agregado (para comunicar, no como lista de features sino como beneficio)

- **De reconstruir el mes a revisarlo**: el trabajo de tesorería deja de ser "juntar y consolidar" y pasa a ser "registrar en el momento y revisar al final" — el esfuerzo se reparte a lo largo del mes en vez de concentrarse en un día de estrés antes del informe.
- **Transparencia que se puede mostrar, no solo prometer**: en una organización que vive de la confianza y la buena fe de su congregación, poder mostrar (no solo decir) que cada peso está categorizado, fechado y trazable a quién lo registró es un activo de credibilidad, no solo una conveniencia operativa.
- **Un libro por departamento sin perder la vista general**: los departamentos de una iglesia grande (Jóvenes, Damas, etc.) manejan su propio presupuesto con autonomía, pero el Manager sigue viendo el consolidado completo sin tener que pedirle el Excel a cada líder de departamento.
- **Cero curva de Excel**: no hace falta saber armar una tabla dinámica ni una fórmula de suma condicional — el dashboard y la analítica ya vienen armados.

### 5.1 Agenda — eventos, predicadores y convocatoria con confirmación en vivo

**Ícono**: `CalendarDays`.

> **Historia de usuario**: "Como secretaria, quiero crear un evento, marcar 'avisar a la congregación' y ver en tiempo real quién va a asistir, para no tener que llamar uno por uno la noche anterior a confirmar cupos."

**Qué hace**: calendario completo con 4 vistas (Día, Semana, Mes, Año — estilo Google Calendar: clic en el número del día abre el detalle de ese día, clic en una franja horaria vacía crea un evento ahí, clic en un evento lo edita). Al crear un evento se puede marcar "avisar a la congregación por correo": cada integrante recibe un email con un link público de un solo uso donde confirma o rechaza asistencia con un clic (sin crear cuenta) y puede agregar el evento a su Google Calendar con otro clic. Quien organiza el evento ve en vivo — sin recargar la pantalla — quién confirmó, quién rechazó y quién no ha respondido todavía. Existe además un flujo paralelo para invitar predicadores a un evento puntual, con la misma lógica de respuesta pública sin cuenta.

**Valor agregado**: pasa de "coordinar por WhatsApp y confiar en la memoria" a "invitar una vez y ver la respuesta en vivo" — elimina la ronda de llamadas de confirmación la noche anterior a un evento.

### 5.2 Notas y tareas — el tablero de trabajo del equipo

**Ícono**: `NotebookPen`.

> **Historia de usuario**: "Como Manager, quiero asignar tareas a mi equipo y ver de un vistazo qué está pendiente, en revisión o completado, para no tener que preguntar el estado de cada cosa por WhatsApp."

**Qué hace**: tablero kanban de 4 columnas (Pendientes / En revisión / Completadas / Archivadas) para tareas asignables, más una vista de grilla tipo notas para apuntes largos sin fecha de vencimiento (minutas, ideas, recordatorios de contexto). Una tarea completada queda bloqueada para edición (solo se puede archivar o eliminar) — evita que el historial de "qué se hizo" se reescriba después.

**Valor agregado**: reemplaza la coordinación dispersa entre WhatsApp, papel y memoria por un solo tablero visible para todo el equipo con acceso.

### 5.3 Ceremonias — el libro físico de matrimonios, bautizos, defunciones y presentaciones, digitalizado

**Ícono**: `Heart` (matrimonios) / `Droplet` (bautizos) / `Flower2` (defunciones) / `Baby` (presentaciones).

> **Historia de usuario**: "Como secretaria, quiero registrar un matrimonio con su folio correlativo y emitir el certificado en el momento, para no depender de un libro físico que se puede perder, mojar o llenar."

**Qué hace**: 4 submódulos idénticos en estructura (matrimonios, bautizos, defunciones, presentaciones), cada uno con folio correlativo automático, formulario específico por tipo de ceremonia, y **emisión de certificado en PDF con el logo y nombre de la iglesia** en un clic — reemplazo directo del libro físico de actas que toda iglesia lleva hoy.

**Valor agregado**: un folio que no se puede perder, un certificado que se genera al instante en vez de escribirse a mano, y un historial buscable de todas las ceremonias oficiadas por la iglesia.

### 5.4 Integrantes — censo de congregación por QR, sin fricción

**Ícono**: `QrCode`.

> **Historia de usuario**: "Como visitante, quiero dejar mis datos escaneando un QR sin tener que crear una cuenta, para sentirme parte de la iglesia sin que sea un trámite."

**Qué hace**: cada iglesia genera su propio código QR (descargable para imprimir, regenerable si se necesita invalidar uno viejo). Quien lo escanea llega a una página pública — ve el logo y nombre de la iglesia para confiar en que es legítimo — y deja nombre, correo, teléfono y opcionalmente una foto. Al instante recibe una tarjeta de bienvenida ("Miembro desde 2026"). El panel administrativo (Manager/secretaria) ve el listado completo y, si el QR está proyectado en pantalla durante un evento, ve aparecer en vivo cada nueva persona que se registra — pensado explícitamente para censar en el momento de un culto o actividad de bienvenida.

**Valor agregado**: elimina por completo la transcripción manual de fichas de papel a una planilla — el dato lo ingresa la propia persona, una sola vez, desde su celular.

### 5.5 Equipo y Accesos — quién puede ver y hacer qué

**Ícono**: `Users`.

> **Historia de usuario**: "Como Manager, quiero darle a mi tesorera acceso solo a Finanzas y a mi secretaria acceso solo a Agenda e Integrantes, para que cada quien vea únicamente lo que le corresponde — sin tener que darle a todo el equipo acceso a todo."

**Qué hace**: directorio de equipo con foto de cada persona, alta/baja de usuarios (la baja nunca borra el historial de esa persona — solo bloquea su acceso, preservando la trazabilidad de auditoría de todo lo que registró), y una pantalla de "Accesos" donde el Manager otorga o revoca, módulo por módulo (Agenda, Finanzas, Ceremonias, Integrantes), qué puede ver y operar cada Usuario delegado.

**Valor agregado**: control de acceso real y granular sin necesitar una cuenta técnica de "administrador de sistemas" — lo opera directamente quien lidera la iglesia, con una tabla simple de casillas.

### 5.6 Multi-iglesia, roles y seguridad — la base de confianza técnica

**Qué hace**: cada iglesia es un espacio aislado (multi-tenant). La sesión de usuario se maneja con cookies `httpOnly` — el navegador nunca tiene acceso directo a un token que se pueda robar por un script malicioso — más protección CSRF en cada operación que modifica datos, el mismo estándar de seguridad que usan aplicaciones que manejan dinero y datos sensibles. Los roles (`SUPER_ADMIN`, Manager, Usuario delegado) determinan exactamente qué se puede ver y hacer.

**Valor agregado (mensaje de confianza, no de venta técnica)**: los datos financieros y personales de la congregación están protegidos con el mismo nivel de cuidado que un sistema bancario o de salud, no con el estándar mínimo de una planilla compartida por WhatsApp.

### 5.7 Tiempo real — la app se actualiza sola

**Qué hace**: partes clave del producto se actualizan en vivo sin recargar la página — el panel de administración de Evangelicapp ve cambios de estado de iglesias al instante, quien gestiona un evento ve las confirmaciones de predicadores aparecer en el momento, y quien tiene el QR de Integrantes proyectado en un evento ve cada nuevo registro aparecer en tiempo real.

**Valor agregado**: la sensación de "esto está vivo, no hay que refrescar la página cada dos minutos para saber si algo cambió" — particularmente potente en el momento de un evento en curso (censo QR, confirmaciones de predicadores).

### 5.8 Planes y facturación transparente

**Qué hace**: 3 planes comerciales (Básico / Medio / Pro — mismo criterio que "bencina 93/95/97": simple de entender, cada uno con más capacidad que el anterior), con topes claros de usuarios y, en el plan Pro, subdepartamentos financieros ilimitados dentro del tope del plan. Sin pasarela de pago automática todavía — los pagos se confirman manualmente entre la iglesia y el equipo de Evangelicapp, con un semáforo de estado de facturación (al día / próximo a vencer / en mora) visible siempre que corresponda, y alertas claras antes de cualquier corte de acceso.

**Valor agregado (mensaje honesto, no de venta)**: sin sorpresas — la iglesia siempre sabe en qué estado está su facturación, y el modelo de pago es tan simple y humano como el resto de la relación con una organización pequeña sin equipo de finanzas dedicado.

---

## 6. KPIs y métricas de valor cuantificadas

Todos marcados **[ESTIMADO]** salvo que se indique lo contrario — son proyecciones razonadas a partir del flujo de trabajo manual real que cada módulo reemplaza, pensadas como titulares de marketing defendibles, **no como datos de clientes verificados**. En cuanto existan iglesias piloto usando el producto, reemplazar por datos reales medidos (tiempo real antes/después reportado por una tesorera real vale infinitamente más que esta estimación). Mientras tanto, cada número trae su cálculo a la vista para que se pueda defender si alguien pregunta "¿de dónde sale ese número?" — y para que el equipo de marketing no lo presente como un hecho verificado sin serlo.

| KPI | Cifra sugerida | Base de cálculo | Módulo |
|---|---|---|---|
| Tiempo ahorrado en cierre financiero mensual | **Hasta 8 horas al mes** `[ESTIMADO]` | Una tesorera voluntaria en una iglesia con 3–4 departamentos gasta aprox. 1–2 h por departamento consolidando planillas sueltas + 2–3 h armando el informe consolidado final ≈ 6–11 h/mes manual. Con registro en el momento + dashboard + exportación de un clic, ese trabajo de consolidación baja a una revisión de ~30 min. | Finanzas |
| Trazabilidad de movimientos financieros | **100% de los movimientos con historial de auditoría exportable** (dato de capacidad del producto, no una estimación) | Cada movimiento registra automáticamente quién lo creó/editó/eliminó y cuándo; el log completo se puede descargar en `.xlsx`. | Finanzas |
| Tiempo de registro de un nuevo integrante | **Menos de 1 minuto, desde el celular de la persona, sin ayuda de nadie** (objetivo de diseño del flujo, verificable por UX — 4 campos, sin crear cuenta) | Formulario de 4 campos (nombre, correo, teléfono, foto opcional) sin crear cuenta, con confirmación instantánea. | Integrantes |
| Eliminación de transcripción manual de fichas | **100% del ingreso de datos lo hace la propia persona** (dato de capacidad del producto) | El dato nunca pasa por una planilla intermedia ni por una segunda transcripción — se guarda directo desde el formulario público. | Integrantes |
| Coordinación de asistencia a un evento | **Ahorra hasta 2 horas de llamadas/mensajes de confirmación por evento** `[ESTIMADO]` | Confirmar asistencia de 20–30 personas una por una (llamada o WhatsApp individual) toma entre 1,5 y 2,5 h repartidas en varios días; con invitación automática + RSVP de un clic, ese trabajo baja a revisar un panel en vivo. | Agenda |
| Emisión de un certificado de ceremonia | **De varios minutos escribiendo a mano a segundos, con folio automático** `[ESTIMADO cualitativo]` | Certificado PDF generado con un clic desde los datos ya cargados, folio correlativo sin intervención manual. | Ceremonias |
| Recuperación de tiempo semanal de un Manager | **Entre 3 y 6 horas semanales** `[ESTIMADO, cifra agregada]` | Suma conservadora de los ahorros parciales de arriba (finanzas + agenda + coordinación de equipo) para un Manager que hoy reparte su semana entre Excel, WhatsApp, papel y llamadas. Es el KPI más fuerte para un titular de hero, pero también el que más urge validar con datos reales apenas se pueda. | Transversal / Home |

**Cómo presentar estos números en el sitio**: como titulares confiados ("Hasta 8 horas al mes"), pero con una nota al pie o tooltip discreto ("estimado a partir de flujo de trabajo manual típico — no es un promedio medido de clientes") en cualquier lugar donde el número se vea como un hecho aislado. No hace falta gritarlo en el hero, pero sí que exista en algún lugar accesible — es lo correcto y, a mediano plazo, protege la credibilidad de la marca.

---

## 7. Especificaciones técnicas para el desarrollador

### Stack y compatibilidad

- El producto real es **Next.js 15 (App Router) + React 18 + TypeScript + Tailwind CSS + shadcn/ui (Radix)**. No es obligatorio que la landing viva en el mismo repo/stack, pero **es fuertemente recomendable** usar Next.js + Tailwind también para el sitio de marketing: permite copiar literalmente los tokens de `globals.css` y `tailwind.config.ts` (sección 3) sin traducirlos a otro sistema, y facilita reusar componentes reales de la app (ej. un `StatTile` real) como prueba de producto en vivo dentro de la landing en vez de una captura estática.
- Si se construye en una plataforma distinta (Webflow, Framer, etc.), los valores exactos de la sección 3 siguen siendo la fuente de verdad — cargarlos como estilos globales/variables, no aproximarlos visualmente a ojo.

### Performance

- **Objetivo Core Web Vitals**: LCP < 2.5s, CLS < 0.1, INP < 200ms — estándar, pero especialmente importante acá porque buena parte del público objetivo (secretarias, tesoreras, pastores) va a entrar desde un celular con conexión móvil variable, no desde un laptop con fibra.
- **Imágenes**: formatos `AVIF`/`WebP` con fallback, `next/image` (o equivalente con lazy-loading + `srcset`) en cualquier imagen fuera del viewport inicial. El logo fuente es 2048×2048 — nunca servir ese archivo completo en un ícono de 40px.
- **Fuentes**: cargar Inter y Playfair Display vía `next/font/google` (igual que la app real) para self-hosting automático y evitar el salto de layout por fuente no cargada (FOIT/FOUT) — la app ya resuelve esto así, no reinventar con un `<link>` a Google Fonts CDN directo.

### Responsive

- Breakpoints exactos: `640 / 768 / 1024 / 1280 / 1536px` (ver sección 3.3). Mobile-first en todo el CSS.
- Probar especialmente en **390px** (el ancho de referencia que ya usa el equipo de producto para QA mobile del resto de la app) y en **768px** (tablet) además del desktop estándar.

### Accesibilidad

- Objetivo **WCAG 2.1 AA** como mínimo.
- Foco de teclado siempre visible (`focus-visible`, anillo con el color `ring`/`primary` — la app ya tiene este patrón resuelto en varios componentes, reusar el mismo criterio).
- Contraste de texto: verificar especialmente el azul `primary` (`#4DBCEF`) sobre fondos claros — a tamaños de texto pequeño puede no alcanzar AA; reservarlo para texto grande/bold o para fondos oscuros (donde el contraste es alto por diseño, ver gradiente hero).
- Toda imagen con alt text descriptivo real, ningún ícono decorativo sin `aria-hidden`.
- Formularios (Contacto) con labels asociados correctamente, mensajes de error anunciados a lectores de pantalla.

### SEO

- Meta title/description únicos por página, especialmente cuidados en Home y Finanzas (palabras clave objetivo: "sistema de gestión para iglesias Chile", "control financiero para iglesias", "software para iglesias evangélicas").
- Imagen Open Graph 1200×630px por página (ver sección 3.5).
- Datos estructurados (`schema.org`): `Organization` en Home, `FAQPage` en la página de FAQ, `SoftwareApplication` u `Offer` en Precios.
- `sitemap.xml` y `robots.txt`.
- Idioma: `es-CL` explícito en el `<html lang>`.

### Formularios y backend de marketing

- El backend del producto (NestJS, repo separado) hoy **no expone un endpoint público de "contacto" o "lead"** — no asumir que existe uno. El formulario de Contacto necesita su propia solución liviana (un servicio de formularios transaccional, o un endpoint mínimo dedicado) independiente del backend del producto, hasta que se decida integrarlo.
- El botón "Probar gratis"/"Solicitar demo" debe dejar claro a dónde lleva realmente hoy (a un formulario de contacto humano, no a un self-signup automático — el alta de una iglesia nueva hoy la hace el equipo de Evangelicapp desde el panel SuperAdmin, no es un flujo de autoservicio).

### Analítica

- Instrumentar como mínimo: vistas de página, clics en los CTAs principales de cada página (Precios, Contacto, "Probar gratis"), y envíos completados del formulario de Contacto — sin prescribir un proveedor específico.

---

## 8. Checklist de entregables esperados del diseñador

- [ ] Sistema de tokens (color/tipografía/espaciado/radios) aplicado exactamente como en la sección 3 — no una interpretación aproximada.
- [ ] Las 9 páginas de la sección 4, con el contenido de la sección 5 (y 6, donde aplique) ya redactado/diagramado sobre las plantillas base.
- [ ] Logo derivado del asset fuente (`logo.png`, 2048×2048) en las variantes: favicon 32×32, Apple touch icon 180×180, versión monocromática blanca para fondos oscuros, lockup horizontal con "Evangelicapp" en Playfair Display itálica.
- [ ] Imagen Open Graph 1200×630 (al menos para Home y Finanzas).
- [ ] Capturas reales de producto para ilustrar cada módulo (coordinar con el equipo de producto qué pantallas usar — idealmente con datos de ejemplo neutros, no datos reales de una iglesia).
- [ ] Los 8 KPIs de la sección 6 presentados como piezas visuales reusables (para Home y para las páginas de módulo correspondientes), con su nota de metodología accesible.
