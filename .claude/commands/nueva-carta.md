---
description: Añade (o completa) el efecto y el test de una carta, delegando en motor-reglas y verificando con qa.
argument-hint: '<id de la carta>'
---

Carta: `$ARGUMENTS`

1. Comprueba que la carta existe en `Referencias/cartas.es.json` (si no, pide al usuario que la
   añada o ejecute `pnpm recursos`) y lee su texto y su `textoOriginal`.
2. Delega en el agente **motor-reglas** para:
   - añadir o corregir su definición en `packages/cards/src/efectos/efectos.json` (DSL; un paso
     `custom` en `packages/engine/src/customs.ts` solo si el DSL no basta);
   - escribir su test en `packages/engine/test/cartas/` siguiendo el estilo de los existentes;
   - registrar como `D-xx` cualquier ambigüedad del texto, sin inventar reglas.
3. Delega en el agente **qa** para revisar que el test cubre el texto completo de la carta (éxito,
   fracaso, opciones "puedes", objetivos inválidos) y ejecutar `pnpm validate:cards` y los tests.
4. Resume al usuario: qué hace la carta, archivos cambiados, resultado de las comprobaciones y dudas
   `D-xx` pendientes. No hagas commit sin su visto bueno.
