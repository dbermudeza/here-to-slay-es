# Here to Slay — versión digital en español

Adaptación digital **no oficial**, para uso **personal y no comercial**, del juego de cartas
_Here to Slay_ (Unstable Games), en español y fiel a las reglas del juego base. Se juega en el
navegador: en un mismo dispositivo, contra bots o en línea con amigos.

> ℹ️ Este repositorio contiene **solo el código** del juego. Las ilustraciones, el reglamento y los
> textos de las cartas son de Unstable Games y **no se incluyen**: para jugar necesitas tus propios
> recursos (ver [Recursos de las cartas](#recursos-de-las-cartas)).

## Índice

- [Inicio rápido](#inicio-rápido)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Recursos de las cartas](#recursos-de-las-cartas)
- [Jugar](#jugar)
- [Cómo se juega en la pantalla](#cómo-se-juega-en-la-pantalla)
- [Ajustes y accesibilidad](#ajustes-y-accesibilidad)
- [Configuración](#configuración)
- [Arquitectura](#arquitectura)
- [Documentación](#documentación)
- [Desarrollo](#desarrollo)
- [Tests y CI](#tests-y-ci)
- [Contribuir](#contribuir)
- [Seguridad](#seguridad)
- [Solución de problemas](#solución-de-problemas)
- [Licencia y aviso legal](#licencia-y-aviso-legal)

## Inicio rápido

```sh
git clone https://github.com/dbermudeza/here-to-slay-es.git
cd here-to-slay-es
pnpm install
pnpm recursos     # instala las cartas (ver "Recursos de las cartas")
pnpm dev          # en este equipo: http://localhost:5173
pnpm servidor     # en línea con amigos: http://localhost:3000
```

## Requisitos

| Herramienta                                              | Versión             | Para qué                                      |
| -------------------------------------------------------- | ------------------- | --------------------------------------------- |
| [Node.js](https://nodejs.org/)                           | 24 (la de `.nvmrc`) | Ejecutar la aplicación y el servidor          |
| [pnpm](https://pnpm.io/)                                 | 9                   | Dependencias del monorepo                     |
| [Git](https://git-scm.com/)                              | cualquiera reciente | Clonar el repositorio                         |
| [cloudflared](https://github.com/cloudflare/cloudflared) | opcional            | Jugar en línea por internet sin abrir puertos |
| Chromium de Playwright                                   | opcional            | Tests e2e (`pnpm e2e`)                        |

## Instalación

Pasos para Windows desde cero; en macOS y Linux son los mismos con su terminal.

1. **Node.js 24**: descárgalo de [nodejs.org](https://nodejs.org/) e instálalo con las opciones por
   defecto. Comprueba en una terminal nueva: `node --version`. Con
   [nvm](https://github.com/nvm-sh/nvm) o [fnm](https://github.com/Schniz/fnm) basta con `nvm use` /
   `fnm use` en la carpeta del proyecto.
2. **pnpm 9**: `npm install -g pnpm@9` (o `corepack enable`). Comprueba: `pnpm --version`.
3. **Git**: desde [git-scm.com](https://git-scm.com/) (en Windows, "Git for Windows").
4. **El proyecto**:

   ```sh
   git clone https://github.com/dbermudeza/here-to-slay-es.git
   cd here-to-slay-es
   pnpm install
   ```

5. **Instala los recursos de las cartas** (ver la sección siguiente):

   ```sh
   pnpm recursos
   ```

6. **Comprueba que todo está bien**:

   ```sh
   pnpm validate:cards   # las cartas cumplen el esquema y tienen su efecto
   pnpm test             # todos los tests (unos 2 minutos)
   ```

7. **Opcional, para jugar por internet**: instala `cloudflared`
   (`winget install --id Cloudflare.cloudflared` en Windows, `brew install cloudflared` en macOS).

> 💡 Mejor fuera de OneDrive (por ejemplo en `C:\proyectos\`): OneDrive sincroniza miles de
> archivos de `node_modules` sin necesidad y puede bloquear la carpeta de compilación.

## Recursos de las cartas

El juego necesita los datos de las cartas, que **no están en este repositorio** (son ilustraciones y
textos de Unstable Games). Van en dos carpetas, ignoradas por Git:

```
Referencias/
  cartas.es.json              # imprescindible: las cartas transcritas y traducidas
  Reglas.pdf                  # opcional: el reglamento
  Imagenes/Cartas/<tipo>/*.png  # opcional: las imágenes originales
assets/cartas/                # imágenes con el id de cada carta (se generan solas)
```

`pnpm recursos` las instala de una de estas formas y, al terminar, prepara las imágenes y comprueba
las cartas:

1. **Desde el repositorio privado de recursos** (si el propietario te ha dado acceso):

   ```sh
   pnpm recursos
   ```

   Descarga `dbermudeza/here-to-slay-recursos` con tu sesión de Git (si falla, inicia sesión con
   `gh auth login`). Para usar otro repositorio: `pnpm recursos --repo <url>` o la variable
   `HTS_RECURSOS_REPO`. Para descargarlos sin sesión de Git, como en un servidor, define
   `HTS_RECURSOS_TOKEN` con un token de GitHub de solo lectura (más en
   [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md#cómo-usa-el-token-pnpm-recursos)).

2. **Desde una carpeta** (una copia de seguridad, un disco externo…):

   ```sh
   pnpm recursos --desde D:\copias\here-to-slay
   ```

   La carpeta puede ser la que contiene `Referencias/` (y, si la tiene, `assets/cartas/`) o la propia
   carpeta `Referencias`. Para reemplazar unos recursos ya instalados, añade `--forzar`.

3. **Con tus propios archivos**, a partir de tu copia física del juego: crea
   `Referencias/cartas.es.json` con el formato de
   [`packages/cards/src/schema.ts`](packages/cards/src/schema.ts). Cada carta lleva su `id`, `tipo`,
   `nombre`, `nombreOriginal`, `copias`, `texto` y `textoOriginal` (y los campos propios de su tipo:
   `clase` y `tirada` en los Héroes, `requisitos`, `exito` y `fracaso` en los Monstruos…). Los `id`
   deben coincidir con los de [`efectos.json`](packages/cards/src/efectos/efectos.json), que define
   lo que hace cada carta. `pnpm validate:cards` te dirá exactamente qué falta o sobra.

Las **imágenes son opcionales**: sin ellas cada carta se dibuja con su nombre, tipo y texto, y el
juego es igual de jugable. Si las tienes, ponlas en `Referencias/Imagenes/Cartas/`, indica en cada
carta `imagen` (nombre final) y `origenImagen` (ruta original) y ejecuta `pnpm copy:images`.

Sin `cartas.es.json` la aplicación muestra "Faltan las cartas" y los tests que usan el catálogo real
se saltan solos (así funciona el CI).

## Jugar

### En este equipo (contra bots o pasándose el dispositivo)

```sh
pnpm dev
```

Abre **http://localhost:5173**. Desde la portada:

- **Jugar contra bots**: tú contra 1–5 bots. Dificultad _fácil_ (juegan al azar), _normal_ (piensan
  sus jugadas) o _mixta_ (alternados).
- **Jugar en este dispositivo**: de 2 a 6 personas que se pasan el dispositivo. Entre turnos la
  mesa se tapa con "Pásale el dispositivo a…" para que nadie vea la mano de otro.
- **Continuar partida**: la partida se guarda sola tras cada jugada; si cierras el navegador,
  retómala desde aquí. También puedes **guardarla en un archivo** (Menú → Guardar partida en un
  archivo) y **cargarla** después desde la portada.

En la configuración eliges las **reglas** (normales o difíciles) y, en "Opciones avanzadas", la
duración de las ventanas de desafío y de Modificadores y una **semilla** para repetir una partida.

### En línea con amigos

```sh
pnpm servidor
```

Compila la aplicación y arranca el servidor en el puerto 3000. Desde ese equipo, abre
`http://localhost:3000` y **crea la sala**. En "Invitar a jugar" tienes enlaces para copiar y enviar,
con el código ya puesto: uno para la red de casa y, con el botón **Abrir acceso por internet**, otro
para jugar por internet mediante un túnel de Cloudflare (sin contratar ningún servidor ni tocar el
router). Los detalles están en **[docs/EN_LINEA.md](docs/EN_LINEA.md)**. Si tu red bloquea el túnel
o quieres una dirección fija, puedes desplegar el servidor en la nube (Render, plan gratuito, con
contraseña): **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**.

### Con doble clic (ejecutable de escritorio)

```sh
pnpm empaquetar
```

Genera `dist-app/HereToSlay/` con `HereToSlay.exe` (con el logo del juego como icono), la web
compilada y las cartas. Al abrir `HereToSlay.exe` arranca el servidor y abre el navegador; cerrar su
ventana lo detiene. No necesita Node ni pnpm, así que la carpeta se puede copiar a otro equipo.
Vuelve a ejecutar `pnpm empaquetar` cuando cambie el código. Detalles en
[docs/ESCRITORIO.md](docs/ESCRITORIO.md). La carpeta contiene el arte y los textos de las cartas: es
personal y no se versiona.

En línea, el creador puede añadir bots; si alguien se desconecta se le esperan 60 s y después un
bot juega por él hasta que vuelve; y se puede poner un tiempo máximo por decisión.

## Cómo se juega en la pantalla

| Quiero…                          | Cómo                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Robar, renovar la mano, terminar | **Robar**, **Descartar mano y robar 5** y **Terminar turno** (indican su coste en PA)                 |
| Jugar una carta de la mano       | Pulsa la carta y después **Jugar** (Héroes y Magias) o **Equipar a un Héroe** (Objetos)               |
| Equipar un Objeto                | **Equipar a un Héroe** y pulsa el Héroe que lo llevará (se resaltan los posibles, también rivales)    |
| Usar el efecto de un Héroe       | **Usar efecto** bajo el Héroe de tu Grupo                                                             |
| Atacar a un Monstruo             | **Atacar** bajo el Monstruo del centro                                                                |
| Desafiar o jugar un Modificador  | En el panel de la ventana (con cuenta atrás) que aparece cuando es posible                            |
| Ver una carta en grande          | Clic en cualquier carta de la mesa; **doble clic** en las de tu mano (o **Ver carta**)                |
| Ver el historial                 | Panel derecho (en pantallas pequeñas, **Ver historial**)                                              |
| Responder en "este dispositivo"  | En las ventanas, **Responde X** pasa el dispositivo a X; al acabar, **He terminado**                  |
| Rendirse                         | **Menú → Rendirse**: puedes ver la partida o salir; si los demás humanos se rinden, gana el que queda |

Un botón gris no está disponible: pasa el ratón por encima para ver por qué (por ejemplo, "No te
quedan suficientes puntos de acción"). Las reglas completas están en la portada (**Reglas**) y en el
menú de la partida; el **Tutorial** resume un turno paso a paso.

## Ajustes y accesibilidad

En la portada y en el menú de la partida:

- **Tema**: automático (el del sistema), claro u oscuro.
- **Reducir animaciones**: sin vuelos de cartas ni giros de dados. Por defecto sigue la preferencia
  del sistema.

Toda la aplicación se puede usar con el **teclado**: `Tab`/`Mayús+Tab` para moverse, `Enter` o
`Espacio` para pulsar o elegir cartas, y `Escape` para cerrar ventanas (las decisiones obligatorias
no se cierran). Las ventanas mantienen el foco dentro y lo devuelven al cerrarse, y los lectores de
pantalla anuncian cada línea nueva del historial. Cada pantalla se revisa con axe-core (WCAG 2.1 AA).

## Configuración

El servidor (`pnpm servidor`) acepta estas variables de entorno (en PowerShell:
`$env:PUERTO=4000; pnpm servidor`):

| Variable                | Por defecto     | Qué hace                                                         |
| ----------------------- | --------------- | ---------------------------------------------------------------- |
| `PUERTO`                | `3000`          | Puerto del servidor (si no está, se lee `PORT`)                  |
| `CLAVE_ACCESO`          | sin definir     | Contraseña de acceso (para el despliegue en la nube)             |
| `CLOUDFLARED`           | se busca solo   | Ruta del ejecutable de `cloudflared` si no lo encuentra          |
| `DIR_WEB`               | `apps/web/dist` | Carpeta de la web compilada que se sirve                         |
| `RETARDO_BOT_MS`        | `700`           | Pausa antes de que actúe un bot (las pruebas e2e la acortan)     |
| `CELEBRACION_MS`        | `4000`          | Duración de la celebración de un Monstruo matado (`0`: sin ella) |
| `PAUSA_RESULTADO_MS`    | `3000`          | Pausa tras cada resultado (`0`: sin ella)                        |
| `PRESENTACION_LIDER_MS` | `4000`          | Presentación de la habilidad de un Líder (`0`: sin ella)         |

`HTS_TRAZA=1` muestra en `pnpm e2e` cada paso del piloto (para depurar pruebas) y
`HTS_RECURSOS_REPO` cambia el repositorio de `pnpm recursos` (y `HTS_RECURSOS_TOKEN` aporta un
token de solo lectura, como en el despliegue en la nube). El ejecutable de escritorio solo lee
`CLOUDFLARED`. Más en [docs/SERVIDOR_Y_PROTOCOLO.md](docs/SERVIDOR_Y_PROTOCOLO.md).

## Arquitectura

Monorepo pnpm en TypeScript estricto: cuatro paquetes de lógica y tres aplicaciones.

```
packages/
  cards/      Esquema Zod de las cartas, DSL de efectos (efectos.json) y validador
  engine/     Motor de reglas puro y determinista (reducer, vistas filtradas, efectos)
  bots/       Bots fácil y normal, director de partidas y simulador
  anfitrion/  Host de partida (temporizadores, bots, conexiones) y protocolo de red
apps/
  web/        Aplicación React + Vite + Zustand + Tailwind + Framer Motion
  server/     Servidor autoritativo Fastify + Socket.IO, túnel de Cloudflare y ejecutable
  e2e/        Pruebas e2e con Playwright
docs/         Documentación completa (ver más abajo)
```

En pocas palabras: el **motor** valida cada acción y devuelve el estado nuevo y los eventos, sin
saber nada de pantallas ni de red (el azar sale de una semilla guardada en el estado); el
**anfitrión** lo envuelve y añade cuentas atrás, bots y pausas; la **web** usa ese anfitrión en
partidas locales, y en línea el **servidor** es la única fuente de verdad y cada jugador recibe solo
lo que puede ver. El detalle, con diagramas, está en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Documentación

Todo está en [docs/](docs/README.md), con un índice y un mapa de lectura según lo que quieras hacer:
las reglas ([REGLAS.md](docs/REGLAS.md), [DUDAS_REGLAS.md](docs/DUDAS_REGLAS.md)), cada pieza del
sistema (motor, cartas y efectos, bots, anfitrión, servidor y protocolo, web), el
[modo en línea](docs/EN_LINEA.md), el [despliegue en la nube](docs/DESPLIEGUE.md), el [ejecutable de escritorio](docs/ESCRITORIO.md), la
[estrategia de pruebas](docs/PRUEBAS.md) y un [glosario](docs/GLOSARIO.md).

## Desarrollo

| Comando                  | Qué hace                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| `pnpm dev`               | Aplicación en http://localhost:5173 (en línea: con el servidor arrancado) |
| `pnpm build`             | Compila la aplicación web (`apps/web/dist`)                               |
| `pnpm servidor`          | Compila la web y arranca el servidor en línea en el puerto 3000           |
| `pnpm empaquetar`        | Genera el ejecutable de escritorio `dist-app/HereToSlay/HereToSlay.exe`   |
| `pnpm lint`              | ESLint con TypeScript estricto                                            |
| `pnpm format`            | Formatea con Prettier                                                     |
| `pnpm typecheck`         | Comprobación de tipos en todos los paquetes                               |
| `pnpm test`              | Tests (Vitest) de todos los paquetes                                      |
| `pnpm e2e`               | Tests e2e (Playwright): partidas completas, accesibilidad y rendimiento   |
| `pnpm recursos`          | Instala los recursos de las cartas (`--desde <carpeta>`, `--forzar`)      |
| `pnpm validate:cards`    | Valida `cartas.es.json` y que cada carta tenga su efecto definido         |
| `pnpm copy:images`       | Copia las imágenes de `Referencias/` a `assets/cartas/<id>.png`           |
| `pnpm sim [n] [semilla]` | Simula `n` partidas entre bots y muestra estadísticas                     |

Para desarrollar el modo en línea, arranca el servidor sin compilar
(`pnpm --filter @hts/server start`) y la web con `pnpm dev`: Vite redirige `/socket.io` al servidor.

## Tests y CI

- **`pnpm test`** (Vitest): reglas del motor (cada test cita su regla `R-xxx`), el efecto de cada
  carta, 1.000 partidas simuladas entre bots, el anfitrión, el servidor con clientes reales de
  Socket.IO y la interfaz con Testing Library.
- **`pnpm e2e`** (Playwright, solo en local, unos 5 minutos): partidas completas pulsando la interfaz
  en los tres modos, rendirse, enlaces de invitación, accesibilidad con axe-core en tema claro y
  oscuro, y una medida de tirones en una mesa de 6 jugadores. La primera vez, instala el navegador:
  `pnpm --filter @hts/e2e exec playwright install chromium`. El informe queda en
  `apps/e2e/informe/`.
- **CI** (GitHub Actions, `.github/workflows/ci.yml`): en cada push y pull request a `main` ejecuta
  `pnpm lint`, `pnpm typecheck` y `pnpm test`. Como el CI no tiene los recursos de las cartas, los
  tests con el catálogo real se saltan allí; los demás usan un catálogo de prueba propio.

## Contribuir

1. Crea una rama desde `main` (`git switch -c mi-cambio`).
2. Sigue las convenciones de [CLAUDE.md](CLAUDE.md): TypeScript estricto sin `any` ni `!`, dominio y
   textos en español, todos los textos de la interfaz en `apps/web/src/i18n/es.json`.
3. **Reglas**: no inventes reglas. Si algo del reglamento no está claro, añade una duda `D-xx` en
   [docs/DUDAS_REGLAS.md](docs/DUDAS_REGLAS.md) y marca el código con `// TODO(regla) D-xx`.
4. **Cartas nuevas**: su definición en `efectos.json` (`pnpm validate:cards` lo exige) y su test en
   `packages/engine/test/cartas/`.
5. Antes de hacer commit: `pnpm format`, `pnpm lint`, `pnpm typecheck` y `pnpm test`; si tocas la
   interfaz, también `pnpm e2e`.
6. Si cambias la arquitectura, un contrato (API del motor, protocolo, opciones del anfitrión,
   variables de entorno, comandos) o lo que ve el jugador, actualiza la documentación de `docs/`.
7. Mensajes de commit en español, descriptivos (qué cambia y por qué), y un pull request a `main`.

El trabajo con Claude Code se reparte entre agentes (`.claude/agents/`: `motor-reglas`,
`frontend-ux`, `qa`, `revisor` y `documentador`) y comandos como `/verificar`, `/nueva-carta`,
`/fase` y `/documentar` (revisa toda la documentación). El flujo está en [CLAUDE.md](CLAUDE.md).

## Seguridad

- En línea, el servidor valida con Zod todo lo que llega de los clientes, limita los mensajes por
  segundo y nunca envía la mano de un jugador a otro ni la semilla de la partida.
- El túnel de Cloudflare solo se puede abrir o cerrar desde el equipo donde corre el servidor; los
  invitados ven el enlace pero no los controles. Comparte el enlace solo con quien vaya a jugar y
  cierra el servidor (Ctrl+C) al terminar.
- No guardes secretos en el repositorio: `.env` y `.env.*` están en `.gitignore`.
- No añadas al repositorio ilustraciones, el reglamento ni textos oficiales de las cartas:
  `Referencias/` y `assets/cartas/` están en `.gitignore` a propósito.

## Solución de problemas

- **"Faltan las cartas"** al abrir la aplicación: faltan los recursos; ejecuta `pnpm recursos`
  (ver [Recursos de las cartas](#recursos-de-las-cartas)) y vuelve a arrancar.
- **`pnpm recursos` no puede descargar**: necesitas acceso al repositorio privado de recursos y la
  sesión de Git iniciada (`gh auth login`); si tienes los archivos, usa `--desde <carpeta>`.
- **`EPERM, Permission denied … dist\cartas` al compilar**: pasa dentro de OneDrive. La compilación
  ya borra `dist` antes de empezar; si aun así ocurre, borra a mano `apps/web/dist` o mueve el
  proyecto fuera de OneDrive.
- **"No se encuentra cloudflared"**: instálalo (ver [Instalación](#instalación)) y vuelve a arrancar
  el servidor. Si está en una carpeta poco habitual, indícala con la variable `CLOUDFLARED`.
- **Los demás no pueden entrar a la sala**: comprueba que están en la misma Wi-Fi, que usan el enlace
  "En tu red" (no `localhost`) y que el Firewall de Windows permite Node.js en redes privadas. Más en
  [docs/EN_LINEA.md](docs/EN_LINEA.md).
- **El puerto 3000 está ocupado**: `PUERTO=4000 pnpm servidor`.
- **Las imágenes no se ven**: ejecuta `pnpm copy:images` y vuelve a compilar.

## Licencia y aviso legal

_Here to Slay_ es una marca y obra de **Unstable Games**. Este es un proyecto de aficionado, sin
afiliación ni aval de Unstable Games, para uso personal con una copia física del juego. Este
repositorio **no incluye ni distribuye** ilustraciones, el reglamento ni los textos de las cartas:
cada jugador usa sus propios recursos.

El código fuente no tiene licencia de uso abierta: todos los derechos reservados.
