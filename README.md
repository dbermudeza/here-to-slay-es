# Here to Slay — versión digital en español

Adaptación digital **no oficial**, para uso **personal y no comercial**, del juego de cartas
_Here to Slay_ (Unstable Games), en español y fiel a las reglas del juego base.

> ⚠️ Este repositorio es **privado**. No incluye ilustraciones, logos ni textos oficiales: las cartas
> e imágenes se cargan desde carpetas locales que no se versionan (ver
> [Recursos personales](#recursos-personales)).

## Estado

| Fase | Contenido                                                                  | Estado |
| ---- | -------------------------------------------------------------------------- | ------ |
| 0    | Análisis de reglas, esquema de cartas, transcripción y validador           | ✅     |
| 1    | Motor de reglas: turnos, PA, ventanas de desafío y Modificadores, victoria | ✅     |
| 2    | Efectos de las 95 cartas (DSL en JSON), cada una con su test               | ✅     |
| 3    | Bots (fácil y normal) y simulación de 1.000 partidas                       | ✅     |
| 4    | Interfaz local: partidas en el mismo dispositivo y contra bots             | ✅     |
| 5    | Multijugador en línea (servidor autoritativo)                              | ✅     |
| 6    | Pulido, tests e2e y documentación de uso                                   | ⏳     |

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior (desarrollado con la versión de `.nvmrc`).
- [pnpm](https://pnpm.io/) 9: `npm install -g pnpm@9` (o `corepack enable`).

## Instalación

```sh
git clone https://github.com/dbermudeza/here-to-slay-es.git
cd here-to-slay-es
pnpm install
```

### Recursos personales

El juego necesita los datos de las cartas, que no forman parte del repositorio:

```
Referencias/
  Reglas.pdf                  # reglamento
  cartas.es.json              # cartas transcritas y traducidas (ver packages/cards/src/schema.ts)
  Imagenes/Cartas/<tipo>/*.png
assets/cartas/                # se genera con `pnpm copy:images`
```

Sin `Referencias/cartas.es.json`, los tests que usan el catálogo real se saltan automáticamente.

## Comandos

| Comando                  | Qué hace                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm dev`               | Arranca la aplicación en http://localhost:5173                    |
| `pnpm build`             | Compila la aplicación web para producción (`apps/web/dist`)       |
| `pnpm servidor`          | Compila la web y arranca el servidor en línea en el puerto 3000   |
| `pnpm lint`              | ESLint con TypeScript estricto                                    |
| `pnpm typecheck`         | Comprobación de tipos en todos los paquetes                       |
| `pnpm test`              | Tests (Vitest) de todos los paquetes                              |
| `pnpm validate:cards`    | Valida `cartas.es.json` y que cada carta tenga su efecto definido |
| `pnpm copy:images`       | Copia las imágenes de `Referencias/` a `assets/cartas/<id>.png`   |
| `pnpm sim [n] [semilla]` | Simula `n` partidas entre bots y muestra estadísticas             |

## Estructura

```
packages/
  cards/    Esquema Zod de las cartas, DSL de efectos (efectos.json) y validador
  engine/   Motor de reglas puro y determinista (reducer, vistas filtradas, efectos)
  bots/       Bots fácil y normal, director de partidas y simulador
  anfitrion/  Host de partida (temporizadores, bots, conexiones) y protocolo de red
apps/
  server/   Servidor autoritativo Fastify + Socket.IO
  web/      Aplicación React + Vite: en este dispositivo, contra bots y en línea
docs/
  REGLAS.md         Reglas como especificación (R-xxx)
  DUDAS_REGLAS.md   Ambigüedades del reglamento y decisiones tomadas (D-xx)
  EN_LINEA.md       Cómo jugar en línea (red local o por internet)
```

Para jugar en línea con amigos, consulta [docs/EN_LINEA.md](docs/EN_LINEA.md).

Las convenciones de código y del proyecto están en [CLAUDE.md](CLAUDE.md).

## Licencia y aviso legal

_Here to Slay_ es una marca y obra de **Unstable Games**. Este es un proyecto de aficionado, sin
afiliación ni aval de Unstable Games, para uso personal con una copia física del juego. No se
distribuyen ilustraciones ni textos oficiales.

El código fuente no tiene licencia de uso abierta: todos los derechos reservados.
