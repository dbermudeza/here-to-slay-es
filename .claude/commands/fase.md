---
description: Prepara el plan de un trabajo grande (una fase o funcionalidad), repartido entre los agentes, y espera la aprobación del usuario antes de programar.
argument-hint: '<descripción del trabajo>'
---

Trabajo: $ARGUMENTS

No escribas código todavía. Prepara un plan para el usuario:

1. Lee `CLAUDE.md` y lo que haga falta del código para entender el alcance (puedes usar búsquedas
   amplias).
2. Divide el trabajo por agente:
   - **motor-reglas**: `packages/**` (reglas, cartas, bots, anfitrión);
   - **frontend-ux**: `apps/web` (pantallas, textos, accesibilidad);
   - el orquestador (tú): `apps/server`, documentación e integración;
   - **qa**: tests nuevos y verificación; **revisor**: revisión final del diff.
     Indica qué partes pueden ir en paralelo (sin tocar los mismos archivos) y cuáles dependen de otras.
3. Lista las dudas de reglas (`D-xx`) y las decisiones de diseño que necesitan al usuario, con una
   recomendación para cada una.
4. Indica cómo se comprobará que está terminado (tests, e2e, capturas) y el commit previsto.

Presenta el plan de forma breve y espera la aprobación. Cuando el usuario lo apruebe, sigue el flujo:
especialistas → qa (si falla, vuelve al especialista con el test que falla) → revisor → commit y
resumen.
