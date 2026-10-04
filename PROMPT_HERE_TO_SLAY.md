# Prompt para Claude Code — "Here to Slay" virtual en español (uso personal)

> Cómo usarlo: crea una carpeta vacía para el proyecto, copia dentro la carpeta `referencias/` (ver "Insumos" abajo), abre Claude Code ahí, activa **plan mode** y pega todo lo que está debajo de la línea. Trabaja **una fase por sesión** y no avances hasta que los tests de la fase pasen.

---

## Rol y objetivo

Eres un ingeniero de software senior. Vas a construir una aplicación web **funcional de extremo a extremo** para jugar una adaptación digital del juego de mesa *Here to Slay* (Unstable Games), **en español**, para uso **personal y no comercial**. Debe respetar fielmente las reglas del juego base. Nada de prototipos a medias ni funciones simuladas: cada mecánica debe funcionar de verdad y estar cubierta por tests.

## Insumos que te entrego (fuente de verdad)

En `referencias/` encontrarás:

1. `reglamento.pdf` — reglamento oficial del juego base. **Es la única fuente de verdad para las reglas.** Si algo es ambiguo, no inventes: anótalo en `docs/DUDAS_REGLAS.md` con la página del reglamento y aplica la interpretación más literal, marcándola con un `// TODO(regla)` en el código.
2. `cartas.es.json` — listado de cartas de mi copia física, transcrito y traducido por mí (puede estar incompleto o con errores de formato; valídalo).
3. `imagenes/` — fotos/escaneos de las cartas de mi copia física, nombrados por `id` de carta (p. ej. `heroe_ejemplo.jpg`).

Restricciones sobre recursos:
- **No descargues, scrapees ni generes copias de ilustraciones, logos o textos oficiales desde internet.** Las imágenes solo se cargan desde la carpeta local `assets/cartas/` que yo lleno.
- Si a una carta le falta imagen, renderiza una **carta genérica** (marco por tipo/clase, nombre, efecto y requisitos en texto), para que el juego sea 100 % jugable sin imágenes.
- El repositorio no debe publicarse: añade `assets/cartas/` y `referencias/` al `.gitignore`.

## Stack técnico (obligatorio)

- Monorepo con **pnpm workspaces**, todo en **TypeScript estricto**.
- `packages/engine`: motor de reglas puro (sin dependencias de UI ni de red), determinista.
- `packages/cards`: esquema de cartas (Zod), datos, y registro de efectos.
- `packages/bots`: jugadores IA.
- `apps/server`: Node + Fastify + Socket.IO, servidor **autoritativo** con salas.
- `apps/web`: React + Vite + Zustand + Tailwind (+ Framer Motion para animaciones).
- Tests: **Vitest** (unitarios/integración del motor) y **Playwright** (e2e de partidas completas).
- Toda la UI en español; textos en `apps/web/src/i18n/es.json` (nada hardcodeado).

## Arquitectura del motor (lo más importante)

- Estado inmutable + `reducer(state, action) => { state, events }`. El cliente **nunca** modifica el estado; envía intenciones, el servidor valida con el motor.
- **RNG con semilla** (p. ej. `seedrandom`) guardado en el estado → partidas reproducibles y tests deterministas. Los dados se tiran en el servidor.
- **Máquina de estados de turno** con fases explícitas y una **pila de decisiones pendientes** (`pendingDecisions`): cuando una carta pide elegir objetivo, descartar, robar de una mano, etc., el motor se detiene y espera la acción del jugador correspondiente.
- **Ventanas de respuesta**: después de jugar una carta desafiable y después de cada tirada, abre una ventana donde cualquier jugador puede responder (desafío, modificadores) o pasar. Modela el encadenamiento y el cierre de la ventana exactamente como dice el reglamento. Incluye temporizador configurable y botón "Pasar".
- **Información oculta**: el servidor envía a cada cliente una vista filtrada (`getPlayerView(state, playerId)`); nadie recibe la mano ni el mazo de otro.
- **Efectos de carta data-driven**: un DSL de efectos componibles (robar, descartar, robar carta de otro jugador, sacrificar, destruir, buscar en el descarte, modificar tirada, tirar dados, mover héroes/objetos, condiciones "si la tirada es ≥ N", etc.) definido en JSON. Para cartas que no encajen, un registro `customEffects[cardId]` con una función tipada. **Cada carta del listado debe tener su efecto implementado y un test propio.**
- Log de eventos legible en español (historial de la partida) y posibilidad de guardar/cargar partida (serializar estado + semilla).

## Reglas a implementar (validar todo contra `reglamento.pdf`)

Preparación, líder de grupo, puntos de acción por turno y el coste de cada acción, jugar héroes/objetos/magia, usar habilidades de héroes con tirada, atacar monstruos con sus requisitos y resultados de éxito/fracaso, cartas de desafío, modificadores, límites de mano si existen, reposición del mazo/descarte, y **ambas condiciones de victoria**. Número de jugadores según el reglamento. Implementa solo el **juego base**; deja el esquema de cartas preparado para expansiones.

## Modos de juego

1. **Local (hot-seat)**: varios jugadores en el mismo dispositivo, con pantalla de "pasa el dispositivo" que oculta la mano.
2. **Contra bots**: 1 humano + N bots. Bot "fácil" (acciones legales aleatorias) y "normal" (heurísticas: priorizar victoria, atacar monstruos alcanzables, desafiar cartas peligrosas). Los bots usan exactamente la misma API de acciones que un humano.
3. **En línea (red local o internet)**: crear sala, código de invitación, nombre de jugador, reconexión si se cae la conexión, lobby con "listo".

## UI/UX

- Mesa con: mi mano, mi grupo (líder + héroes con objetos equipados), grupos de rivales, monstruos activos, mazo, descarte, contador de puntos de acción, indicador de turno/fase.
- Acciones legales resaltadas; las ilegales deshabilitadas con tooltip explicando por qué.
- Diálogos claros para decisiones pendientes y ventanas de respuesta (quién puede responder, cuánto tiempo queda).
- Animación de dados visible para todos, zoom de carta al pasar el mouse/tocar, historial lateral.
- Responsive (escritorio y tablet), modo oscuro.
- Pantalla de reglas resumidas en español y tutorial corto.

## Fases de trabajo (una por sesión)

- **Fase 0 – Análisis**: lee el reglamento y `cartas.es.json`. Entrega `docs/REGLAS.md` (reglas en tus palabras, estructuradas como especificación), `docs/DUDAS_REGLAS.md`, el esquema Zod de cartas y un script `pnpm validate:cards` que reporte cartas inválidas o efectos sin mapear. Escribe `CLAUDE.md` con convenciones del proyecto y comandos. Las cartas están como JPG en referencias/imagenes/. Transcríbelas a referencias/cartas.es.json siguiendo el esquema que definas, con el texto traducido al español. Trabaja por lotes de 15–20 imágenes. Marca con "revisar": true cualquier carta cuyo texto no puedas leer con seguridad. Al final, copia las imágenes a assets/cartas/ renombradas por id.
- **Fase 1 – Motor núcleo**: estado, turnos, puntos de acción, robar/jugar, ventanas de respuesta, desafíos, modificadores, monstruos, victoria. Tests por regla.
- **Fase 2 – Cartas**: DSL + implementación de **todas** las cartas, cada una con test. `validate:cards` sin errores.
- **Fase 3 – Bots** + test de simulación: 1.000 partidas bot vs bot sin excepciones, sin bloqueos y siempre con ganador (o fin por regla).
- **Fase 4 – UI local** (hot-seat y vs bots).
- **Fase 5 – Multijugador en línea** (servidor autoritativo, vistas filtradas, reconexión).
- **Fase 6 – Pulido y e2e**: Playwright jugando una partida completa en cada modo, revisión de accesibilidad y rendimiento, `README.md` en español con instalación y uso.

## Definición de terminado (en cada fase)

- `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan sin errores.
- Sin `any`, sin TODOs salvo `TODO(regla)` documentados.
- Commit con mensaje descriptivo al cerrar la fase y resumen de lo hecho, lo pendiente y las dudas de reglas que debo resolver yo.

Antes de escribir código, preséntame el plan de la fase actual y espera mi aprobación.
