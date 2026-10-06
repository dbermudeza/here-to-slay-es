---
description: Revisa y actualiza toda la documentación (docs/ y README.md) con el agente documentador.
argument-hint: '[tema o rango de commits]'
---

Delega en el agente `documentador`. Si hay argumento ($ARGUMENTS), céntrate en ese tema o en los
cambios de ese rango de commits; si no, haz una revisión completa:

1. Compara cada documento de `docs/` y el `README.md` con el código actual y con `git log` desde
   la última vez que se tocó la documentación.
2. Corrige lo que ya no sea cierto y documenta lo que falte (nuevos módulos, opciones, eventos,
   variables de entorno, comandos, pantallas).
3. Comprueba enlaces, el índice de `docs/README.md` y Prettier.

Después, pide al `revisor` que compruebe que la documentación coincide con el código y que no entra
material oficial, y resume el resultado al usuario. No hagas commit sin su aprobación.
