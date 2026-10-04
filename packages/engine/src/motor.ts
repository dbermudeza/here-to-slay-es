import { DEFINICIONES_EFECTOS, type Carta, type DefinicionesEfectos } from '@hts/cards';
import { aplicar } from './aplicar';
import { crearPartida, type ConfigPartida } from './crear';
import { CUSTOM_POR_DEFECTO } from './customs';
import type { Ctx, RegistroCustom } from './efectos';
import { avanzarTurno } from './flujo';
import { ejecutarEfectos } from './interprete';
import { accionesLegales } from './legales';
import { cargarPartida, serializarPartida } from './serializar';
import type {
  Accion,
  Actor,
  CodigoError,
  Emitir,
  Envio,
  Evento,
  GameState,
  JugadorId,
  Resultado,
} from './tipos';
import { validar } from './validar';
import { getPlayerView, type VistaJugador } from './vista';

export interface OpcionesMotor {
  /** Definiciones de efectos (por defecto, las del juego base de @hts/cards). */
  definiciones?: DefinicionesEfectos;
  /** Pasos custom adicionales; se combinan con los del juego base. */
  custom?: RegistroCustom;
}

const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

/** Tras cada acción: ejecuta los efectos pendientes y, si no queda nada ni PA, termina el turno. */
function avanzar(ctx: Ctx, d: GameState, emitir: Emitir): void {
  ejecutarEfectos(ctx, d, emitir);
  avanzarTurno(ctx, d, emitir);
}

/** Núcleo puro: valida y aplica una acción sin mutar el estado recibido. */
export function reducir(ctx: Ctx, state: GameState, envio: Envio): Resultado {
  const codigo = validar(ctx, state, envio);
  if (codigo !== null) return { ok: false, error: { codigo } };
  const d = clonar(state);
  const events: Evento[] = [];
  const emitir = (e: Evento): void => {
    events.push(e);
  };
  aplicar(ctx, d, envio, emitir);
  avanzar(ctx, d, emitir);
  return { ok: true, state: d, events };
}

export interface Motor {
  catalogo: Ctx['catalogo'];
  crearPartida: (config: ConfigPartida) => { state: GameState; events: Evento[] };
  reducer: (state: GameState, envio: Envio) => Resultado;
  validar: (state: GameState, envio: Envio) => CodigoError | null;
  accionesLegales: (state: GameState, actor: Actor) => Accion[];
  getPlayerView: (state: GameState, jugador: JugadorId | null) => VistaJugador;
  serializar: (state: GameState) => string;
  cargar: (texto: string) => GameState;
}

export function crearMotor(cartas: readonly Carta[], opciones: OpcionesMotor = {}): Motor {
  const ctx: Ctx = {
    catalogo: new Map(cartas.map((c) => [c.id, c])),
    definiciones: opciones.definiciones ?? DEFINICIONES_EFECTOS,
    custom: { ...CUSTOM_POR_DEFECTO, ...opciones.custom },
  };
  return {
    catalogo: ctx.catalogo,
    crearPartida: (config) => crearPartida(ctx, config),
    reducer: (state, envio) => reducir(ctx, state, envio),
    validar: (state, envio) => validar(ctx, state, envio),
    accionesLegales: (state, actor) => accionesLegales(ctx, state, actor),
    getPlayerView,
    serializar: serializarPartida,
    cargar: (texto) => cargarPartida(ctx, texto),
  };
}
