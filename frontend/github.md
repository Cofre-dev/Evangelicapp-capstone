# github.md

Guía de trabajo con Git/GitHub para este repo. Objetivo: que el historial sea legible y auditable
(se pueda entender qué cambió y por qué sin tener que preguntar), y que nunca se suba algo que no
corresponda (secretos, artefactos de build, cambios ajenos al commit). Aplica a todo el
repositorio (`frontend/` y raíz) — no es una convención por paquete.

Esto complementa a `CLAUDE.md` (arquitectura y comandos) y a `frontend/FEATURES.md` (bitácora de
ingeniería). No lo reemplaza: seguí agregando una entrada a `FEATURES.md` después de cualquier
sesión de trabajo relevante, además de seguir esta guía para el commit en sí.

## Antes de commitear (checklist)

1. **`git status`** — mirá la lista completa de archivos modificados/nuevos. Si aparece algo que
   no reconocés (un archivo que no tocaste a propósito, una carpeta rara), investigalo antes de
   seguir. No asumas que es ruido.
2. **`git diff`** (o `git diff --staged` después de armar el stage) — releé el diff real línea por
   línea antes de commitear, no solo los nombres de archivo. Buscá específicamente:
   - `console.log` / `debugger` / comentarios de depuración que se quedaron pegados.
   - Credenciales, tokens, URLs internas o cualquier valor que debería salir de una variable de
     entorno en vez de estar hardcodeado.
   - Cambios accidentales de formato/indentación en archivos que no tenían por qué tocarse (señal
     de que el editor autoformateó algo fuera de scope).
3. **Corré los checks locales antes de commitear, no después**: `npm run lint`, `npm run
   typecheck` y, si el cambio es grande o toca algo sensible (auth, rutas, config), `npm run
   build`. CI (`.github/workflows/ci.yml`) corre exactamente estos tres pasos en cada push/PR a
   `main` — si fallan en tu máquina, van a fallar ahí. No hay excusa para subir algo que no
   compila.
4. **Preguntate si el commit mezcla cosas que no van juntas.** Un fix de bug y una feature nueva
   no comparten commit aunque los hayas hecho en la misma sesión. Ver "Atomicidad" más abajo.

## Qué NO se sube nunca

- **Secretos de cualquier tipo**: `.env`, `.env.local`, API keys, tokens, contraseñas, strings de
  conexión a bases de datos. Ya están en `.gitignore` (`frontend/.gitignore`) — si `git status` te
  muestra un `.env*` como "nuevo", pará y revisá el `.gitignore` antes de agregarlo, no lo fuerces
  con `git add -f`.
- **Artefactos de build y dependencias**: `node_modules/`, `.next/`, `*.tsbuildinfo`,
  `next-env.d.ts`. Ya cubiertos por `.gitignore`. Si alguno aparece como trackeado, es una señal
  de que se coló con un `git add -A` en el pasado — avisar antes de tocarlo (sacarlo del tracking
  no es lo mismo que borrarlo del disco).
- **Archivos de log, temporales o de tu editor/SO**: `*.log`, `.DS_Store`, carpetas de scratch
  personal. Si tu editor genera algo propio (`.vscode/`, `.idea/`) que no está ya en
  `.gitignore` y no es config compartida del equipo, no lo subas.
- **Config local de una sola máquina/sesión**: `.claude/settings.local.json` (permisos y comandos
  ad-hoc de debug, paths absolutos tipo `C:\Users\<usuario>\...`). No sirve para otro dev ni para
  otra máquina. El `.gitignore` de la raíz existe pero está vacío — falta agregarle al menos este
  archivo. Hasta que se agregue, revisar `git status` a mano antes de cada `git add` para no
  engancharlo por error.
- **Cambios de terceros no relacionados**: si mientras trabajás en algo tu IDE reformatea un
  archivo que no ibas a tocar, o `npm install` actualiza `package-lock.json` por una dependencia
  transitiva sin que vos hayas cambiado `package.json` a propósito, no lo incluyas en el commit
  sin revisar por qué pasó.
- **Nunca uses `git add -A` ni `git add .` a ciegas.** Agregá archivos por nombre
  (`git add src/app/foo/page.tsx`) o revisá con `git add -p` cuando el diff de un archivo mezcla
  cambios que sí querés commitear con otros que no. `git add -A`/`.` es exactamente lo que hace
  que un `.env` o un archivo de debug se cuele en un commit sin que nadie lo note.

## Mensajes de commit

Formato: **modo imperativo, español, específico sobre qué cambió** (no sobre cómo se ve el código
después). "Agregar", "Corregir", "Eliminar", "Migrar" — no "Agregado", "Agregando", "Cambios".

Mensajes como estos ya existen en el historial de este repo y son el antipatrón a evitar:
`:)`, `-_-`, `add new features`, `Add new feautures`. No dicen nada — en seis meses nadie (ni un
modelo, ni una persona) va a poder usar `git log` para entender qué pasó ahí sin abrir el diff
completo.

Mensajes buenos ya existentes en este mismo historial, como referencia del nivel esperado:

```
Migrar autenticación de JWT en localStorage a cookies httpOnly
Agregar higiene de proyecto, CI, docs técnicas y config env-driven
Documentar el widget de próximos eventos en FEATURES.md
```

Estructura recomendada:

```
<qué cambió, en imperativo y concreto>

<opcional: por qué, si no es obvio del qué — 1-3 líneas>
```

- La primera línea es un resumen, no un título genérico. "Corregir bug de imágenes" no sirve si
  el commit toca 12 archivos por el mismo motivo — "Usar logoUrl/fotoUrl como URL absoluta (fix
  Supabase Storage)" sí dice algo verificable.
- Si el cambio viene de un brief externo (patrón ya usado en este repo vía `frontend/prompt.md`),
  no hace falta repetir todo el contrato en el mensaje de commit — para eso está la entrada en
  `frontend/FEATURES.md`, que sí debe tener el detalle completo. El commit message es el índice,
  no el documento.
- Prefijo tipo Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) es opcional
  en este repo — el historial existente no lo usa de forma consistente y no vale la pena reescribir
  commits viejos para adoptarlo retroactivamente. Si querés usarlo de acá en adelante es válido,
  pero no reemplaza tener un resumen concreto después del prefijo.

## Atomicidad: un commit, un motivo

Cada commit debe poder revertirse solo, sin arrastrar cambios de otro propósito. Señales de que
un commit se debería partir en dos:
- Toca un módulo de negocio (agenda, finanzas, integrantes) **y** un archivo de configuración de
  infraestructura (`next.config.ts`, CI, `.gitignore`) por motivos distintos — ej. config de
  tooling (`.claude/`, `.github/workflows/`, `skills-lock.json`) junto con código de un feature de
  negocio.
- Mezcla un fix de bug con una refactorización cosmética no relacionada.
- Un rename de roles junto con un módulo nuevo sin relación — cada uno se revierte o revisa
  distinto.
- El mensaje de commit necesita la palabra "y" para describir dos cosas que no dependen una de la
  otra ("Agregar módulo X y arreglar bug de Y" → dos commits).

No hace falta partir un commit cuando todos los archivos tocados son consecuencia directa del
mismo cambio (ej.: un rename de campo que toca 12 archivos porque ese campo se usa en 12 lugares,
o un feature grande que es una sola unidad de trabajo coherente — eso es un solo motivo, un solo
commit).

## Flujo recomendado

```bash
git status                      # qué cambió, completo
git diff                        # revisar el contenido real
npm run lint && npm run typecheck   # y npm run build si el cambio lo amerita

git add <archivo1> <archivo2>   # por nombre, nunca -A/.
git status                      # confirmar qué quedó en stage antes de commitear
git commit -m "Mensaje en imperativo, específico"

git log --oneline -5            # confirmar que el commit quedó como se esperaba
```

- **No hagas commit de algo que no compila o no pasa lint** para "arreglarlo después" — rompe el
  historial y potencialmente el build de quien haga `pull` después.
- **No uses `--no-verify`** para saltear hooks salvo pedido explícito de quien te está dirigiendo
  el trabajo. Si un hook falla, el motivo casi siempre es real.
- **No hagas `git push --force` a `main`**, ni siquiera a una rama compartida, sin confirmar antes
  con el resto del equipo — reescribe historia que otros pueden tener basada localmente.
- **No hagas commit ni push automáticamente sin que te lo pidan.** Dejar cambios sin commitear
  para que la persona los revise antes es preferible a decidir por ella.

## Si algo se subió por error

Si un secreto o archivo indebido ya llegó a un commit (aunque sea local, sin push): no lo
"soluciones" con un nuevo commit que lo borra — el valor sigue en el historial de git y
recuperable. Avisar antes de reescribir historia (`git commit --amend`, `git reset`, filtrado de
historial) porque son operaciones destructivas que pueden pisar trabajo de otra persona si la
rama ya se compartió. Si el secreto llegó a subirse a un remoto compartido, rotar la credencial es
más confiable y más rápido que intentar limpiarla del historial de git.

## Ramas

Este repo trabaja sobre una rama de desarrollo (`features`) que después se integra a `main`.
Evitar commitear directo contra `main`; los commits de trabajo diario van en `features` (o una
rama dedicada si el cambio es grande y riesgoso, ej. algo que toca `src/lib/api.ts` o
`src/stores/auth-store.ts`) y se integran a `main` de forma explícita, no accidental.
