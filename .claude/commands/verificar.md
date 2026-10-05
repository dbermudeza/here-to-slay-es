---
description: Pasa todas las comprobaciones del proyecto (formato, lint, tipos, tests y cartas) y resume el resultado.
argument-hint: '[e2e]'
---

Ejecuta, en este orden y desde la raíz del repositorio, y no te detengas en el primer fallo:

1. `pnpm exec prettier --check .`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm validate:cards`
6. Solo si el argumento es `e2e` ($ARGUMENTS): `pnpm e2e`.

Además, comprueba con `git status --short` que no hay archivos de `Referencias/` ni `assets/cartas/`
preparados para commit.

No cambies ningún archivo. Termina con una tabla: comprobación · resultado (✔/✘) · detalle breve (nº
de tests, errores con archivo y línea). Si algo falla, indica qué agente debería arreglarlo
(`motor-reglas` para `packages/**`, `frontend-ux` para `apps/web`, `qa` para tests rotos).
