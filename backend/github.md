# Convenciones de Git — EvangelicApp Backend

Este documento define cómo se hacen los commits en este repositorio de ahora en
adelante. Nace de un problema concreto: commits como `"Add"`, `"Add new
features"` o `"Add new module like an 'IAM'"` mezclando módulos sin relación
entre sí, y `FEATURES.md`/`README.md` quedando desactualizados porque la
documentación no viajaba junto con el código que la necesitaba. El resultado
fue perder trazabilidad de qué se hizo, para qué, y si ya estaba reflejado en
la base de datos real (Supabase).

Complementa a [`CLAUDE.md`](./CLAUDE.md) (contexto de negocio) y
[`README.md`](./README.md) (referencia técnica). La bitácora de cambios sigue
siendo [`FEATURES.md`](./FEATURES.md) — este documento es sobre *cómo* llegar
a esos commits, no un reemplazo de la bitácora.

## Principios

1. **Un commit = un cambio que se pueda describir en una frase.** Si la
   descripción necesita un "y" para unir dos cosas sin relación ("agrega X
   **y** arregla Y **y** actualiza Z"), son dos o tres commits, no uno.
2. **`FEATURES.md` se commitea junto con el código que documenta**, nunca
   como una tarea aparte ni al final de la sesión. Un commit de código sin su
   entrada en la bitácora está incompleto (ver regla en `CLAUDE.md`).
3. **Nunca se stagea a ciegas.** `git add -A` / `git add .` sin revisar antes
   ha metido secretos y archivos que no correspondían al repo (`.env`,
   `uploads/`, ver historial de `FEATURES.md`).
4. **Las migraciones de Prisma nunca se aplican con `migrate dev` contra una
   base compartida** (Supabase). Solo `migrate deploy`, y solo después de
   confirmar que no hay drift.

## Antes de hacer `git add`

```bash
git status              # qué se modificó, qué es nuevo
git diff                # o: git diff --stat
```

Confirma que todo lo que aparece pertenece al mismo cambio lógico. Si hay
archivos de temas distintos mezclados en el working tree (pasa seguido en
sesiones largas), se van a commits separados — ver "Cómo dividir" más abajo.

## Checklist antes de commitear

Corre esto y que todo pase antes de `git commit`:

```bash
npm run lint:ci
npm run build
npm test
npx prisma migrate status   # confirma que no hay drift contra la base real
```

## Cómo armar el commit

Stagea por ruta explícita, no todo el working tree de una vez:

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/<carpeta-nueva>/ \
        backend/src/modules/<módulo-afectado>
git status   # revisa la lista final antes de confirmar — nada de otro tema debe aparecer
```

Si un mismo archivo (típicamente `FEATURES.md`, por ser de solo agregar) tiene
contenido de dos cambios distintos sin commitear todavía, usa staging
parcial en vez de arrastrar todo el archivo a un solo commit:

```bash
git add -p FEATURES.md   # eliges solo el hunk (la entrada) que corresponde a este commit
```

## Mensaje de commit

Formato: `tipo(alcance): resumen en una línea, imperativo, en español`.

Tipos: `feat` (funcionalidad nueva), `fix` (corrección de bug), `docs` (solo
documentación), `refactor` (sin cambio de comportamiento), `chore`
(dependencias, config, CI), `test`.

El alcance es el módulo principal afectado (`iglesias`, `finanzas`, `auth`,
`docs`, etc.). Si el cambio no es trivial, agrega un cuerpo de 2-4 líneas
explicando el *por qué*, no solo el qué (el diff ya muestra el qué). Usa un
heredoc para no pelear con comillas/saltos de línea:

```bash
git commit -m "$(cat <<'EOF'
feat(iglesias): planes comerciales (Básico/Medio/Pro) y facturación con mora

Agrega plan y fecha de facturación obligatorios al alta de iglesia, límites de
uso por plan (usuarios, subdepartamentos de finanzas), semáforo de facturación
y bloqueo de acceso cuando una iglesia queda oculta por mora.
EOF
)"
```

Mensajes que **no** sirven (ejemplos reales de este repo, para no repetir):
`"Add"`, `"Add new features"`, `"Add new module like an 'IAM'"` — no dicen
qué módulo, ni por qué, y suelen ser señal de que el commit mezcla demasiado.

## Migraciones de base de datos

- **Local** (`docker-compose up -d postgres` o Postgres propio): `prisma
  migrate dev --name descripcion_del_cambio` genera y aplica la migración.
- **Supabase (compartida/real)**: nunca `migrate dev` — puede resetear la
  base si detecta drift. Siempre:
  ```bash
  npx prisma migrate status    # primero: confirma que no hay drift
  npx prisma migrate deploy    # solo aplica lo pendiente, nunca resetea
  ```
- La carpeta de la migración se commitea **en el mismo commit** que el
  `schema.prisma` que la originó. Un schema sin su migración, o una
  migración sin el schema que la explica, rompe la trazabilidad.
- Si `migrate status` muestra migraciones aplicadas en Supabase que no
  reconoces en el log local (como pasó en esta sesión), detente y revisa con
  el equipo antes de seguir — puede significar que alguien migró por fuera
  del flujo normal de commits.

## Qué NO hacer

- `git add -A` / `git add .` sin haber revisado `git status` antes.
- Un commit que toca módulos sin relación entre sí (ej. `auth` + `finanzas` +
  `mi-iglesia` + `notas` + certificados PDF, todo junto).
- Commitear código sin su entrada correspondiente en `FEATURES.md`.
- Mensajes de una palabra o genéricos (`"Add"`, `"fix"`, `"update"`).
- `prisma migrate dev` apuntando a `DATABASE_URL` de Supabase.
- `git push --force` a `main`, o `git commit --amend` sobre un commit que ya
  se pusheó.

## Cambios riesgosos (schema, auth, multi-tenant)

Para cambios que tocan el schema de Prisma, autenticación, o el aislamiento
por `iglesiaId` — lo más sensible del sistema (ver `CLAUDE.md`) — conviene
una rama corta en vez de commitear directo a `main`:

```bash
git checkout -b feat/nombre-corto
# ...trabajo + checklist...
git diff main...HEAD    # auto-revisión final antes de mergear
git checkout main && git merge feat/nombre-corto
```

No hace falta ceremonia de PR si se trabaja solo, pero sí ese `git diff
main...HEAD` como último filtro antes de que el cambio quede en `main`.

## Ejemplo completo (dos tareas mezcladas en un mismo working tree)

Si en una sesión se hizo una feature *y* además se puso al día documentación
sin relación directa, son dos commits:

```bash
# Commit 1 — la feature
git add backend/prisma/schema.prisma backend/prisma/migrations/<carpeta>/ \
        backend/src/modules/<módulos-afectados>
git add -p FEATURES.md   # solo la(s) entrada(s) de esta feature
git commit -m "feat(<alcance>): <resumen>"

# Commit 2 — la documentación
git add README.md backend/TODO.md
git add -p FEATURES.md   # la entrada del catch-up de docs
git commit -m "docs: <resumen>"
```
