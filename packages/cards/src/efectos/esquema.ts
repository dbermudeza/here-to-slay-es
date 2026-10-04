import { z } from 'zod';
import { ClaseSchema } from '../schema';

/**
 * DSL de efectos de carta. Un efecto es una lista de pasos que el motor ejecuta en orden. Un paso
 * puede pausar la ejecución para pedir una decisión a un jugador y continuar después. Los
 * resultados intermedios (jugador elegido, cartas robadas…) se guardan en variables con nombre.
 *
 * Las habilidades permanentes de Líderes, Monstruos y Objetos se describen como `pasivas`.
 */

/** Nombre de variable del efecto. */
const Var = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'Nombre de variable inválido');

/** Tipos de carta para filtros. "objeto" incluye también los Objetos Malditos. */
export const TipoFiltroSchema = z.enum(['heroe', 'objeto', 'magia', 'modificador', 'desafio']);
export type TipoFiltro = z.infer<typeof TipoFiltroSchema>;

/**
 * Condición de un paso:
 * - con `tipos`: se cumple si la variable contiene alguna carta de esos tipos;
 * - sin `tipos`: se cumple si la variable es `true` o una lista no vacía.
 */
export const CondicionSchema = z.object({
  var: Var,
  tipos: z.array(TipoFiltroSchema).min(1).optional(),
});
export type Condicion = z.infer<typeof CondicionSchema>;

export const FiltroJugadorSchema = z.enum([
  /** Cualquier otro jugador. */
  'otro',
  /** Otro jugador con al menos una carta en la mano. */
  'otroConMano',
  /** Otro jugador con al menos un Héroe en su Grupo. */
  'otroConHeroe',
  /** Otro jugador con al menos un Héroe que se pueda ARREBATAR. */
  'otroConHeroeArrebatable',
]);

/** Jugador al que se refiere un paso: "cadaOtro" o el nombre de una variable con un jugador. */
const Quien = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);

const base = { si: CondicionSchema.optional() };

export const PasoSchema = z.discriminatedUnion('paso', [
  /** ROBAR n cartas. `var` guarda las cartas robadas. */
  z.object({
    ...base,
    paso: z.literal('robar'),
    cantidad: z.number().int().min(1),
    var: Var.optional(),
  }),
  /** ROBAR hasta tener `total` cartas en la mano. */
  z.object({ ...base, paso: z.literal('robarHasta'), total: z.number().int().min(1) }),
  /** El jugador del efecto DESCARTA entre `min` y `max` cartas (solo de `deVar`, si se indica). */
  z.object({
    ...base,
    paso: z.literal('descartar'),
    min: z.number().int().min(0),
    max: z.number().int().min(1),
    deVar: Var.optional(),
    var: Var.optional(),
  }),
  /** Elegir un jugador según el filtro. Si no hay ninguno válido, la variable queda vacía. */
  z.object({ ...base, paso: z.literal('elegirJugador'), var: Var, filtro: FiltroJugadorSchema }),
  /** SACAR una carta a ciegas de la mano del jugador `de` (R-097). */
  z.object({ ...base, paso: z.literal('sacar'), de: Var, var: Var.optional() }),
  /** SACAR una carta de la mano de cada otro jugador con esa clase en su Grupo. */
  z.object({ ...base, paso: z.literal('sacarDeCada'), conClase: ClaseSchema }),
  /** Mirar la mano del jugador `de`. */
  z.object({ ...base, paso: z.literal('mirarMano'), de: Var }),
  /** Mirar la mano del jugador `de` y quedarse con una carta elegida. */
  z.object({ ...base, paso: z.literal('tomarDeManoVista'), de: Var }),
  /** Otro jugador (o cada otro) debe DESCARTAR, SACRIFICAR o DAR cartas, eligiéndolas él. */
  z.object({
    ...base,
    paso: z.literal('jugadorDebe'),
    quien: Quien,
    accion: z.enum(['descartar', 'sacrificar', 'dar']),
    cantidad: z.number().int().min(1),
    conClase: ClaseSchema.optional(),
    var: Var.optional(),
  }),
  /** El jugador `quien` puede ROBAR (lo decide él). */
  z.object({
    ...base,
    paso: z.literal('jugadorPuedeRobar'),
    quien: Var,
    cantidad: z.number().int().min(1),
  }),
  /** Recuperar a la mano una de las cartas de `deVar` que estén en la pila de descarte. */
  z.object({ ...base, paso: z.literal('tomarDeDescarte'), deVar: Var }),
  /** Buscar en la pila de descarte una carta de esos tipos y añadirla a la mano. */
  z.object({ ...base, paso: z.literal('buscarDescarte'), tipos: z.array(TipoFiltroSchema).min(1) }),
  /** DESTRUIR Héroes. `objetoAMano`: el Objeto equipado va a tu mano (Shurikitty). */
  z.object({
    ...base,
    paso: z.literal('destruir'),
    cantidad: z.union([z.number().int().min(1), z.object({ contar: Var })]),
    objetoAMano: z.boolean().default(false),
  }),
  /** ARREBATAR un Héroe (de cualquier jugador, o solo de `de`). */
  z.object({ ...base, paso: z.literal('arrebatar'), de: Var.optional(), var: Var.optional() }),
  /** Mover esta carta (la que tiene el efecto) al Grupo del jugador `a`. */
  z.object({ ...base, paso: z.literal('moverFuente'), a: Var }),
  /** Mover un Héroe propio elegido al Grupo del jugador `a`. */
  z.object({ ...base, paso: z.literal('darHeroe'), a: Var }),
  /** Intercambiar la mano con el jugador `con`. */
  z.object({ ...base, paso: z.literal('intercambiarManos'), con: Var }),
  /** Jugar inmediatamente (sin PA) una carta de la mano de esos tipos (solo de `deVar`, si se indica). */
  z.object({
    ...base,
    paso: z.literal('jugarInmediato'),
    tipos: z.array(TipoFiltroSchema).min(1),
    deVar: Var.optional(),
    opcional: z.boolean(),
    var: Var.optional(),
  }),
  /** Preguntar sí/no al jugador del efecto (o a `quien`). */
  z.object({ ...base, paso: z.literal('confirmar'), var: Var, quien: Var.optional() }),
  /** Revelar a todos una carta de `deVar` de esos tipos. */
  z.object({
    ...base,
    paso: z.literal('revelar'),
    deVar: Var,
    tipos: z.array(TipoFiltroSchema).min(1),
  }),
  /** +N a todas tus tiradas hasta el final de tu turno. */
  z.object({ ...base, paso: z.literal('bonoTurno'), valor: z.number().int() }),
  /** Protección temporal de tu Grupo o de tus jugadas. */
  z.object({
    ...base,
    paso: z.literal('proteccion'),
    tipo: z.enum(['noDestruible', 'noArrebatable', 'noDesafiable']),
    hasta: z.enum(['finTurno', 'inicioTurnoPropio']),
  }),
  /** Devolver Objetos equipados a la mano. */
  z.object({
    ...base,
    paso: z.literal('devolverObjeto'),
    modo: z.enum(['malditoPropio', 'cualquiera', 'todos']),
  }),
  /** Tirar inmediatamente (sin PA) para usar el efecto del Héroe guardado en `var`. */
  z.object({ ...base, paso: z.literal('tirarPorHeroe'), var: Var }),
  /** Paso implementado en TypeScript (registro `customEffects`). */
  z.object({ ...base, paso: z.literal('custom'), nombre: z.string().min(1) }),
]);
export type Paso = z.infer<typeof PasoSchema>;

export const ProgramaSchema = z.array(PasoSchema);
export type Programa = z.infer<typeof ProgramaSchema>;

export const EventoDisparadorSchema = z.enum([
  /** Robas una carta (de los `tipos` indicados). Variable inicial: `carta`. */
  'robas',
  /** Juegas una carta de Magia. */
  'juegasMagia',
  /** Cualquier jugador, incluido tú, juega un Modificador. */
  'cualquieraJuegaModificador',
  /** Juegas un Modificador. Variable inicial: `tirada` (índice de la tirada modificada). */
  'juegasModificador',
  /** Otro jugador te DESAFÍA. Variable inicial: `desafiante`. */
  'teDesafian',
  /** Se destruye un Héroe de tu Grupo. */
  'heroePropioDestruido',
  /** Superas una tirada para usar el efecto de un Héroe. */
  'exitoTiradaHeroe',
  /** Superas la tirada del Héroe que lleva equipado este Objeto. */
  'exitoTiradaEquipado',
  /** Fallas la tirada del Héroe que lleva equipado este Objeto. */
  'falloTiradaEquipado',
]);
export type EventoDisparador = z.infer<typeof EventoDisparadorSchema>;

export const PasivaSchema = z.discriminatedUnion('tipo', [
  /**
   * Bono a tus tiradas. Contextos:
   * - heroe: tirada para usar el efecto de un Héroe;
   * - ataque: tirada para ATACAR;
   * - desafio: cualquier tirada de un desafío;
   * - cualquiera: todas tus tiradas.
   */
  z.object({
    tipo: z.literal('bonoTirada'),
    contexto: z.enum(['heroe', 'ataque', 'desafio', 'cualquiera']),
    valor: z.number().int(),
    /** Solo para Objetos: se aplica únicamente a la tirada del Héroe que lo lleva equipado. */
    soloHeroeEquipado: z.boolean().default(false),
  }),
  /** +valor a tu tirada por cada Modificador que otro jugador juegue sobre ella. */
  z.object({ tipo: z.literal('bonoPorModificadorRival'), valor: z.number().int() }),
  /** Ejecuta `programa` cada vez que ocurre el evento. */
  z.object({
    tipo: z.literal('disparador'),
    evento: EventoDisparadorSchema,
    tipos: z.array(TipoFiltroSchema).min(1).optional(),
    programa: ProgramaSchema,
  }),
  z.object({
    tipo: z.literal('restriccion'),
    regla: z.enum([
      /** Tus Héroes no pueden ser destruidos. */
      'heroesNoDestruibles',
      /** Los Objetos que juegas no pueden ser desafiados. */
      'objetosNoDesafiables',
      /** No se puede usar el efecto del Héroe equipado. */
      'sinEfectoEquipado',
    ]),
  }),
  /** Puntos de acción adicionales en cada uno de tus turnos. */
  z.object({ tipo: z.literal('paExtra'), valor: z.number().int().min(1) }),
  z.object({
    tipo: z.literal('reemplazo'),
    regla: z.enum([
      /** Si el Héroe equipado fuera a ser sacrificado o destruido, este Objeto va al descarte en su lugar. */
      'senuelo',
      /** Cada vez que fueras a DESTRUIR un Héroe, puedes ARREBATARLO en su lugar. */
      'destruirPorArrebatar',
    ]),
  }),
  /** Acción adicional que el jugador puede usar en su turno. */
  z.object({
    tipo: z.literal('habilidad'),
    costePa: z.number().int().min(0),
    unaVezPorTurno: z.boolean(),
    programa: ProgramaSchema,
  }),
]);
export type Pasiva = z.infer<typeof PasivaSchema>;

export const DefinicionEfectoSchema = z
  .object({
    /** Efecto al superar la tirada (Héroe) o al resolverse (Magia). */
    programa: ProgramaSchema.optional(),
    pasivas: z.array(PasivaSchema).optional(),
    /** Cartas cuyo comportamiento es parte del motor núcleo (Fase 1). */
    nucleo: z.enum(['modificador', 'desafio', 'mascara']).optional(),
  })
  .strict()
  .refine((d) => d.programa !== undefined || d.pasivas !== undefined || d.nucleo !== undefined, {
    message: 'La definición debe tener programa, pasivas o nucleo.',
  });
export type DefinicionEfecto = z.infer<typeof DefinicionEfectoSchema>;

export const DefinicionesEfectosSchema = z.record(z.string(), DefinicionEfectoSchema);
export type DefinicionesEfectos = z.infer<typeof DefinicionesEfectosSchema>;
