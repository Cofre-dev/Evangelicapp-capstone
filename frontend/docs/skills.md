# Skills disponibles para este proyecto

Resultado de investigar el ecosistema de [Skills CLI](https://skills.sh/) (`npx skills`) buscando
skills relevantes para el stack de Evangelicapp: Next.js 15 (App Router) + React 18 + TypeScript,
Tailwind + shadcn/ui, Zustand, react-hook-form + zod, auth con cookies httpOnly, y ausencia de
suite de tests.

Se instaló primero el skill `find-skills` (`vercel-labs/skills`) y se usó su criterio de calidad
para filtrar candidatos: preferir 1K+ installs, priorizar fuentes oficiales (`vercel-labs`,
`anthropics`), y tratar con escepticismo repos con pocos installs o sin reputación conocida.

Ningún skill listado abajo está instalado todavía — esto es un catálogo para decidir. Para instalar
uno: `npx skills add <owner/repo@skill>`.

## Recomendados (alta confianza)

### `vercel-labs/agent-skills@vercel-react-best-practices` — 624K installs
Guía de mejores prácticas de React de Vercel Engineering. Fuente oficial, el más instalado del
ecosistema para React. Aplica directamente al código en `frontend/src/components/` y `app/`.

```
npx skills add vercel-labs/agent-skills@vercel-react-best-practices
```

### `vercel-labs/agent-skills@vercel-composition-patterns` — 285K installs
Patrones de composición de componentes React (oficial Vercel). Útil para mantener consistencia en
`components/<dominio>/` a medida que crecen los formularios y diálogos (ej. los nuevos
`cambiar-facturacion-dialog.tsx`, `historial-pagos-card.tsx`).

```
npx skills add vercel-labs/agent-skills@vercel-composition-patterns
```

### `anthropics/knowledge-work-plugins@testing-strategy` — 5.4K installs
Fuente oficial Anthropic. Directamente relevante: el README documenta que el proyecto **todavía no
tiene suite de tests** y que hay que "alinear con el equipo qué cubrir" antes de introducir un
framework. Este skill ayuda a estructurar esa decisión (unit vs. e2e, qué priorizar) en vez de
improvisarla.

```
npx skills add anthropics/knowledge-work-plugins@testing-strategy
```

## Buenos candidatos (confianza media — revisar antes de instalar)

### `wshobson/agents@nextjs-app-router-patterns` — 26.9K installs
Patrones específicos de App Router (rutas, layouts, server/client components). Coincide con la
estructura real del repo (`app/agenda/`, `app/finanzas/`, `app/superadmin/iglesias/[id]/`, rutas
públicas por token como `predicacion/[token]/`).

```
npx skills add wshobson/agents@nextjs-app-router-patterns
```

### `jezweb/claude-skills@tailwind-v4-shadcn` — 2.7K installs
Combina Tailwind + shadcn/ui, que es exactamente el stack de UI del proyecto (`components/ui/` son
primitivas shadcn). Verificar que la versión de Tailwind que cubre coincida con la del proyecto
antes de instalar.

```
npx skills add jezweb/claude-skills@tailwind-v4-shadcn
```

### `anthropics/knowledge-work-plugins@design-critique` — 3.7K installs
### `anthropics/knowledge-work-plugins@design-system` — 3.1K installs
Fuente oficial Anthropic. Complementan al agente `ux-ui-expert` ya configurado en este proyecto
para revisión de consistencia visual y accesibilidad en Tailwind/shadcn.

```
npx skills add anthropics/knowledge-work-plugins@design-critique
npx skills add anthropics/knowledge-work-plugins@design-system
```

### `mastepanoski/claude-skills@wcag-accessibility-audit` — 1.1K installs
Auditoría de accesibilidad WCAG. El proyecto no tiene skill de accesibilidad hoy más allá del
criterio del agente `ux-ui-expert`; este podría formalizar esa revisión. Instalación menos probada
que las de arriba (fuente no oficial) — revisar el repo antes de sumarlo.

```
npx skills add mastepanoski/claude-skills@wcag-accessibility-audit
```

## Evaluados y descartados

Se buscó explícitamente por dominios que parecían encajar pero no hubo resultados que pasaran la
barra de calidad (1K+ installs o fuente reputada):

- **Zustand** (`zustand state management`) — todos los resultados con <10 installs. Zustand ya está
  bien acotado en `src/stores/auth-store.ts`; no hace falta un skill genérico.
- **react-hook-form + zod** — mismos resultados, todos <15 installs.
- **Playwright / e2e testing** — nada por encima de 50 installs. Tiene sentido: el proyecto todavía
  no decidió su enfoque de testing (ver `testing-strategy` arriba, que es el paso previo).
- **Git commit conventions** — ya cubierto en el propio repo (commit "Documentar practicas de
  git/commits del proyecto"); los skills externos encontrados tenían <15 installs.
- **Deploy a Vercel** — resultados oficiales (`vercel/vercel-deploy-claude-code-plugin`) pero con
  installs bajos (<115) para un skill que toca producción; el agente `devops-infra` ya cubre esta
  responsabilidad dentro del proyecto.
- **Security review genérico para web apps** — sin resultados con reputación; el repo ya tiene el
  skill nativo `security-review` y `frontend/docs/auth-cookies.md` como contrato de referencia para
  todo lo sensible de auth.

## Cómo se hizo esta investigación

```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills find nextjs
npx skills find react --owner vercel-labs
npx skills find tailwind
npx skills find shadcn
npx skills find design --owner anthropics
# + búsquedas descartadas: zustand, react-hook-form/zod, playwright, git commit, vercel deploy, security review
```

Para repetir o ampliar la búsqueda: `npx skills find <query> [--owner <owner>]`. Catálogo completo
en https://skills.sh/.
