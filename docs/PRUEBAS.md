# Estrategia de pruebas

**Resumen.** Hay dos niveles:

- **Vitest** en cada paquete (`pnpm test`): reglas, cartas, bots, anfitrión, servidor y
  componentes web. Es rápido y determinista: semillas, dados forzados y un reloj manual. Pasa en
  el CI aunque no estén los recursos personales (`Referencias/`), porque los tests que los
  necesitan se saltan solos.
- **Playwright** (`pnpm e2e`): partidas completas pulsando la interfaz real, accesibilidad con
  axe-core, capas y rendimiento. Necesita `Referencias/` y no va en el CI.

Una fase o un cambio está terminado cuando pasan `pnpm lint`, `pnpm typecheck` y `pnpm test`
(`CLAUDE.md`). Documentos relacionados: [ARQUITECTURA.md](ARQUITECTURA.md), [MOTOR.md](MOTOR.md),
[CARTAS_Y_EFECTOS.md](CARTAS_Y_EFECTOS.md), [BOTS.md](BOTS.md), [ANFITRION.md](ANFITRION.md),
[SERVIDOR_Y_PROTOCOLO.md](SERVIDOR_Y_PROTOCOLO.md) y [WEB.md](WEB.md).

## 1. Comandos

| Comando                                                          | Qué ejecuta                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm test`                                                      | `vitest run` en cada paquete (`pnpm -r test`).                                            |
| `pnpm --filter @hts/engine test`                                 | Solo un paquete (`@hts/cards`, `@hts/bots`, `@hts/anfitrion`, `@hts/server`, `@hts/web`). |
| `pnpm --filter @hts/web exec vitest run test/escenario.test.tsx` | Un archivo concreto.                                                                      |
| `pnpm lint` / `pnpm typecheck`                                   | ESLint (TS estricto) y `tsc` en todos los paquetes.                                       |
| `pnpm validate:cards`                                            | Valida `Referencias/cartas.es.json` y exige un efecto por carta.                          |
| `pnpm e2e`                                                       | Compila la web en modo `e2e` y ejecuta Playwright (unos 5 minutos).                       |
| `pnpm sim [n] [semilla]`                                         | Simula partidas entre bots y muestra estadísticas (ver [BOTS.md](BOTS.md)).               |

## 2. Vitest por paquete

Cada paquete tiene su carpeta `test/` con archivos `*.test.ts` (o `.tsx` en la web). Los tests de
reglas citan en su título la regla que comprueban (`R-021a: ROBAR cuesta 1 PA…`) o la duda
resuelta (`D-43`).

| Paquete              | Archivos                                                                                                                               | Qué cubre                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/cards`     | `schema`, `validacion`, `efectos`, `imagenes`                                                                                          | Esquema Zod de las cartas, `validarCartas` (con el archivo real si existe), el DSL de efectos (`problemaDeDefinicion`), que **toda** carta tenga un efecto con la forma correcta y la copia de imágenes (`copiarImagenes`).                                                                                                                      |
| `packages/engine`    | `turno`, `respuestas`, `monstruos`, `victoria`, `clases`, `preparacion`, `rendicion`, `propiedades`, `cartas`, `auditoria`, `cartas/*` | Reglas `R-xxx` con el catálogo mínimo (`fixtures.ts`): turno y PA, desafíos y Modificadores, ataques, victoria normal y difícil, clases, preparación, rendición. `propiedades` comprueba invariantes (conservación de cartas, información oculta en `getPlayerView`, guardar y cargar, log). `cartas/*` prueba **cada carta** del catálogo real. |
| `packages/bots`      | `heuristicas`, `simulacion`                                                                                                            | Prioridades del bot normal y garantías del fácil; **1.000 partidas** bot contra bot sin excepciones, bloqueos ni pérdida de cartas y siempre con ganador (unos 75 s), y que el normal gana al fácil.                                                                                                                                             |
| `packages/anfitrion` | `anfitrion`, `celebracion`, `pausa-resultado`, `presentacion-lider`                                                                    | Desconexión y sustitución por bot, límite por decisión, consultas por jugador, validación del protocolo, rendición; cada **detención** (celebración, pausa de resultado, presentación de Líder), su prioridad, el hot-seat y que al terminar no quede ningún temporizador.                                                                       |
| `apps/server`        | `servidor`, `celebracion`, `red`, `tunel`, `estaticos`, `escritorio`, `icono`                                                          | Salas y lobby, partida en línea completa con clientes reales de `socket.io-client` contra un servidor en un puerto aleatorio, **ninguna filtración de manos ajenas** en lo enviado, salas abandonadas, red local, túnel de Cloudflare (con un `cloudflared` falso), archivos estáticos y el ejecutable de escritorio.                            |
| `apps/web`           | ver la tabla siguiente                                                                                                                 | Componentes con Testing Library (jsdom).                                                                                                                                                                                                                                                                                                         |

Tests de `apps/web/test`:

| Archivo                                                        | Qué comprueba                                                                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `componentes.test.tsx`                                         | Configurar (modos, validaciones) y la mesa: acciones legales e ilegales con motivo, jugar un Héroe, ventana de ataque, equipar, traspaso, detalle de carta, mano. |
| `escenario.test.tsx`                                           | Escenario central: intento, desafío, duelo, Modificadores con `data-accion`, resultados.                                                                          |
| `director-vivo.test.ts` (entorno node)                         | Cuentas atrás de las ventanas, turnos de respuesta y traspaso en hot-seat, bots, guardado.                                                                        |
| `partida.test.tsx`                                             | Partida completa entre bots pintando la mesa en cada estado; celebración e `inert` (catálogo real).                                                               |
| `celebracion-monstruo.test.tsx`, `presentacion-lider.test.tsx` | Fases de cada animación, bloqueo del puntero, «Reducir animaciones» y montaje a mitad (reconexión).                                                               |
| `presentacion-lider-integracion.test.tsx`                      | `Anfitrion` real, catálogo real y mesa: cada activación de un Líder se presenta (R-082).                                                                          |
| `rotulo-turno.test.tsx`                                        | Cuándo aparece el rótulo, que espera al traspaso y su modo compacto.                                                                                              |
| `contador-clases.test.tsx`                                     | Desglose de clases, teclado y `estadoClases`.                                                                                                                     |
| `vuelos.test.ts` (entorno node)                                | Agrupación de vuelos y qué ve cada jugador (información oculta).                                                                                                  |
| `capas.test.ts`                                                | El orden de `CAPA`.                                                                                                                                               |
| `carta-imagen.test.tsx`, `logo.test.tsx`                       | Reserva y reintento de imágenes; logo con y sin imagen.                                                                                                           |
| `enlinea.test.tsx`                                             | `ClienteEnLinea` y la pantalla `Sala` contra un servidor real (`@hts/server`).                                                                                    |
| `invitar.test.tsx`                                             | Enlaces de invitación y túnel.                                                                                                                                    |
| `auditoria.test.tsx`                                           | Preguntas que enseñan cartas ajenas y los PA con la Megababosa (catálogo real).                                                                                   |

`apps/web/vitest.config.ts` usa jsdom y `test/preparar.ts` (los _matchers_ de
`@testing-library/jest-dom`). Los archivos que no necesitan DOM declaran `// @vitest-environment node`.

### Catálogo real frente a fixtures

- **Catálogo mínimo (`packages/engine/test/fixtures.ts`).** `CATALOGO` es un conjunto pequeño de
  cartas inventadas para pruebas (por ejemplo `monstruo_h`), validadas con `CartaSchema`. No
  depende de `Referencias/`, así que estos tests pasan siempre, también en el CI. El archivo trae
  utilidades para montar escenarios: `nuevoMotor`, `nuevaPartida`, `escenario` (manos vacías,
  turno de un jugador con 3 PA, Líderes y Monstruos concretos), `darCarta`, `ponerHeroe`,
  `forzarDados`, `hacer` (acción legal que además comprueba la conservación de cartas),
  `rechazo`, `cerrar`, `todosPasan`, `cima`, `tipos` y los jugadores `A`, `B` y `C`.
- **Catálogo real (`packages/engine/test/cartas/reales.ts`).** Carga `Referencias/cartas.es.json`
  si existe y exporta `HAY_CATALOGO`, `CARTAS`, `motor` y `describeReal`
  (`describe.skipIf(!HAY_CATALOGO)`), además de utilidades (`mesa`, `mano`, `heroe`,
  `monstruo`, `ponerLider`…). Lo usan los tests de cartas, la auditoría, los bots y algunos de la
  web y del anfitrión.

### No añadas cartas a `CATALOGO`

Otros paquetes (web, servidor y anfitrión) juegan **partidas con semilla** sobre `CATALOGO`:
añadirle una carta cambiaría el mazo barajado y rompería esas partidas. Si una prueba necesita
otra carta, crea un catálogo aparte, como `CATALOGO_CON_MASCARA_CAZADOR` (el `CATALOGO` más una
máscara de Cazador), o usa el catálogo real con `describeReal`. `motorConEspia(cartaId)` crea un
motor cuyo efecto para una carta solo registra sus activaciones.

### Tests sin `Referencias/`

`Referencias/` y `assets/cartas/` son personales y no se versionan. Todo test que los lee usa
`describe.skipIf` (directamente con `existsSync(RUTA_CARTAS_JSON)` o mediante `describeReal` y
`HAY_CATALOGO`). Sin los recursos, `pnpm test` pasa saltándose esos bloques. Con ellos instalados
(`pnpm recursos`) se ejecuta todo.

### Cobertura de cartas y auditoría

- `packages/cards/test/efectos.test.ts`: con el archivo real, `validarCartas` con
  `efectosObligatorios: true` exige una definición válida en `efectos.json` para cada carta (lo
  mismo que `pnpm validate:cards`).
- `packages/engine/test/cartas/nucleo.test.ts` («cada carta del catálogo tiene al menos un test
  propio»): lee todos los `*.test.ts` de `test/cartas/` y falla si el id de alguna carta no
  aparece en ellos. Al añadir una carta hay que añadir su test (ver `/nueva-carta` y
  [CARTAS_Y_EFECTOS.md](CARTAS_Y_EFECTOS.md)).
- **Auditoría** (`packages/engine/test/auditoria.test.ts` y `apps/web/test/auditoria.test.tsx`):
  pruebas de un informe de QA carta a carta sobre elecciones que se resuelven solas y sobre la
  información que el jugador debe ver (D-40), en el motor y en la interfaz.

### Reloj manual

El `Anfitrion` no usa `setTimeout` directamente, sino la interfaz `Reloj`
(`{ ahora, programar, cancelar }`). En los tests se usa `RelojManual`
(`packages/anfitrion/src/reloj-manual.ts`, exportado por `@hts/anfitrion`): el tiempo solo avanza
con `reloj.avanzar(ms)`, que ejecuta en orden las tareas que vencen. `pendientes` dice cuántas
quedan (útil para comprobar que no queda ningún temporizador). La web lo reexporta como
`RelojFalso` en `test/utilidades.ts`, y el servidor lo pasa a `crearServidor({ reloj })`.

### Opciones del anfitrión en los tests

Las detenciones (celebración de 4 s, pausa de resultado de 3 s y presentación de Líder de 4 s)
cambian los tiempos y bloquean las acciones. Para que un test no dependa de ellas, se desactivan
con `0`, salvo la que se esté probando:

```ts
new DirectorVivo(motor, config, estado, reloj, {
  retardoBotMs: 100,
  celebracionMs: 0,
  pausaResultadoMs: 0,
  presentacionLiderMs: 0,
});
```

Así lo hace `directorEn` en `apps/web/test/utilidades.ts`, y lo mismo los tests del anfitrión
(cada archivo deja activa solo su detención). Los tests del servidor arrancan con
`arrancar(motor, opciones)` (`apps/server/test/utilidades.ts`), que usa `RelojManual` y
`retardoBotMs: 100`; un test que quiere una detención la pide (`{ celebracionMs: 4000 }`).

## 3. Pruebas e2e con Playwright (`apps/e2e`)

### Cómo se lanzan

`pnpm e2e` hace dos cosas:

1. `pnpm --filter @hts/web build:e2e`: compila la web con `vite build --mode e2e` en
   `apps/web/dist-e2e`. Esta compilación incluye el **piloto** y usa las opciones cortas del
   director local (`OPCIONES_DIRECTOR` en `apps/web/src/juego/opciones.ts`).
2. `playwright test` en `apps/e2e`. `playwright.config.ts` arranca el servidor real
   (`pnpm --filter @hts/server start`) en el **puerto 3100** (para no chocar con un
   `pnpm servidor` abierto en el 3000), sirviendo `dist-e2e`, y espera a `/api/estado`.

Variables de entorno del servidor de pruebas (tiempos cortos para que las partidas en línea
vayan rápidas):

| Variable                | Valor               | Opción del anfitrión  |
| ----------------------- | ------------------- | --------------------- |
| `PUERTO`                | `3100`              | —                     |
| `DIR_WEB`               | `apps/web/dist-e2e` | —                     |
| `RETARDO_BOT_MS`        | `40`                | `retardoBotMs`        |
| `CELEBRACION_MS`        | `300`               | `celebracionMs`       |
| `PAUSA_RESULTADO_MS`    | `50`                | `pausaResultadoMs`    |
| `PRESENTACION_LIDER_MS` | `50`                | `presentacionLiderMs` |

Además, `apps/e2e/src/preparar.ts` pone las ventanas de desafío y de Modificadores a 1 s en
«Opciones avanzadas» (local) o en el lobby (en línea).

Configuración: Chrome de escritorio a 1440×900, `reducedMotion: 'reduce'` (salvo en las pruebas de
capas), 3 _workers_ en paralelo, sin reintentos, 15 min por prueba, traza y captura solo en los
fallos. El proyecto `rendimiento` se ejecuta al final, cuando ha terminado `funcional`, para que
no lo falseen otras pruebas en paralelo. Los resultados quedan en `apps/e2e/informe` (HTML) y
`apps/e2e/resultados`.

**No ejecutes dos `pnpm e2e` a la vez:** las dos compilaciones escribirían en el mismo
`dist-e2e` y los dos servidores pedirían el mismo puerto 3100 (`reuseExistingServer: false`).

### Especificaciones

| Spec                    | Qué comprueba                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partidas.spec.ts`      | Partidas completas hasta la victoria: contra 2 bots (reglas normales); 3 personas en este dispositivo; reglas difíciles contra 1 bot, recargando a mitad y siguiendo con «Continuar partida» (autoguardado), y revancha; en línea con 2 navegadores y 1 bot y una recarga a mitad (reconexión con la sesión guardada). Ninguna debe producir errores en la consola. |
| `rendicion.spec.ts`     | Rendirse (D-43): contra bots se puede ver la partida hasta el final; en línea, si una persona se rinde, gana la otra aunque quede un bot.                                                                                                                                                                                                                           |
| `accesibilidad.spec.ts` | axe-core (WCAG 2.1 A/AA) en inicio, configuración, reglas, tutorial, mesa, menú, detalle de carta y pantallas en línea (crear sala y lobby), en tema claro y oscuro; los modales atrapan el foco, se cierran con Escape y lo devuelven; jugar una carta solo con el teclado.                                                                                        |
| `capas.spec.ts`         | Con animaciones activas y en los dos temas: la ficha de carta y el rótulo de turno quedan por encima de un vuelo en curso (z-index real de `ui/capas.ts`).                                                                                                                                                                                                          |
| `invitacion.spec.ts`    | El enlace `?sala=CÓDIGO` lleva directo a unirse con el código puesto (el túnel se prueba en el servidor, con un `cloudflared` falso).                                                                                                                                                                                                                               |
| `rendimiento.spec.ts`   | Mesa de 6 jugadores (1 persona y 5 bots) durante 60 pasos: cuenta los fotogramas de más de 50 ms y el tiempo hasta ver la portada; comprueba además que el medidor detecta un bloqueo provocado.                                                                                                                                                                    |

<a id="el-piloto"></a>

### El piloto

Las partidas e2e no siguen un guion fijo: las juega un **piloto** que decide como el bot normal y
actúa **pulsando la interfaz**, como lo haría una persona. Tiene dos mitades:

1. **En la página** (`apps/web/src/e2e/piloto.ts`, solo en la compilación `--mode e2e`). `Mesa`
   registra la mesa activa en `window.__htsMesa`, y el piloto expone `window.__hts.estado()`
   (`version`, observador, turno, ganador) y `window.__hts.sugerencia()`, que devuelve un `Paso`:
   - `esperar` si hay celebración, pausa de resultado o presentación de Líder, o si nadie de esta
     página debe actuar;
   - `fin` si hay ganador;
   - `traspaso` si hay que confirmar el dispositivo (hot-seat);
   - `accion` con la acción que elige `BOTS.normal` sobre la vista y las legales (con un RNG con
     semilla `piloto-e2e`) y su `clave`;
   - en hot-seat, dentro de una ventana, `responder` para que otro humano responda (si el bot
     normal jugaría algo en su lugar) y `terminarRespuesta`.
2. **En Playwright** (`apps/e2e/src/piloto.ts`). `ejecutar(page, paso)` traduce cada paso en
   clics sobre los atributos `data-*` de la interfaz (ver
   [WEB.md](WEB.md#14-piloto-e2e-y-atributos-data-)):
   - jugar una carta: la carta de la mano por `data-uid` y luego `data-accion`; para un Objeto,
     `data-equipar` y el Héroe por `data-uid` dentro de `data-zona="grupo:…"`;
   - desafiar: el primer botón cuyo `data-accion` empieza por `{"tipo":"DESAFIAR"`;
   - elegir cartas: cada `data-uid` del diálogo (sin desmarcar las ya elegidas) y
     `data-confirmar`;
   - responder: `data-respuesta` o `data-indice`;
   - traspaso, respuestas en hot-seat: `data-traspaso`, `data-responde`,
     `data-terminar-respuesta`;
   - todo lo demás: `data-accion`.

`jugarHastaElFinal(paginas, opciones)` recorre en bucle las páginas (una por navegador en línea):
pide la sugerencia, la ejecuta y espera hasta 3 s a que cambie la `version` del estado, porque en
línea la respuesta del servidor tarda y, sin esperar, se pulsaría un botón a punto de desaparecer.
Si un clic falla (por ejemplo, venció la ventana entre la sugerencia y el clic), vuelve a
preguntar. Si nada cambia durante `maxQuietoMs` (45 s por defecto), la prueba falla con la última
firma de estado. Opciones: `alPaso` (por ejemplo, recargar a mitad), `maxPasos`. Al terminar,
comprueba que todas las páginas muestran la victoria.

`apps/e2e/src/preparar.ts` reúne los pasos de preparación desde la interfaz: `empezarLocal`,
`nuevaPagina` (contexto aislado, como otro dispositivo), `crearSala`, `unirseASala`,
`empezarSala` y `rendirse`.

### Variables de depuración

| Variable                 | Efecto                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `HTS_TRAZA=1`            | El piloto imprime cada cambio de estado (tiempo, versión y paso de cada página) y los clics fallidos. |
| `HTS_CAPTURAS=<carpeta>` | `capas.spec.ts` guarda una captura de cada caso en esa carpeta.                                       |

Ejemplo (desde la raíz, con la web ya compilada en modo e2e):

```sh
HTS_TRAZA=1 pnpm --filter @hts/e2e exec playwright test pruebas/partidas.spec.ts
```

## 4. Integración continua

`.github/workflows/ci.yml` (job «Lint, tipos y tests») se ejecuta en cada _push_ y _pull request_
a `main`, en Ubuntu, con la versión de Node de `.nvmrc` y pnpm. Pasos: `pnpm install
--frozen-lockfile`, `pnpm lint`, `pnpm typecheck` y `pnpm test`. Como el CI no tiene
`Referencias/`, los tests con catálogo real se saltan, y **ni `pnpm e2e` ni
`pnpm validate:cards` se ejecutan allí**: hay que pasarlos en local. Un _push_ nuevo cancela el
anterior de la misma rama (`concurrency`).

## 5. `/verificar`

Comando de Claude Code (`.claude/commands/verificar.md`) que ejecuta, sin detenerse en el primer
fallo y sin cambiar archivos:

1. `pnpm exec prettier --check .`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm validate:cards`
6. `pnpm e2e`, solo con el argumento `e2e` (`/verificar e2e`).

Además comprueba con `git status --short` que no hay archivos de `Referencias/` ni
`assets/cartas/` preparados para commit, y termina con una tabla de resultados que indica qué
agente debe arreglar cada fallo.

## 6. Cómo depurar un fallo

**Un test de Vitest.**

1. Ejecuta solo ese archivo (`pnpm --filter <paquete> exec vitest run <ruta>`) o filtra por nombre
   con `-t "<título>"`.
2. Si es del motor, reprodúcelo con `escenario` + `darCarta`/`ponerHeroe` + `forzarDados` del
   catálogo mínimo; el título debe citar la `R-xxx`. Si toca una regla dudosa, consulta
   [DUDAS_REGLAS.md](DUDAS_REGLAS.md).
3. Si interviene el tiempo, usa `RelojManual` y `avanzar(ms)`; comprueba `pendientes` para ver si
   queda algún temporizador.
4. Si una partida con semilla de la web, el servidor o el anfitrión cambia de rumbo sin motivo,
   comprueba que nadie ha añadido cartas a `CATALOGO`.
5. Si un test de la web falla solo por tiempos, revisa que las detenciones estén a `0` en sus
   opciones.

**Una prueba e2e.**

1. Abre el informe: `pnpm --filter @hts/e2e exec playwright show-report informe`. Las pruebas
   fallidas guardan traza (`trace: 'retain-on-failure'`) y captura en `apps/e2e/resultados`; la
   traza se abre con `pnpm --filter @hts/e2e exec playwright show-trace <archivo.zip>`.
2. Repite solo esa spec con `HTS_TRAZA=1` para ver cada paso del piloto. «La partida no avanza
   desde hace 45000 ms» con la misma firma suele indicar:
   - un botón sin el `data-*` que espera el piloto (un botón de acción nuevo sin `data-accion`);
   - una detención que no termina (comprueba `celebracion`, `pausaResultado` y
     `presentacionLider` en la fuente);
   - un modal que tapa el botón (capas; ver [WEB.md](WEB.md#7-capas-y-detenciones)).
3. Si sospechas de la interfaz y no del motor, reprodúcelo con un test de componente en
   `apps/web/test` (es más rápido); si es del motor, con un test en `packages/engine/test`.
4. Recuerda que `pnpm e2e` usa la compilación `dist-e2e`: tras cambiar la web, vuelve a lanzar
   `pnpm e2e` completo (no solo `playwright test`).

En el flujo de agentes (`CLAUDE.md`), `qa` reproduce el fallo con un test y se lo devuelve al
especialista; `qa` no arregla código de producción.
