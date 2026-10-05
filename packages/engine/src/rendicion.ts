/**
 * Rendirse (D-43). No es una regla del juego de mesa sino una opción de la versión digital:
 * - Quien se rinde deja de jugar: se salta su turno, no responde en las ventanas (cuenta como que
 *   pasa), los efectos no lo eligen y sus pasivas dejan de actuar.
 * - Lo que estuviera esperando su decisión se resuelve solo (primera opción legal; la tirada
 *   inmediata, sin tirar).
 * - Cuando no queda nada pendiente, su mano y su Grupo van al descarte. Su Líder y sus Monstruos
 *   matados se quedan con él, fuera de juego.
 * - Gana el único jugador humano que queda si todos los demás humanos se han rendido. Los bots no
 *   cuentan: si se rinde el último humano, la partida sigue entre los bots.
 */
import { cimaPila, ErrorInterno, idCarta, jugador } from './consultas';
import type { Ctx } from './efectos';
import { aplicar } from './aplicar';
import { cerrarVentana, finTurno } from './flujo';
import { ejecutarEfectos } from './interprete';
import { accionesLegales } from './legales';
import type { Accion, Emitir, GameState, Jugador, JugadorId } from './tipos';

/** Jugadores que siguen en la partida. */
export const activos = (d: GameState): Jugador[] =>
  d.jugadores.filter((j) => !d.rendidos.includes(j.id));

export function rendirse(d: GameState, id: JugadorId, emitir: Emitir): void {
  d.rendidos.push(id);
  emitir({ tipo: 'jugadorRendido', jugador: id });
  const humanos = d.jugadores.filter((j) => !d.opciones.bots.includes(j.id));
  const quedan = humanos.filter((j) => !d.rendidos.includes(j.id));
  const unico = quedan[0];
  if (humanos.length >= 2 && quedan.length === 1 && unico !== undefined) {
    d.ganador = { jugador: unico.id, motivo: 'rendicion' };
    emitir({ tipo: 'victoria', jugador: unico.id, motivo: 'rendicion' });
  }
}

function retirarCartas(d: GameState, j: Jugador, emitir: Emitir): void {
  const uids = [
    ...j.mano,
    ...j.grupo.flatMap((r) => (r.objeto === null ? [r.heroe] : [r.heroe, r.objeto])),
  ];
  if (uids.length === 0) return;
  j.mano = [];
  j.grupo = [];
  d.descarte.push(...uids);
  emitir({ tipo: 'cartasRetiradas', jugador: j.id, cartas: uids.map((u) => idCarta(d, u)) });
}

/** Responde por un jugador rendido lo que la pila espera de él. */
function responderPorRendido(ctx: Ctx, d: GameState, id: JugadorId, emitir: Emitir): void {
  const cima = cimaPila(d);
  let accion: Accion | undefined;
  if (cima?.tipo === 'tiradaInmediata') {
    accion = { tipo: 'TIRADA_INMEDIATA', tirar: false };
  } else {
    // Sus opciones son las que tendría si no se hubiera rendido.
    const sinRendir: GameState = { ...d, rendidos: d.rendidos.filter((x) => x !== id) };
    accion = accionesLegales(ctx, sinRendir, id)[0];
  }
  if (accion === undefined) {
    if (cima?.tipo !== 'elegir') throw new ErrorInterno(`Sin respuesta posible para ${id}`);
    d.pila.pop();
    return;
  }
  aplicar(ctx, d, { actor: id, accion }, emitir);
}

/** Tope de seguridad de pasos automáticos por acción. */
const MAX_PASOS = 500;

/**
 * Tras cada acción: resuelve lo que espera a jugadores rendidos, cierra la ventana de desafío si ya
 * solo faltaban ellos, retira sus cartas y pasa su turno. Sin rendidos no hace nada.
 */
export function atenderRendidos(ctx: Ctx, d: GameState, emitir: Emitir): void {
  if (d.rendidos.length === 0) return;
  for (let paso = 0; paso < MAX_PASOS && d.ganador === null; paso++) {
    ejecutarEfectos(ctx, d, emitir);
    if (d.ganador !== null) return;
    const cima = cimaPila(d);

    if (cima === undefined) {
      for (const id of d.rendidos) retirarCartas(d, jugador(d, id), emitir);
      if (!d.rendidos.includes(d.turno.jugador)) return;
      finTurno(ctx, d, emitir);
      continue;
    }

    if (cima.tipo === 'ventanaDesafio') {
      const rivales = activos(d).filter((j) => j.id !== cima.jugada.jugador);
      if (!rivales.every((j) => cima.pasaron.includes(j.id))) return;
      cerrarVentana(ctx, d, emitir);
      continue;
    }

    if (
      (cima.tipo === 'tiradaInmediata' || cima.tipo === 'elegir' || cima.tipo === 'decision') &&
      d.rendidos.includes(cima.jugador)
    ) {
      responderPorRendido(ctx, d, cima.jugador, emitir);
      continue;
    }
    return;
  }
}
