# Here to Slay — versión digital en español (uso personal)

Especificación completa: [PROMPT_HERE_TO_SLAY.md](PROMPT_HERE_TO_SLAY.md). Se trabaja **una fase
por sesión**. Antes de escribir código, presenta el plan de la fase y espera la aprobación.

## Estado de las fases

- [x] Fase 0 — Análisis (reglas, esquema de cartas, transcripción, validador)
- [x] Fase 1 — Motor núcleo
- [x] Fase 2 — Cartas (DSL + todos los efectos con test)
- [x] Fase 3 — Bots + simulación de 1.000 partidas
- [x] Fase 4 — UI local (hot-seat y contra bots)
- [x] Fase 5 — Multijugador en línea
- [x] Fase 6 — Pulido, e2e con Playwright y README

## Fuentes de verdad

- Reglas: `Referencias/Reglas.pdf`, resumido como especificación en [docs/REGLAS.md](docs/REGLAS.md) (ids `R-xxx`).
- Ambigüedades: [docs/DUDAS_REGLAS.md](docs/DUDAS_REGLAS.md) (ids `D-xx`). No inventes reglas: si algo no está claro, añade una `D-xx`, aplica la lectura más literal y marca el código con `// TODO(regla) D-xx`.
- Cartas: `Referencias/cartas.es.json`, validado con el esquema Zod de `packages/cards/src/schema.ts`.
- `Referencias/` y `assets/cartas/` son personales (arte y textos oficiales de Unstable Games) y **no se versionan aquí** (`.gitignore`): este repositorio es público. Su copia de seguridad está en el repositorio privado `dbermudeza/here-to-slay-recursos` y se instalan con `pnpm recursos` (o `pnpm recursos --desde <carpeta>`). Nunca añadas al repositorio arte, el reglamento ni textos oficiales de las cartas. No descargues ni generes arte o texto oficial desde internet.

## Estructura

```
packages/engine   Motor de reglas puro y determinista (sin UI ni red)       — Fase 1
packages/cards    Esquema Zod, validación, scripts de datos; registro de efectos — Fase 0/2
packages/bots     IA fácil/normal (misma API de acciones que un humano)     — Fase 3
packages/anfitrion Host de partida (temporizadores, bots, conexiones) y protocolo de red — Fase 4/5
apps/server       Fastify + Socket.IO, servidor autoritativo                — Fase 5
apps/web          React + Vite + Zustand + Tailwind + Framer Motion         — Fase 4/5
apps/e2e          Playwright: partidas completas, accesibilidad y rendimiento — Fase 6
docs/             Documentación (índice en docs/README.md): arquitectura, motor, cartas, anfitrión,
                  servidor, web, escritorio, despliegue, pruebas, glosario; REGLAS.md y DUDAS_REGLAS.md
render.yaml       Despliegue del servidor en Render (plan gratuito; docs/DESPLIEGUE.md)
```

## Comandos

```sh
pnpm install          # dependencias (pnpm 9; si falta: npm i -g pnpm@9)
pnpm dev              # aplicación web en http://localhost:5173
pnpm servidor         # compila la web y arranca el servidor en línea en :3000 (docs/EN_LINEA.md)
pnpm lint             # ESLint (TS estricto)
pnpm typecheck        # tsc en todos los paquetes
pnpm test             # Vitest en todos los paquetes
pnpm e2e              # Playwright (necesita Referencias/; no va en el CI), ~5 min
pnpm validate:cards   # valida Referencias/cartas.es.json (errores → exit 1)
pnpm recursos         # instala Referencias/ y assets/cartas/ (repo privado de recursos o --desde <carpeta>;
                      # sin sesión de Git, con HTS_RECURSOS_TOKEN)
pnpm copy:images      # copia Referencias/Imagenes/Cartas/** → assets/cartas/<id>.png
pnpm sim [n] [semilla] # simula n partidas entre bots y muestra estadísticas
```

Una fase está terminada cuando `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan, y se cierra con
un commit descriptivo.

## Agentes (`.claude/agents/`)

La sesión principal es el **orquestador**: habla con el usuario, presenta el plan (y espera su
aprobación), reparte el trabajo, integra, hace los commits y resume. Delega en:

| Agente         | Ámbito                                        | Edita                                                      | Modelo |
| -------------- | --------------------------------------------- | ---------------------------------------------------------- | ------ |
| `motor-reglas` | Reglas, cartas, bots, anfitrión (`packages/`) | `packages/**`, `docs/REGLAS.md`, `docs/DUDAS_REGLAS.md`    | opus   |
| `frontend-ux`  | Pantallas, textos, accesibilidad (`apps/web`) | `apps/web/**`, selectores de `apps/e2e/src`                | sonnet |
| `qa`           | Tests, verificación, reproducción de errores  | Solo tests: `packages/*/test`, `apps/web/test`, `apps/e2e` | sonnet |
| `documentador` | Documentación técnica y de uso                | `docs/**` (salvo REGLAS/DUDAS), `README.md`                | sonnet |
| `revisor`      | Revisión del diff antes del commit            | Nada (solo lectura)                                        | sonnet |

Flujo: plan → especialistas (en paralelo si no tocan los mismos archivos) → `qa` (si algo falla,
vuelve al especialista con el test que falla; `qa` no arregla código) → `documentador` (si cambia la
arquitectura, un contrato, un comando o lo que ve el jugador) → `revisor` → commit. Cada agente
termina con un informe en el formato de su archivo.

Propiedad: cada especialista escribe y actualiza los tests de su propio cambio; `qa` añade tests
nuevos y verifica, sin trabajar a la vez sobre la misma zona. El **orquestador** lleva
`apps/server` (y sus tests), la configuración raíz (`package.json`, ESLint, TypeScript, Prettier),
`.github/`, `.claude/` y `CLAUDE.md`. La documentación (`docs/**` salvo REGLAS/DUDAS, y
`README.md`) es del `documentador`.

Comandos: `/verificar [e2e]` (todas las comprobaciones), `/nueva-carta <id>`, `/fase <trabajo>`
(plan repartido por agentes), `/documentar [tema]` (revisión de la documentación). Un hook
(`.claude/hooks/formatear.mjs`) formatea con Prettier cada archivo que se edita.

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
  - La mesa lee de una `FuenteMesa` (`src/juego/fuente.ts`): en local es el `Anfitrion` (reexportado como `DirectorVivo`); en línea, `ClienteEnLinea` (`src/enlinea/cliente.ts`), que guarda la sesión en localStorage (`hts:sesion`) para reconectar.
  - Todos los textos están en `src/i18n/es.json` (función `t`).
  - Tests con Vitest + Testing Library (jsdom); los del director usan el entorno node.
- **Anfitrion** (`packages/anfitrion`):
  - `Anfitrion` es el host de una partida, compartido por la web (local) y el servidor: temporizadores con la interfaz `Reloj` (en tests, `RelojManual`), bots, traspaso del dispositivo y, en línea, desconexión (60 s de espera, luego juega un bot normal), reconexión y límite opcional por decisión.
  - `protocolo.ts` define los mensajes Socket.IO y los esquemas Zod con los que el servidor valida todo lo que llega de un cliente.
- **Servidor** (`apps/server`):
  - `crearServidor` (Fastify + Socket.IO) gestiona salas en memoria (código de 5 caracteres, token por asiento) y sirve `apps/web/dist`.
  - El actor de una acción es siempre el jugador de la conexión; cada cliente recibe solo su vista filtrada.
  - Tests con clientes reales de socket.io-client contra un servidor en un puerto aleatorio.
  - Desplegado en internet (Render, `render.yaml`), `CLAVE_ACCESO` protege todo con contraseña
    (`acceso.ts`: página `/acceso`, cookie firmada; Socket.IO con `allowRequest`); `/salud` es
    público. Las cartas y el arte nunca se publican sin esa contraseña.
- **E2E** (`apps/e2e`):
  - `pnpm e2e` compila la web en modo `e2e` (`apps/web/dist-e2e`) y arranca el servidor en el puerto 3100.
  - El **piloto** (`apps/web/src/e2e/piloto.ts`, solo existe en la compilación `--mode e2e`) expone `window.__hts.sugerencia()`: lo que haría el bot normal. `apps/e2e/src/piloto.ts` lo ejecuta pulsando la interfaz y espera a que cambie la versión del estado antes del siguiente paso.
  - La interfaz lleva atributos para las pruebas: `data-accion` (clave canónica de la acción, `clave()` en `pantallas/mesa/contexto.tsx`), `data-respuesta`, `data-uid`, `data-indice`, `data-equipar`, `data-traspaso`, `data-responde`, `data-confirmar`, `data-terminar-respuesta`. Un botón de acción nuevo debe llevar su `data-accion`.
  - `accesibilidad.spec.ts` pasa axe-core (WCAG 2.1 AA) por cada pantalla en tema claro y oscuro: el texto secundario usa `text-stone-600 dark:text-stone-400` (no `stone-500`).
  - `HTS_TRAZA=1` muestra cada paso del piloto y los clics fallidos.
- **Accesibilidad:** `Modal` atrapa el foco, se cierra con Escape (si tiene `onCerrar`) y devuelve el foco; "Reducir animaciones" (Ajustes) sigue por defecto a `prefers-reduced-motion` (`useReducirAnimaciones`).
- **Rendimiento:** las pantallas que no son la portada se cargan con `React.lazy`; el director (`juego/director-vivo`), el guardado y el cliente en línea, con `import()`. No importes módulos pesados desde `Inicio`/`App` de forma estática.
- **Tests:** Vitest junto a cada paquete (`test/*.test.ts`). Los tests que leen `Referencias/` usan `describe.skipIf` cuando el archivo no existe (por si se usa el código sin los recursos).
- Prettier: comillas simples, `;`, `printWidth` 100.
