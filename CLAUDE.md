# Here to Slay — versión digital en español (uso personal)

Especificación completa: [PROMPT_HERE_TO_SLAY.md](PROMPT_HERE_TO_SLAY.md). Se trabaja **una fase
por sesión**. Antes de escribir código, presenta el plan de la fase y espera la aprobación.

## Estado de las fases

- [x] Fase 0 — Análisis (reglas, esquema de cartas, transcripción, validador)
- [x] Fase 1 — Motor núcleo
- [x] Fase 2 — Cartas (DSL + todos los efectos con test)
- [x] Fase 3 — Bots + simulación de 1.000 partidas
- [x] Fase 4 — UI local (hot-seat y contra bots)
- [ ] Fase 5 — Multijugador en línea
- [ ] Fase 6 — Pulido, e2e con Playwright y README

## Fuentes de verdad

- Reglas: `Referencias/Reglas.pdf`, resumido como especificación en [docs/REGLAS.md](docs/REGLAS.md) (ids `R-xxx`).
- Ambigüedades: [docs/DUDAS_REGLAS.md](docs/DUDAS_REGLAS.md) (ids `D-xx`). No inventes reglas: si algo no está claro, añade una `D-xx`, aplica la lectura más literal y marca el código con `// TODO(regla) D-xx`.
- Cartas: `Referencias/cartas.es.json`, validado con el esquema Zod de `packages/cards/src/schema.ts`.
- `Referencias/` y `assets/cartas/` son personales y **no se publican** (están en `.gitignore`). No descargues ni generes arte o texto oficial desde internet.

## Estructura

```
packages/engine   Motor de reglas puro y determinista (sin UI ni red)       — Fase 1
packages/cards    Esquema Zod, validación, scripts de datos; registro de efectos — Fase 0/2
packages/bots     IA fácil/normal (misma API de acciones que un humano)     — Fase 3
apps/server       Fastify + Socket.IO, servidor autoritativo                — Fase 5
apps/web          React + Vite + Zustand + Tailwind + Framer Motion         — Fase 4
docs/             REGLAS.md, DUDAS_REGLAS.md
```

## Comandos

```sh
pnpm install          # dependencias (pnpm 9; si falta: npm i -g pnpm@9)
pnpm dev              # aplicación web en http://localhost:5173
pnpm lint             # ESLint (TS estricto)
pnpm typecheck        # tsc en todos los paquetes
pnpm test             # Vitest en todos los paquetes
pnpm validate:cards   # valida Referencias/cartas.es.json (errores → exit 1)
pnpm copy:images      # copia Referencias/Imagenes/Cartas/** → assets/cartas/<id>.png
pnpm sim [n] [semilla] # simula n partidas entre bots y muestra estadísticas
```

Una fase está terminada cuando `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan, y se cierra con
un commit descriptivo.

## Convenciones

- **TypeScript estricto** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Prohibido usar `any` y `!` (non-null assertion); ESLint lo comprueba.
- **Comentarios de tarea pendiente:** solo `TODO(regla) D-xx`. Cualquier otro TODO/FIXME es error de lint.
- **Idioma:** dominio, datos y textos en español (`carta`, `jugador`, `tirada`, `Grupo`…). Las APIs técnicas genéricas pueden ir en inglés (`reducer`, `state`, `events`). Toda la UI sale de `apps/web/src/i18n/es.json`; nada hardcodeado.
- **Glosario de verbos** (ver REGLAS.md §0): DRAW = ROBAR, STEAL = ARREBATAR, PULL = SACAR, DISCARD = DESCARTAR, DESTROY = DESTRUIR, SACRIFICE = SACRIFICAR, CHALLENGE = DESAFIAR, ATTACK = ATACAR, SLAY = MATAR, Party = Grupo.
- **Cartas:**
  - Los Héroes conservan el nombre original y su id es `heroe_<nombre_original>`.
  - El resto lleva nombre traducido y su id es `<tipo>_<nombre_traducido>`, en snake_case ASCII.
  - `textoOriginal` guarda el texto en inglés.
  - Una carta dudosa lleva `"revisar": true` y una `nota`.
- **Motor:**
  - Estado inmutable con `reducer(state, action) => { state, events }`.
  - RNG con semilla dentro del estado.
  - Decisiones pendientes en pila.
  - Vistas filtradas por jugador.
  - Cada regla se prueba con un test que cita su `R-xxx`.
- **API del motor** (`crearMotor(cartas, { definiciones?, custom? })`):
  - `reducer(state, { actor, accion })` devuelve `{ ok, state, events }` o `{ ok: false, error }`.
  - `validar` da el código de error de una acción ilegal; `accionesLegales` lista las legales.
  - `getPlayerView` devuelve la vista filtrada de un jugador.
  - `serializar` / `cargar` guardan y cargan partidas.
  - `describirEvento` genera el log en español.
  - Las ventanas no miden tiempo: el host envía `CERRAR_VENTANA` como actor `SISTEMA`, con la `secuencia` de la ventana, cuando vence el temporizador (`duracionMs`).
  - `dadosForzados` solo se usa en tests.
- **Efectos de carta (DSL):**
  - Están en `packages/cards/src/efectos/efectos.json`, indexados por id de carta y validados con
    Zod (`efectos/esquema.ts`).
  - Héroes y Magias tienen `programa` (lista de pasos); Líderes, Monstruos y Objetos tienen
    `pasivas` (bonos, disparadores, restricciones, reemplazos, habilidades); Modificadores,
    Desafío y máscaras son `nucleo`.
  - Lo que no encaja en el DSL es un paso `{ "paso": "custom", "nombre": … }` implementado en
    `packages/engine/src/customs.ts`.
  - Para añadir una carta: añadir su definición en efectos.json (`pnpm validate:cards` exige una
    por carta) y un test en `packages/engine/test/cartas/`. El test de cobertura falla si falta.
- **Motor de efectos:**
  - Un efecto en curso es un marco `efecto` en la pila; una pregunta a un jugador es una
    `decision` encima, que se responde con `RESPONDER`.
  - El intérprete (`interprete.ts`) ejecuta pasos hasta que uno espera.
  - Las pasivas y los disparadores están en `pasivas.ts`.
  - Las operaciones con protecciones y reemplazos (destruir, sacrificar, arrebatar) están en
    `grupo.ts`.
- **Bots** (`packages/bots`):
  - Un bot recibe `{ vista, legales, catalogo, azar }` (lo mismo que un humano) y devuelve una acción, o `null` para no responder en una ventana.
  - `botFacil` elige al azar; `botNormal` usa heurísticas por prioridades.
  - `jugarPartida` (director) hace de host sin pantalla: pregunta a los bots en cada ventana y cierra la de Modificadores cuando nadie juega nada en una ronda.
  - El test de 1.000 partidas tarda unos 75 s.
- **Web** (`apps/web`):
  - React + Zustand + Tailwind 4 + Framer Motion.
  - Las cartas llegan por el módulo virtual `virtual:cartas` (lee `Referencias/cartas.es.json` al compilar) y las imágenes se sirven desde `assets/` en `/cartas/<archivo>`.
  - `DirectorVivo` (`src/juego/director-vivo.ts`) es el host local: temporizadores reales, bots y traspaso del dispositivo. Se prueba con un reloj falso.
  - Todos los textos están en `src/i18n/es.json` (función `t`).
  - Tests con Vitest + Testing Library (jsdom); los del director usan el entorno node.
- **Tests:** Vitest junto a cada paquete (`test/*.test.ts`). Los tests que leen `Referencias/` usan `describe.skipIf` cuando el archivo no existe.
- Prettier: comillas simples, `;`, `printWidth` 100.
