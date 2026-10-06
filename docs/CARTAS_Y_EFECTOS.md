# Cartas y efectos

Las cartas son **datos**: `Referencias/cartas.es.json` (personal, fuera del repositorio) describe
cada carta y se valida con el esquema Zod de `packages/cards/src/schema.ts`. Lo que **hace** cada
carta también son datos: una definición en el DSL de `packages/cards/src/efectos/efectos.json`,
validada con `efectos/esquema.ts`, que el intérprete del motor (`packages/engine/src/interprete.ts`)
ejecuta paso a paso. Lo que no cabe en el DSL es un paso `custom` escrito en TypeScript
(`packages/engine/src/customs.ts`).

Ver también [MOTOR.md](MOTOR.md) (pila, eventos, tiradas) y [ARQUITECTURA.md](ARQUITECTURA.md).

## Mapa de archivos

| Archivo (`packages/…`)           | Contenido                                          |
| -------------------------------- | -------------------------------------------------- |
| `cards/src/schema.ts`            | Esquema de las cartas, clases, tipos               |
| `cards/src/validacion.ts`        | `validarCartas`, `problemaDeDefinicion`            |
| `cards/src/efectos/esquema.ts`   | Esquema del DSL: pasos, pasivas, definiciones      |
| `cards/src/efectos/efectos.json` | Definición de efecto de cada carta                 |
| `cards/src/efectos/index.ts`     | `DEFINICIONES_EFECTOS` (validadas al importar)     |
| `cards/src/rutas.ts`             | Rutas de `Referencias/` y `assets/cartas/`         |
| `cards/src/imagenes.ts`          | `copiarImagenes`                                   |
| `cards/src/scripts/`             | Validar cartas, instalar recursos, copiar imágenes |
| `engine/src/interprete.ts`       | Intérprete del DSL                                 |
| `engine/src/pasivas.ts`          | Pasivas, bonos, disparadores                       |
| `engine/src/grupo.ts`            | ROBAR, SACRIFICAR, DESTRUIR, ARREBATAR, mover      |
| `engine/src/customs.ts`          | Pasos `custom`                                     |

## Esquema de las cartas (`schema.ts`)

El archivo es `{ "version": 1, "cartas": [...] }` (`ArchivoCartasSchema`). Cada carta es una unión
discriminada por `tipo` (`CartaSchema`).

### Campos comunes

| Campo            | Valor                      | Notas                                       |
| ---------------- | -------------------------- | ------------------------------------------- |
| `id`             | snake_case ASCII           | Estable; ver convenciones abajo             |
| `nombre`         | texto                      | El que muestra la interfaz                  |
| `nombreOriginal` | texto                      | Nombre en inglés                            |
| `copias`         | entero ≥ 1                 | Copias en su mazo                           |
| `imagen`         | `<archivo>.png/jpg/webp`   | Opcional, en `assets/cartas/`               |
| `origenImagen`   | ruta                       | Opcional, en `Referencias/Imagenes/Cartas/` |
| `expansion`      | `base`                     | Por defecto `base`                          |
| `revisar`        | booleano                   | `true` si los datos necesitan revisión      |
| `nota`           | texto                      | Opcional: por qué se marcó `revisar`        |
| `efecto`         | `{ tipo, clave }` o `null` | `dsl`, `custom` o `ninguno`                 |
| `texto`          | texto                      | Traducido (opcional en Modificadores)       |
| `textoOriginal`  | texto                      | En inglés, como en la carta                 |

Una carta sin `imagen` (o cuyo archivo falta) se dibuja como carta genérica con su texto.

### Campos por tipo

| `tipo`                     | Campos propios                                  | Mazo            |
| -------------------------- | ----------------------------------------------- | --------------- |
| `heroe`                    | `clase`, `tirada` (2–13: mínimo para el efecto) | principal       |
| `objeto`, `objeto_maldito` | `otorgaClase?` (máscaras)                       | principal       |
| `magia`                    | —                                               | principal       |
| `modificador`              | `opciones`: 1 o 2 enteros ≠ 0, de −10 a 10      | principal       |
| `desafio`                  | —                                               | principal       |
| `monstruo`                 | `requisitos`, `exito`, `fracaso`                | de Monstruos    |
| `lider`                    | `clase`                                         | uno por jugador |

- **Clases** (`CLASES`): `bardo`, `luchador`, `guardian`, `cazador`, `ladron`, `mago`.
- **Monstruos**: `requisitos` es una lista de clases o `heroe` (cualquier Héroe). `exito` y
  `fracaso` llevan un `rango` (`{ tipo: 'min' | 'max', valor }`, "N+" o "N−"), una `accion`
  estructurada que aplica el motor (`matar` con `robar`, `sacrificar` o `descartar` con
  `cantidad`) y sus textos. El esquema exige que `exito` MATE y que `fracaso` no lo haga.
- `TIPOS_MAZO_PRINCIPAL`: `heroe`, `objeto`, `objeto_maldito`, `magia`, `modificador`, `desafio`.

### Convenciones de ids

- Héroes: `heroe_<nombre_original>` (el nombre original no se traduce), p. ej. `heroe_bad_axe`.
- Resto: `<tipo>_<nombre_traducido>` en snake_case ASCII sin tildes ni ñ, p. ej.
  `monstruo_rex_mayor`, `modificador_mas1_menos3`. La única carta de Desafío es `desafio`.
- El id de la carta es también la clave de su definición en `efectos.json` (el motor busca
  `definiciones[idCarta]`), y `efecto.clave` en `cartas.es.json` debe coincidir con ella. La
  validación lo exige (ver abajo): con otra clave el resto de comprobaciones pasaría, pero el
  motor no encontraría la definición y la carta quedaría sin efecto.

### Validación (`validacion.ts`, `pnpm validate:cards`)

`validarCartas(crudo, opciones)` devuelve `{ datos, problemas }`; cada problema es un `error` o un
`aviso` con `donde` (id de carta o ruta) y `mensaje`.

| Comprobación                                                  | Severidad  |
| ------------------------------------------------------------- | ---------- |
| No cumple el esquema Zod                                      | error      |
| Id duplicado                                                  | error      |
| `imagen` reservada (`reverso.png`, `logo.png`)                | error      |
| Definición de efecto con forma incorrecta para su tipo        | error      |
| `efecto.clave` distinta del id de la carta (`dsl` y `custom`) | error      |
| Efecto sin mapear o no registrado                             | error (\*) |
| Carta con `revisar: true`                                     | aviso      |
| Sin `imagen`, o el archivo no existe en `assets/cartas/`      | aviso      |
| Definición en `efectos.json` que ninguna carta usa            | aviso      |
| Totales ≠ 115 (mazo principal), 6 (Líderes), 15 (Monstruos)   | aviso      |

(\*) Con la opción `efectosObligatorios`; sin ella, aviso.

`problemaDeDefinicion(carta, def)` comprueba la forma: Héroe y Magia necesitan `programa`; Líder y
Monstruo, `pasivas`; un Objeto, `pasivas` o `{ "nucleo": "mascara" }` (que exige `otorgaClase`);
Modificador y Desafío, `{ "nucleo": "modificador" }` y `{ "nucleo": "desafio" }`.

`pnpm validate:cards` ejecuta `src/scripts/validar-cartas.ts` con `efectosObligatorios: true`,
comprueba las imágenes en `assets/cartas/` e imprime errores y avisos agrupados; termina con código
1 si hay algún error. El test `packages/cards/test/efectos.test.ts` hace la misma validación (se
salta si no existe `Referencias/cartas.es.json`).

## Recursos

`Referencias/` (cartas, reglamento, imágenes originales) y `assets/cartas/` no se versionan: son
material de Unstable Games y el repositorio es público.

- **`pnpm recursos`** (`src/scripts/recursos.ts`) instala los recursos:
  - por defecto clona el repositorio privado de recursos (hace falta acceso y sesión de Git);
  - `--repo <url>` o la variable `HTS_RECURSOS_REPO` usan otro repositorio;
  - `--desde <carpeta>` copia desde una carpeta que contenga `Referencias/` (y quizá
    `assets/cartas/`), o desde la propia `Referencias`;
  - si `Referencias/cartas.es.json` ya existe, no hace nada salvo con `--forzar`;
  - después valida el esquema y prepara las imágenes con `copiarImagenes` si faltan (o con
    `--forzar`).
- **`pnpm copy:images`** (`copiar-imagenes.ts` → `copiarImagenes` en `imagenes.ts`) copia cada
  `Referencias/Imagenes/Cartas/<origenImagen>` a `assets/cartas/<imagen>`, y además dos imágenes
  **reservadas** que no son de ninguna carta: el reverso (`IMAGEN_REVERSO = 'reverso.png'`) y el
  logo (`IMAGEN_LOGO = 'logo.png'`; su origen se llama `.jpg` pero es un PNG). Es idempotente y sale
  con código 1 si falta algún origen.
- `rutas.ts` encuentra la raíz del monorepo buscando `pnpm-workspace.yaml` desde el directorio
  actual (no usa `import.meta.url`, para funcionar también en jsdom).
- La web lee las cartas al compilar mediante el módulo virtual `virtual:cartas` y sirve las imágenes
  en `/cartas/<archivo>` ([WEB.md](WEB.md)).

## El DSL de efectos

`efectos.json` es un objeto `{ idCarta: DefinicionEfecto }` con una entrada por carta (95 en el
juego base). Se valida con `DefinicionesEfectosSchema` al importar `@hts/cards`: un JSON mal formado
rompe la carga del paquete, no la partida.

Una `DefinicionEfecto` (objeto estricto: no admite otros campos) tiene al menos uno de:

| Campo      | Para                             | Qué es                                      |
| ---------- | -------------------------------- | ------------------------------------------- |
| `programa` | Héroes y Magias                  | Pasos al superar la tirada o al resolverse  |
| `pasivas`  | Líderes, Monstruos, Objetos      | Habilidades mientras la carta está en juego |
| `nucleo`   | Modificadores, Desafío, máscaras | Comportamiento implementado en el motor     |

### Variables y condiciones

- Un efecto en curso guarda variables con nombre en `marco.vars` (nombres `^[a-z][a-zA-Z0-9]*$`):
  un jugador (`string`), una lista de uids (`string[]`), un booleano…
- Muchos pasos aceptan `var` (dónde guardar el resultado) o `deVar` (de dónde leer cartas).
- Cualquier paso puede llevar `si: { var, tipos? }`: con `tipos`, se cumple si la variable contiene
  alguna carta de esos tipos; sin `tipos`, si es `true`, una lista no vacía o un texto no vacío. Si
  no se cumple, el paso se salta.
- Los filtros de tipo (`TipoFiltro`) son `heroe`, `objeto` (incluye los Objetos Malditos), `magia`,
  `modificador` y `desafio`.
- "El jugador del efecto" es `marco.jugador` (el "tú" del texto de la carta). Los "otros jugadores"
  son los demás en sentido horario empezando por el siguiente, sin los rendidos (D-43, D-44).

### Pasos

Cartas y mano:

- `robar { cantidad, var? }`: ROBA cartas (con disparadores de robo); `var` guarda las robadas.
- `robarHasta { total }`: ROBA hasta tener `total` cartas en la mano.
- `descartar { min, max, deVar?, var? }`: el jugador DESCARTA entre `min` y `max` cartas (solo de
  `deVar`, si se indica).
- `tomarDeDescarte { deVar }`: recupera a la mano una de las cartas de `deVar` que sigan en el
  descarte.
- `buscarDescarte { tipos }`: recupera del descarte una carta de esos tipos.
- `revelar { deVar, tipos }`: enseña a todos una carta de `deVar` de esos tipos (`cartaRevelada`).
- `jugarInmediato { tipos, opcional, deVar?, var? }`: juega sin PA una carta de la mano de esos
  tipos (solo de `deVar`, si se indica). La carta se puede desafiar (D-39).

Otros jugadores:

- `elegirJugador { var, filtro }`: elige otro jugador; `filtro` es `otro`, `otroConMano`,
  `otroConHeroe` u `otroConHeroeArrebatable`.
- `sacar { de, var? }`: SACA a ciegas una carta de la mano del jugador `de` (R-097).
- `sacarDeCada { conClase }`: SACA una carta a cada otro jugador con esa clase en su Grupo.
- `mirarMano { de }`: enseña la mano de `de` al jugador del efecto.
- `tomarDeManoVista { de }`: enseña la mano de `de` y el jugador se queda una carta.
- `jugadorDebe { quien, accion, cantidad, conClase?, var? }`: `quien` (`cadaOtro` o una variable)
  DESCARTA, SACRIFICA o DA (`accion`: `descartar`, `sacrificar`, `dar`) cartas que elige él.
- `jugadorPuedeRobar { quien, cantidad }`: pregunta a `quien` si quiere ROBAR.
- `intercambiarManos { con }`: intercambia la mano con `con`.

Grupos:

- `destruir { cantidad, objetoAMano }`: DESTRUYE Héroes de otros jugadores. `cantidad` es un número
  o `{ contar: var }` (tantos como cartas haya en la variable). Con `objetoAMano`, el Objeto del
  Héroe va a tu mano.
- `arrebatar { de?, var? }`: ARREBATA un Héroe (de cualquier rival o solo de `de`).
- `moverFuente { a }`: mueve el Héroe que tiene el efecto al Grupo de `a`.
- `darHeroe { a }`: el jugador da un Héroe propio, elegido, al Grupo de `a`.
- `devolverObjeto { modo }`: devuelve Objetos equipados a la mano (`malditoPropio`, `cualquiera` o
  `todos`; a qué mano, D-34).
- `tirarPorHeroe { var }`: tira sin PA por el Héroe guardado en `var`; cuenta como su uso ese
  turno (D-31).

Temporales y otros:

- `confirmar { var, quien? }`: pregunta sí/no al jugador del efecto (o a `quien`) y guarda el
  booleano.
- `bonoTurno { valor }`: temporal `bonoTirada`, +`valor` a tus tiradas mientras dure tu turno.
- `proteccion { tipo, hasta }`: temporal `noDestruible`, `noArrebatable` o `noDesafiable` hasta
  `finTurno` o `inicioTurnoPropio`.
- `custom { nombre }`: paso escrito en TypeScript (ver más abajo).

Cuando un paso de elección no tiene objetivos (nadie a quien destruir, descarte sin cartas del
tipo…) emite `sinObjetivos` y sigue.

### Pasivas

| `tipo`                    | Campos                                    | Efecto                                |
| ------------------------- | ----------------------------------------- | ------------------------------------- |
| `bonoTirada`              | `contexto`, `valor`, `soloHeroeEquipado?` | +`valor` a tus tiradas del `contexto` |
| `bonoPorModificadorRival` | `valor`                                   | +`valor` por Modificador rival        |
| `disparador`              | `evento`, `tipos?`, `programa`            | `programa` cada vez que hay `evento`  |
| `restriccion`             | `regla`                                   | Prohíbe algo (ver abajo)              |
| `reemplazo`               | `regla`                                   | Cambia una operación por otra         |
| `paExtra`                 | `valor`                                   | PA adicionales en tus turnos (D-36)   |
| `habilidad`               | `costePa`, `unaVezPorTurno`, `programa`   | Acción `USAR_HABILIDAD` en tu turno   |

- `contexto` de `bonoTirada`: `heroe` (tirada para usar el efecto de un Héroe), `ataque`, `desafio`
  (cualquier tirada de un desafío, D-33) o `cualquiera`. `soloHeroeEquipado` (Objetos): solo para
  la tirada del Héroe que lo lleva.
- `bonoPorModificadorRival`: por cada Modificador que otro jugador juegue sobre tu tirada.
- `restriccion.regla`: `heroesNoDestruibles`, `objetosNoDesafiables` o `sinEfectoEquipado`.
- `reemplazo.regla`: `senuelo` (si el Héroe equipado fuera a ser sacrificado o destruido, el Objeto
  va al descarte en su lugar) o `destruirPorArrebatar` (puedes ARREBATAR en lugar de DESTRUIR).

Eventos de los disparadores (`EventoDisparadorSchema`) y variables con las que empieza su programa:

| `evento`                     | Cuándo                                          | Variable inicial  |
| ---------------------------- | ----------------------------------------------- | ----------------- |
| `robas`                      | Robas una carta (de los `tipos`, si se indican) | `carta` (`[uid]`) |
| `juegasMagia`                | Se resuelve una Magia tuya (D-35)               | —                 |
| `cualquieraJuegaModificador` | Cualquiera, tú incluido, juega un Modificador   | —                 |
| `juegasModificador`          | Juegas un Modificador                           | `tirada` (índice) |
| `teDesafian`                 | Otro jugador te DESAFÍA                         | `desafiante`      |
| `heroePropioDestruido`       | Se DESTRUYE un Héroe de tu Grupo                | —                 |
| `exitoTiradaHeroe`           | Superas una tirada de Héroe (Líder, Monstruo)   | —                 |
| `exitoTiradaEquipado`        | Supera su tirada el Héroe que lleva este Objeto | —                 |
| `falloTiradaEquipado`        | Falla su tirada el Héroe que lleva este Objeto  | —                 |

### Núcleo

`{ "nucleo": … }` marca cartas cuyo comportamiento está en el motor y no en el DSL:

- `modificador`: se juega con `JUGAR_MODIFICADOR` en una ventana de Modificadores
  ([MOTOR.md](MOTOR.md#tiradas-bonos-y-modificadores)).
- `desafio`: se juega con `DESAFIAR` en una ventana de desafío.
- `mascara`: Objeto con `otorgaClase`; el Héroe equipado cuenta solo como esa clase (R-046,
  `claseEfectiva` en `consultas.ts`).

### Pasos `custom`

Un `ManejadorCustom` es `(entorno: EntornoPaso) => 'siguiente' | 'esperar'`, con
`EntornoPaso = { ctx, d, f, emitir }` (contexto, borrador del estado, marco y emisor de eventos).
Puede usar `f.sub`, `f.i`, `f.cola` y `f.respuesta` para pausarse y continuar. Si devuelve
`'esperar'` debe haber apilado algo (una `decision` o una ventana).

`CUSTOM_POR_DEFECTO` (`customs.ts`) registra:

- `bullseye` (Héroe Bullseye): consulta las tres primeras cartas del mazo (pregunta `elegirDelMazo`),
  pasa una a la mano y pregunta el orden en que vuelven las demás (`ordenarMazo`, pregunta
  `cartas` con `ordenado: true`).
- `cuernoProtector` (Líder El Cuerno Protector, disparador `juegasModificador`): pregunta `valor`
  (+1 o −1) y lo añade como modificación sin carta (`uid: null`) a la tirada indicada por la
  variable `tirada`.

Se pueden añadir más con `crearMotor(cartas, { custom: { nombre: manejador } })` (se combinan con
los de por defecto). Un `custom` con nombre desconocido es un `ErrorInterno`.

### Ejemplos reales

Un Héroe que DESTRUYE un Héroe de otro jugador:

```json
"heroe_bad_axe": { "programa": [{ "paso": "destruir", "cantidad": 1 }] }
```

Elegir un rival con cartas, SACARLE una y, si era un Héroe, SACAR otra (condición con `tipos`):

```json
"heroe_bear_claw": {
  "programa": [
    { "paso": "elegirJugador", "var": "j", "filtro": "otroConMano" },
    { "paso": "sacar", "de": "j", "var": "s" },
    { "paso": "sacar", "de": "j", "si": { "var": "s", "tipos": ["heroe"] } }
  ]
}
```

DESCARTAR de 0 a 3 cartas y DESTRUIR tantos Héroes como cartas descartadas (`contar`):

```json
"heroe_qi_bear": {
  "programa": [
    { "paso": "descartar", "min": 0, "max": 3, "var": "d" },
    { "paso": "destruir", "cantidad": { "contar": "d" }, "si": { "var": "d" } }
  ]
}
```

Habilidad de Líder que cuesta 1 PA, una vez por turno:

```json
"lider_la_garra_sombria": {
  "pasivas": [
    {
      "tipo": "habilidad",
      "costePa": 1,
      "unaVezPorTurno": true,
      "programa": [
        { "paso": "elegirJugador", "var": "j", "filtro": "otroConMano" },
        { "paso": "sacar", "de": "j" }
      ]
    }
  ]
}
```

Disparador de Monstruo con una confirmación opcional (`confirmar` + `si`):

```json
"monstruo_rex_mayor": {
  "pasivas": [
    {
      "tipo": "disparador",
      "evento": "robas",
      "tipos": ["modificador"],
      "programa": [
        { "paso": "confirmar", "var": "ok" },
        { "paso": "revelar", "deVar": "carta", "tipos": ["modificador"], "si": { "var": "ok" } },
        { "paso": "robar", "cantidad": 1, "si": { "var": "ok" } }
      ]
    }
  ]
}
```

## El intérprete (`interprete.ts`)

`ejecutarEfectos(ctx, d, emitir)` se llama tras cada acción ([MOTOR.md](MOTOR.md#api)). Mientras la
cima de la pila sea un marco `efecto`:

1. Toma el programa del marco (`programaDe`: el `programa` de la carta, o el de la pasiva
   `f.pasiva` si es un disparador o una habilidad) y el paso `f.pc`.
2. Si no quedan pasos, saca el marco de la pila. Si debajo hay una ventana abierta, incrementa la
   `secuencia` y emite `ventanaReiniciada`: la cuenta vuelve a empezar (D-38).
3. Si el paso tiene `si` y no se cumple (solo se evalúa al empezar el paso, `f.sub === 0`), pasa al
   siguiente.
4. Ejecuta el paso. `'siguiente'` avanza `pc` y limpia `sub`, `i`, `cola` y `respuesta`.
   `'esperar'` deja el marco donde está: el paso ha apilado una `decision` (o una ventana, o una
   jugada) encima y el bucle termina porque la cima ya no es un `efecto`. Si un paso devuelve
   `'esperar'` sin apilar nada, es un `ErrorInterno`.
5. Hay un tope de 100.000 pasos seguidos y se detiene si hay ganador.

```mermaid
sequenceDiagram
  participant R as reducer
  participant I as ejecutarEfectos
  participant P as paso (p. ej. jugadorDebe)
  participant S as state.pila
  R->>I: tras aplicar la acción
  I->>P: ejecutarPaso(marco, paso) con sub = 0
  P->>S: push decision (pregunta a B)
  P-->>I: 'esperar' (sub = 2)
  I-->>R: la cima es una decision → fin
  Note over R: … B envía RESPONDER …
  R->>S: pop decision; entregarRespuesta → marco.respuesta
  R->>I: ejecutarEfectos
  I->>P: mismo paso, sub = 2: consume la respuesta
  P-->>I: 'siguiente' (o nueva pregunta al siguiente de la cola)
```

Los pasos que preguntan varias veces usan `f.sub` como fase, `f.cola` como lista de trabajo
(jugadores o cartas pendientes) y `f.i` como índice. Por ejemplo `jugadorDebe` con
`quien: "cadaOtro"` mete a los rivales en `cola` y pregunta a uno tras otro; `destruir` con
`cantidad > 1` repite el ciclo elegir objetivo → (quizá confirmar arrebatar) → destruir.

### Autorresolución de elecciones (D-40) y su excepción

Cuando la elección es **forzosa** (una sola opción, o hay que tomar todas, y no es opcional), el
motor la aplica sin preguntar:

- `elegirCartas` (patrón común de `descartar`, `arrebatar`, `buscarDescarte`, `tomarDeDescarte`,
  `darHeroe`, `devolverObjeto`): sin opciones aplica `[]`; si `min = max = número de opciones`, las
  toma todas.
- `elegirJugador`: con 0 o 1 jugador válido no pregunta (con 0 emite `sinObjetivos`).
- `jugadorDebe`: si el jugador tiene justo las cartas que debe entregar, se aplican.
- `sacar`: si la mano tiene una carta, se la lleva.
- `destruir`: con un único Héroe destruible, lo destruye.
- `jugarInmediato`: con una sola carta posible y `opcional: false`, la juega (y con un único Héroe
  sin Objeto, lo equipa ahí).

Si la elección es opcional ("puedes…": `confirmar`, `jugadorPuedeRobar`, `jugarInmediato` con
`opcional: true`, `descartar` con `min` menor que `max`…), siempre se pregunta.

**Excepción: mirar cartas ocultas.** Cuando el efecto consiste en **mirar** cartas ocultas, mirar
forma parte del efecto y se pregunta siempre, aunque solo haya una carta:

- `tomarDeManoVista` (Silent Shadow) llama a `elegirCartas` con `siempreMostrar = true`;
- `mirarMano` pregunta `ver` siempre que la mano no esté vacía;
- `bullseye` pregunta siempre qué carta tomar.

D-40 se mantiene para las elecciones sobre información pública (Grupo, descarte…). Lo comprueba
`packages/engine/test/auditoria.test.ts`.

## Pasivas y disparadores (`pasivas.ts`)

- **Qué pasivas están activas** (`pasivasDeJugador`): las del Líder, las de los Monstruos matados y
  las de los Objetos equipados en sus Héroes (con el Héroe que los lleva). `todasLasPasivas` las
  recorre empezando por el jugador del turno, en sentido horario, sin los rendidos.
- **Restricciones y reemplazos de Líder o Monstruo** (`tieneRegla`): `heroesNoDestruibles`
  (Terratuga), `objetosNoDesafiables` (Osolechuza Veterano), `destruirPorArrebatar` (Dientes de
  Sable Corrupto). Las de Objetos se consultan en la ranura (`objetoTiene`): `sinEfectoEquipado`
  (Llave Selladora → `heroeSellado`) y `senuelo` (Muñeco Señuelo → `tieneSenuelo`).
- **Consultas que usa el resto del motor**: `puedeSerDestruido` (restricción o temporal
  `noDestruible`), `puedeSerArrebatado` (temporal `noArrebatable`), `jugadaIndesafiable` (temporal
  `noDesafiable` u `objetosNoDesafiables` para Objetos), `puedeArrebatarEnLugarDeDestruir`,
  `paExtra`, `habilidadDe` y `bonosDeTirada`.
- **Disparadores** (`notificar(ctx, d, sucesos, emitir)`): el motor llama a `notificar` con
  `Suceso`s (`robo`, `magiaJugada`, `modificadorJugado`, `desafiado`, `heroeDestruido`,
  `tiradaHeroe`). Para cada suceso y cada pasiva activa, `marcoSiCoincide` decide si el disparador
  se activa y con qué variables iniciales. Se emite `disparadorActivado` (y `liderActivado` si la
  carta es el Líder del jugador) y los marcos se apilan **en orden inverso**, para que se ejecuten
  en el orden de los sucesos y, en cada suceso, empezando por el jugador del turno (R-082, R-083).
- **Orden respecto al efecto de la carta** (D-37): al resolverse una Magia o superarse la tirada de
  un Héroe, primero se apilan los disparadores y después el programa de la carta, que queda encima
  y se ejecuta antes.

## Operaciones sobre el Grupo (`grupo.ts`)

- `robarCartas`: ROBA con `robar` (`ops.ts`) y notifica un suceso `robo` por carta.
- `sacrificarHeroe`: SACRIFICA un Héroe propio; su Objeto va al descarte con él (D-07).
- `destruirHeroe`: DESTRUYE un Héroe ajeno (R-044); su Objeto va al descarte, o a la mano de quien
  destruye con `objetoAMano`. Notifica `heroeDestruido`.
- `arrebatarHeroe`: ARREBATA un Héroe ajeno, con su Objeto, al Grupo propio.
- `moverHeroe`: mueve un Héroe propio, con su Objeto, al Grupo de otro jugador.

Las **protecciones** se comprueban antes de ofrecer objetivos (el intérprete filtra con
`puedeSerDestruido` y `puedeSerArrebatado`). El **reemplazo** `destruirPorArrebatar` lo gestiona
el paso `destruir`: tras elegir objetivo, si el jugador lo tiene y el Héroe se puede arrebatar,
pregunta `confirmar` (`arrebatarEnLugarDeDestruir`). El **señuelo** actúa dentro de
`sacrificarHeroe` y `destruirHeroe`.

## Guía: añadir o completar una carta

El comando `/nueva-carta <id>` (`.claude/commands/nueva-carta.md`) automatiza este flujo con los
agentes `motor-reglas` y `qa`. A mano:

1. **Datos.** Comprueba que la carta está en `Referencias/cartas.es.json` con su id según las
   convenciones y `efecto: { "tipo": "dsl", "clave": "<id>" }` (o `"custom"`; la `clave` **debe
   ser igual al id** de la carta, si no `pnpm validate:cards` da error). Si los datos son dudosos, marca
   `"revisar": true` con una `nota`.
2. **Definición.** Añade la entrada `"<id>": { … }` en `packages/cards/src/efectos/efectos.json`
   con la forma que corresponde a su tipo (`programa`, `pasivas` o `nucleo`). Usa los pasos y
   pasivas existentes; si de verdad no basta, añade un paso `custom` en
   `packages/engine/src/customs.ts` y regístralo en `CUSTOM_POR_DEFECTO`.
3. **Si hace falta un paso o una pasiva nueva en el DSL**: añádelo en `efectos/esquema.ts` (con su
   comentario), impleméntalo en `ejecutarPaso` (`interprete.ts`) o en `pasivas.ts`, y añade su
   valor en `valorPrograma` de `packages/bots/src/analisis.ts` si conviene que los bots lo
   aprecien.
4. **Ambigüedades.** Si el texto admite varias lecturas, añade una `D-xx` en
   [DUDAS_REGLAS.md](DUDAS_REGLAS.md), aplica la más literal y marca el código con
   `// TODO(regla) D-xx`. No inventes reglas.
5. **Test.** Escribe al menos un test en `packages/engine/test/cartas/` que cite el id de la carta
   entre comillas simples (`'<id>…'`), usando las utilidades de `reales.ts` (`mesa`, `mano`,
   `heroe`, `monstruo`, `activar`, `jugarMagia`, `decision`, `responder`, `sinPendientes`…). Cubre
   el éxito, las opciones "puedes", la falta de objetivos y las protecciones que le afecten. El test
   de cobertura de `nucleo.test.ts` (`cada carta del catálogo tiene al menos un test propio`) falla
   si algún id del catálogo no aparece en ningún test de esa carpeta.
6. **Verifica.** `pnpm validate:cards` (exige una definición por carta con la forma correcta) y
   `pnpm test` (o `/verificar`). El test de `packages/cards/test/efectos.test.ts` comprueba también
   el número de definiciones: actualízalo si cambia.
