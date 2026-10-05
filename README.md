# Here to Slay — versión digital en español

Adaptación digital **no oficial**, para uso **personal y no comercial**, del juego de cartas
_Here to Slay_ (Unstable Games), en español y fiel a las reglas del juego base. Se juega en el
navegador: en un mismo dispositivo, contra bots o en línea con amigos.

> ⚠️ Este repositorio es **privado**. No incluye ilustraciones, logos ni textos oficiales: las cartas
> e imágenes se cargan desde carpetas locales que no se versionan (ver
> [Recursos personales](#2-recursos-personales)).

## Índice

1. [Instalación](#1-instalación)
2. [Recursos personales](#2-recursos-personales)
3. [Jugar](#3-jugar)
4. [Cómo se juega en la pantalla](#4-cómo-se-juega-en-la-pantalla)
5. [Ajustes y accesibilidad](#5-ajustes-y-accesibilidad)
6. [Solución de problemas](#6-solución-de-problemas)
7. [Desarrollo](#7-desarrollo)

## 1. Instalación

Pasos para Windows desde cero; en macOS y Linux son los mismos con su terminal.

1. **Node.js 24** (la versión de `.nvmrc`): descárgalo de [nodejs.org](https://nodejs.org/) e
   instálalo con las opciones por defecto. Comprueba en una terminal nueva: `node --version`.
2. **pnpm 9**: en la terminal, `npm install -g pnpm@9` (o `corepack enable`). Comprueba:
   `pnpm --version`.
3. **Git**: desde [git-scm.com](https://git-scm.com/) (en Windows, "Git for Windows").
4. **El proyecto**:

   ```sh
   git clone https://github.com/dbermudeza/here-to-slay-es.git
   cd here-to-slay-es
   pnpm install
   ```

> 💡 Mejor fuera de OneDrive (por ejemplo en `C:\proyectos\`): OneDrive sincroniza miles de
> archivos de `node_modules` sin necesidad, y además subiría tus imágenes de cartas a la nube.

## 2. Recursos personales

El juego necesita los datos de las cartas, que no forman parte del repositorio:

```
Referencias/
  Reglas.pdf                  # reglamento
  cartas.es.json              # cartas transcritas y traducidas (ver packages/cards/src/schema.ts)
  Imagenes/Cartas/<tipo>/*.png
assets/cartas/                # se genera con `pnpm copy:images`
```

1. Copia tu carpeta `Referencias/` en la raíz del proyecto.
2. Comprueba las cartas: `pnpm validate:cards` (debe terminar "sin errores").
3. Copia las imágenes: `pnpm copy:images`. Las imágenes son opcionales: sin ellas cada carta se
   dibuja con su nombre, tipo y texto, y el juego es igual de jugable.

## 3. Jugar

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
  retómala desde aquí. También puedes **guardarla en un archivo** (Menú → Guardar partida en un archivo) y
  **cargarla** después desde la portada.

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
router). Los detalles (instalar `cloudflared`, otras opciones) están en
**[docs/EN_LINEA.md](docs/EN_LINEA.md)**.

En línea, el creador puede añadir bots; si alguien se desconecta se le esperan 60 s y después un
bot juega por él hasta que vuelve; y se puede poner un tiempo máximo por decisión.

## 4. Cómo se juega en la pantalla

| Quiero…                          | Cómo                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Robar, renovar la mano, terminar | **Robar**, **Descartar mano y robar 5** y **Terminar turno** (indican su coste en PA)                                                           |
| Jugar una carta de la mano       | Pulsa la carta y después **Jugar** (Héroes y Magias) o **Equipar a un Héroe** (Objetos)                                                         |
| Equipar un Objeto                | **Equipar a un Héroe** y pulsa el Héroe que lo llevará (se resaltan los posibles, también rivales)                                              |
| Usar el efecto de un Héroe       | **Usar efecto** bajo el Héroe de tu Grupo                                                                                                       |
| Atacar a un Monstruo             | **Atacar** bajo el Monstruo del centro                                                                                                          |
| Desafiar o jugar un Modificador  | En el panel de la ventana (con cuenta atrás) que aparece cuando es posible                                                                      |
| Ver una carta en grande          | Clic en cualquier carta de la mesa; **doble clic** en las de tu mano (o **Ver carta**)                                                          |
| Ver el historial                 | Panel derecho (en pantallas pequeñas, **Ver historial**)                                                                                        |
| Responder en "este dispositivo"  | En las ventanas, **Responde X** pasa el dispositivo a X; al acabar, **He terminado**                                                            |
| Rendirse                         | **Menú → Rendirse**: tus cartas van al descarte y puedes ver la partida o salir; si todos los demás humanos se rinden, gana el que queda (D-43) |

Un botón gris no está disponible: pasa el ratón por encima para ver por qué (por ejemplo, "No
te quedan suficientes puntos de acción").

Las reglas completas están en la portada (**Reglas**) y en el menú de la partida; el **Tutorial**
resume un turno paso a paso.

## 5. Ajustes y accesibilidad

En la portada y en el menú de la partida:

- **Tema**: automático (el del sistema), claro u oscuro.
- **Reducir animaciones**: sin vuelos de cartas ni giros de dados (las jugadas se muestran igual,
  sin movimiento). Por defecto sigue la preferencia del sistema.

Toda la aplicación se puede usar con el **teclado**: `Tab`/`Mayús+Tab` para moverse, `Enter` o
`Espacio` para pulsar o elegir cartas, y `Escape` para cerrar ventanas (las decisiones obligatorias
no se cierran). Las ventanas mantienen el foco dentro mientras están abiertas y lo devuelven al
cerrarse. Los lectores de pantalla anuncian cada línea nueva del historial.

## 6. Solución de problemas

- **"Faltan las cartas"** al abrir la aplicación: falta `Referencias/cartas.es.json` (sección 2).
- **`EPERM, Permission denied … dist\cartas` al compilar**: pasa dentro de OneDrive. La compilación
  ya borra `dist` antes de empezar; si aun así ocurre, borra a mano `apps/web/dist` o mueve el
  proyecto fuera de OneDrive.
- **Los demás no pueden entrar a la sala**: comprueba que están en la misma Wi-Fi, que usan la
  dirección "En la red local" (no `localhost`) y que el Firewall de Windows permite Node.js en
  redes privadas. Más en [docs/EN_LINEA.md](docs/EN_LINEA.md).
- **El puerto 3000 está ocupado**: `PUERTO=4000 pnpm servidor` (en PowerShell:
  `$env:PUERTO=4000; pnpm servidor`).
- **Las imágenes no se ven**: ejecuta `pnpm copy:images` y vuelve a compilar.

## 7. Desarrollo

| Comando                  | Qué hace                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| `pnpm dev`               | Aplicación en http://localhost:5173 (en línea: con el servidor arrancado) |
| `pnpm build`             | Compila la aplicación web (`apps/web/dist`)                               |
| `pnpm servidor`          | Compila la web y arranca el servidor en línea en el puerto 3000           |
| `pnpm lint`              | ESLint con TypeScript estricto                                            |
| `pnpm typecheck`         | Comprobación de tipos en todos los paquetes                               |
| `pnpm test`              | Tests (Vitest) de todos los paquetes                                      |
| `pnpm e2e`               | Tests e2e (Playwright): partidas completas, accesibilidad y rendimiento   |
| `pnpm validate:cards`    | Valida `cartas.es.json` y que cada carta tenga su efecto definido         |
| `pnpm copy:images`       | Copia las imágenes de `Referencias/` a `assets/cartas/<id>.png`           |
| `pnpm sim [n] [semilla]` | Simula `n` partidas entre bots y muestra estadísticas                     |

`pnpm e2e` necesita `Referencias/cartas.es.json` y el navegador de Playwright
(`pnpm --filter @hts/e2e exec playwright install chromium` la primera vez). Juega partidas
completas pulsando la interfaz en los tres modos, revisa la accesibilidad de cada pantalla con
axe-core (tema claro y oscuro) y mide los tirones de una mesa de 6 jugadores. Tarda unos 5 minutos;
el informe queda en `apps/e2e/informe/`.

```
packages/
  cards/      Esquema Zod de las cartas, DSL de efectos (efectos.json) y validador
  engine/     Motor de reglas puro y determinista (reducer, vistas filtradas, efectos)
  bots/       Bots fácil y normal, director de partidas y simulador
  anfitrion/  Host de partida (temporizadores, bots, conexiones) y protocolo de red
apps/
  server/     Servidor autoritativo Fastify + Socket.IO
  web/        Aplicación React + Vite: en este dispositivo, contra bots y en línea
  e2e/        Pruebas e2e con Playwright
docs/
  REGLAS.md         Reglas como especificación (R-xxx)
  DUDAS_REGLAS.md   Ambigüedades del reglamento y decisiones tomadas (D-xx)
  EN_LINEA.md       Cómo jugar en línea (red local o por internet)
```

Las convenciones de código y del proyecto están en [CLAUDE.md](CLAUDE.md).

## Licencia y aviso legal

_Here to Slay_ es una marca y obra de **Unstable Games**. Este es un proyecto de aficionado, sin
afiliación ni aval de Unstable Games, para uso personal con una copia física del juego. No se
distribuyen ilustraciones ni textos oficiales.

El código fuente no tiene licencia de uso abierta: todos los derechos reservados.
