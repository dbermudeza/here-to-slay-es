/** Resolución de ventanas, jugadas, tiradas y fin de turno (sobre un borrador del estado). */
import type { AccionMonstruo } from '@hts/cards';
import {
  buscarRanura,
  cartaDe,
  cimaPila,
  enRango,
  ErrorInterno,
  idCarta,
  jugador,
  jugadorActivo,
  totalTirada,
} from './consultas';
import type { Ctx } from './efectos';
import {
  abrirVentanaModificadores,
  descartarDeMano,
  PA_POR_TURNO,
  robar,
  sacrificarHeroe,
  tirar,
  type Emitir,
} from './ops';
import type {
  AccionElegir,
  ContextoTirada,
  GameState,
  Jugada,
  Jugador,
  JugadorId,
  Tirada,
  Uid,
} from './tipos';
import { comprobarVictoria } from './victoria';

/** Llama al resolutor de efecto registrado para la carta (Fase 2), si lo hay. */
export function activarEfecto(
  ctx: Ctx,
  d: GameState,
  jugadorId: JugadorId,
  uid: Uid,
  emitir: Emitir,
): void {
  const carta = idCarta(d, uid);
  emitir({ tipo: 'efectoActivado', jugador: jugadorId, carta });
  ctx.efectos[carta]?.({ catalogo: ctx.catalogo, estado: d, jugador: jugadorId, uid, emitir });
}

/** Tirada para usar el efecto de un Héroe (R-031..R-035). */
export function iniciarTiradaHeroe(
  d: GameState,
  jugadorId: JugadorId,
  heroe: Uid,
  emitir: Emitir,
): void {
  d.turno.heroesUsados.push(heroe);
  const t = tirar(d, jugadorId, emitir);
  abrirVentanaModificadores(d, [t], { tipo: 'heroe', heroe }, emitir);
}

/**
 * Apila una decisión de SACRIFICAR o DESCARTAR. Si el jugador no tiene suficientes cartas, se
 * piden las que tenga. Si no hay elección posible (todas o ninguna), se aplica directamente.
 */
export function pedirEleccion(
  d: GameState,
  j: Jugador,
  accion: AccionElegir,
  cantidad: number,
  emitir: Emitir,
): void {
  const disponibles = accion === 'sacrificar' ? j.grupo.map((r) => r.heroe) : [...j.mano];
  const n = Math.min(cantidad, disponibles.length);
  if (n === 0) return;
  if (n === disponibles.length) {
    aplicarEleccion(d, j, accion, disponibles, emitir);
    return;
  }
  d.pila.push({ tipo: 'elegir', jugador: j.id, accion, cantidad: n });
  emitir({ tipo: 'decisionPendiente', jugador: j.id, accion, cantidad: n });
}

export function aplicarEleccion(
  d: GameState,
  j: Jugador,
  accion: AccionElegir,
  uids: readonly Uid[],
  emitir: Emitir,
): void {
  if (accion === 'descartar') {
    descartarDeMano(d, j, uids, emitir);
  } else {
    for (const uid of uids) sacrificarHeroe(d, j, uid, emitir);
  }
}

/** La jugada no fue desafiada (o el desafío fracasó): la carta tiene efecto. */
export function resolverJugada(ctx: Ctx, d: GameState, jugada: Jugada, emitir: Emitir): void {
  const j = jugador(d, jugada.jugador);
  const carta = idCarta(d, jugada.uid);
  switch (jugada.tipo) {
    case 'heroe':
      j.grupo.push({ heroe: jugada.uid, objeto: null });
      emitir({ tipo: 'heroeEntra', jugador: j.id, carta });
      // R-032: puede tirar inmediatamente sin coste adicional.
      d.pila.push({ tipo: 'tiradaInmediata', jugador: j.id, heroe: jugada.uid });
      return;
    case 'objeto': {
      const destino = buscarRanura(d, jugada.objetivo);
      if (destino === null || destino.ranura.objeto !== null) {
        // El objetivo dejó de ser válido mientras la jugada estaba pendiente.
        d.descarte.push(jugada.uid);
        emitir({ tipo: 'cartaAnulada', jugador: j.id, carta });
        return;
      }
      destino.ranura.objeto = jugada.uid;
      emitir({
        tipo: 'objetoEquipado',
        jugador: j.id,
        carta,
        heroe: idCarta(d, jugada.objetivo),
        dueno: destino.jugador.id,
      });
      return;
    }
    case 'magia':
      // R-051: efecto de un solo uso; después va a la pila de descarte.
      activarEfecto(ctx, d, j.id, jugada.uid, emitir);
      d.descarte.push(jugada.uid);
      emitir({ tipo: 'magiaResuelta', jugador: j.id, carta });
      return;
  }
}

/** MATAR un Monstruo (R-088, R-089). */
function matar(
  ctx: Ctx,
  d: GameState,
  j: Jugador,
  monstruo: Uid,
  robarN: number,
  emitir: Emitir,
): void {
  const i = d.monstruosCentro.indexOf(monstruo);
  if (i === -1) throw new ErrorInterno(`El monstruo ${monstruo} no está en el centro`);
  d.monstruosCentro.splice(i, 1);
  j.monstruos.push(monstruo);
  emitir({ tipo: 'monstruoMatado', jugador: j.id, carta: idCarta(d, monstruo) });
  if (robarN > 0) robar(d, j, robarN, emitir);
  // D-14: si el mazo de Monstruos está vacío, no se repone.
  const nuevo = d.mazoMonstruos.shift();
  if (nuevo !== undefined) {
    d.monstruosCentro.push(nuevo);
    emitir({ tipo: 'monstruoRevelado', carta: idCarta(d, nuevo) });
  }
  comprobarVictoria(ctx.catalogo, d, j, 'alMatar', emitir);
}

function aplicarAccionMonstruo(
  ctx: Ctx,
  d: GameState,
  j: Jugador,
  monstruo: Uid,
  accion: AccionMonstruo,
  emitir: Emitir,
): void {
  switch (accion.tipo) {
    case 'matar':
      matar(ctx, d, j, monstruo, accion.robar, emitir);
      return;
    case 'sacrificar':
    case 'descartar':
      pedirEleccion(d, j, accion.tipo, accion.cantidad, emitir);
      return;
  }
}

function resolverTiradas(
  ctx: Ctx,
  d: GameState,
  tiradas: readonly Tirada[],
  contexto: ContextoTirada,
  emitir: Emitir,
): void {
  const [primera, segunda] = tiradas;
  if (primera === undefined) throw new ErrorInterno('Ventana de modificadores sin tiradas');

  switch (contexto.tipo) {
    case 'heroe': {
      const heroe = cartaDe(ctx.catalogo, d, contexto.heroe);
      if (heroe.tipo !== 'heroe') throw new ErrorInterno(`${contexto.heroe} no es un Héroe`);
      const total = totalTirada(primera);
      const exito = total >= heroe.tirada;
      emitir({ tipo: 'tiradaHeroe', jugador: primera.jugador, heroe: heroe.id, total, exito });
      if (exito) activarEfecto(ctx, d, primera.jugador, contexto.heroe, emitir);
      return;
    }
    case 'ataque': {
      const monstruo = cartaDe(ctx.catalogo, d, contexto.monstruo);
      if (monstruo.tipo !== 'monstruo')
        throw new ErrorInterno(`${contexto.monstruo} no es un Monstruo`);
      const total = totalTirada(primera);
      const resultado = enRango(total, monstruo.exito.rango)
        ? 'exito'
        : enRango(total, monstruo.fracaso.rango)
          ? 'fracaso'
          : 'nada';
      const j = jugador(d, primera.jugador);
      emitir({ tipo: 'ataqueResuelto', jugador: j.id, monstruo: monstruo.id, total, resultado });
      if (resultado !== 'nada') {
        aplicarAccionMonstruo(ctx, d, j, contexto.monstruo, monstruo[resultado].accion, emitir);
      }
      return;
    }
    case 'desafio': {
      if (segunda === undefined) throw new ErrorInterno('Desafío sin tirada del desafiante');
      const totalDesafiado = totalTirada(primera);
      const totalDesafiante = totalTirada(segunda);
      // R-072 / D-10: el desafiado solo gana si saca estrictamente más.
      const ganaDesafiante = totalDesafiante >= totalDesafiado;
      emitir({
        tipo: 'desafioResuelto',
        ganador: ganaDesafiante ? 'desafiante' : 'desafiado',
        totalDesafiante,
        totalDesafiado,
      });
      if (ganaDesafiante) {
        d.descarte.push(contexto.jugada.uid);
        emitir({
          tipo: 'cartaAnulada',
          jugador: contexto.jugada.jugador,
          carta: idCarta(d, contexto.jugada.uid),
        });
      } else {
        resolverJugada(ctx, d, contexto.jugada, emitir);
      }
      return;
    }
  }
}

/** Cierra la ventana de la cima de la pila y resuelve lo que estaba pendiente de ella. */
export function cerrarVentana(ctx: Ctx, d: GameState, emitir: Emitir): void {
  const cima = cimaPila(d);
  if (
    cima === undefined ||
    (cima.tipo !== 'ventanaDesafio' && cima.tipo !== 'ventanaModificadores')
  ) {
    throw new ErrorInterno('No hay ventana abierta');
  }
  d.pila.pop();
  emitir({ tipo: 'ventanaCerrada', secuencia: cima.secuencia });
  if (cima.tipo === 'ventanaDesafio') {
    resolverJugada(ctx, d, cima.jugada, emitir);
  } else {
    resolverTiradas(ctx, d, cima.tiradas, cima.contexto, emitir);
  }
}

/** Fin de turno (R-026, R-027): comprueba la victoria y pasa al siguiente jugador en sentido horario. */
export function finTurno(ctx: Ctx, d: GameState, emitir: Emitir): void {
  const actual = jugadorActivo(d);
  emitir({ tipo: 'turnoTerminado', jugador: actual.id });
  if (comprobarVictoria(ctx.catalogo, d, actual, 'finTurno', emitir)) return;
  const i = d.jugadores.indexOf(actual);
  const siguiente = d.jugadores[(i + 1) % d.jugadores.length];
  if (siguiente === undefined) throw new ErrorInterno('Sin jugadores');
  d.turno = {
    jugador: siguiente.id,
    numero: d.turno.numero + 1,
    pa: PA_POR_TURNO,
    heroesUsados: [],
  };
  emitir({ tipo: 'turnoIniciado', jugador: siguiente.id, numero: d.turno.numero });
}

/** Tras cada acción: si no queda nada pendiente y no quedan PA, el turno termina solo (R-026). */
export function avanzar(ctx: Ctx, d: GameState, emitir: Emitir): void {
  if (d.ganador === null && d.pila.length === 0 && d.turno.pa <= 0) finTurno(ctx, d, emitir);
}
