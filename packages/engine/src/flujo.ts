/** Resolución de jugadas, ventanas, tiradas y turnos (sobre un borrador del estado). */
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
import { robarCartas, sacrificarHeroe } from './grupo';
import { apilarMarco } from './marcos';
import {
  abrirVentanaModificadores,
  CARTAS_ROBO_INICIO_TURNO,
  descartarDeMano,
  PA_POR_TURNO,
  tirar,
} from './ops';
import { bonosDeTirada, jugadaIndesafiable, notificar, paExtra } from './pasivas';
import type {
  AccionElegir,
  ContextoTirada,
  Emitir,
  GameState,
  Jugada,
  Jugador,
  JugadorId,
  Tirada,
  Uid,
} from './tipos';
import { comprobarVictoria } from './victoria';

/** Ejecuta el programa de efecto de la carta (Héroe con éxito o Magia), si tiene. */
export function activarEfecto(
  ctx: Ctx,
  d: GameState,
  jugadorId: JugadorId,
  uid: Uid,
  emitir: Emitir,
): void {
  const carta = idCarta(d, uid);
  emitir({ tipo: 'efectoActivado', jugador: jugadorId, carta });
  if (ctx.definiciones[carta]?.programa !== undefined) {
    apilarMarco(d, { jugador: jugadorId, fuente: uid, carta, pasiva: null });
  }
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
 * Intento de jugar una carta (desde la mano o "inmediatamente" por un efecto). Abre la ventana de
 * desafío (R-070), salvo que la jugada no se pueda desafiar (Iron Resolve, Osolechuza Veterano).
 */
export function iniciarJugada(ctx: Ctx, d: GameState, jugada: Jugada, emitir: Emitir): void {
  const carta = idCarta(d, jugada.uid);
  emitir({
    tipo: 'cartaJugada',
    jugador: jugada.jugador,
    uid: jugada.uid,
    carta,
    objetivo: jugada.tipo === 'objeto' ? jugada.objetivo : null,
  });
  if (jugadaIndesafiable(ctx, d, jugada)) {
    emitir({ tipo: 'jugadaIndesafiable', jugador: jugada.jugador, carta });
    resolverJugada(ctx, d, jugada, emitir);
    return;
  }
  d.secuencia += 1;
  const duracionMs = d.opciones.duracionVentanaDesafioMs;
  d.pila.push({ tipo: 'ventanaDesafio', secuencia: d.secuencia, duracionMs, jugada, pasaron: [] });
  emitir({ tipo: 'ventanaDesafioAbierta', secuencia: d.secuencia, duracionMs });
}

/**
 * Apila una decisión de SACRIFICAR o DESCARTAR (penalización de Monstruo). Si el jugador no tiene
 * suficientes cartas, se piden las que tenga. Si no hay elección posible, se aplica directamente.
 */
export function pedirEleccion(
  ctx: Ctx,
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
    aplicarEleccion(ctx, d, j, accion, disponibles, emitir);
    return;
  }
  d.pila.push({ tipo: 'elegir', jugador: j.id, accion, cantidad: n });
  emitir({ tipo: 'decisionPendiente', jugador: j.id, accion, cantidad: n });
}

export function aplicarEleccion(
  ctx: Ctx,
  d: GameState,
  j: Jugador,
  accion: AccionElegir,
  uids: readonly Uid[],
  emitir: Emitir,
): void {
  if (accion === 'descartar') {
    descartarDeMano(d, j, uids, emitir);
  } else {
    for (const uid of uids) sacrificarHeroe(ctx, d, j, uid, emitir);
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
      // R-051: efecto de un solo uso; la carta va a la pila de descarte.
      d.descarte.push(jugada.uid);
      emitir({ tipo: 'magiaResuelta', jugador: j.id, carta });
      // D-35: el Sabio Encapuchado solo se activa si la Magia se resuelve.
      // D-37: el efecto de la carta se resuelve antes que los disparadores (se apila encima).
      notificar(ctx, d, [{ tipo: 'magiaJugada', jugador: j.id }], emitir);
      activarEfecto(ctx, d, j.id, jugada.uid, emitir);
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
  // D-14: si el mazo de Monstruos está vacío, no se repone.
  const nuevo = d.mazoMonstruos.shift();
  if (nuevo !== undefined) {
    d.monstruosCentro.push(nuevo);
    emitir({ tipo: 'monstruoRevelado', carta: idCarta(d, nuevo) });
  }
  if (comprobarVictoria(ctx.catalogo, d, j, 'alMatar', emitir)) return;
  if (robarN > 0) robarCartas(ctx, d, j, robarN, emitir);
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
      pedirEleccion(ctx, d, j, accion.tipo, accion.cantidad, emitir);
      return;
  }
}

/** Total final de cada tirada (dados + Modificadores + bonos de pasivas y temporales). */
function totalesFinales(
  ctx: Ctx,
  d: GameState,
  tiradas: readonly Tirada[],
  contexto: ContextoTirada,
  emitir: Emitir,
): number[] {
  return tiradas.map((t) => {
    const bonos = bonosDeTirada(ctx, d, t, contexto);
    // El bono del Líder (R-082) se anuncia antes del total en el que se suma.
    const lider = d.jugadores.find((j) => j.id === t.jugador)?.lider;
    const cartaLider = lider === undefined ? null : idCarta(d, lider);
    if (cartaLider !== null && bonos.some((b) => b.carta === cartaLider)) {
      emitir({ tipo: 'liderActivado', jugador: t.jugador, carta: cartaLider });
    }
    const base = totalTirada(t);
    const total = base + bonos.reduce((s, b) => s + b.valor, 0);
    emitir({
      tipo: 'tiradaFinal',
      jugador: t.jugador,
      dados: t.dados,
      modificadores: base - t.dados[0] - t.dados[1],
      bonos,
      total,
    });
    return total;
  });
}

function resolverTiradas(
  ctx: Ctx,
  d: GameState,
  tiradas: readonly Tirada[],
  contexto: ContextoTirada,
  emitir: Emitir,
): void {
  const [primera] = tiradas;
  if (primera === undefined) throw new ErrorInterno('Ventana de modificadores sin tiradas');
  const totales = totalesFinales(ctx, d, tiradas, contexto, emitir);
  const total = totales[0] ?? 0;

  switch (contexto.tipo) {
    case 'heroe': {
      const heroe = cartaDe(ctx.catalogo, d, contexto.heroe);
      if (heroe.tipo !== 'heroe') throw new ErrorInterno(`${contexto.heroe} no es un Héroe`);
      const exito = total >= heroe.tirada;
      emitir({ tipo: 'tiradaHeroe', jugador: primera.jugador, heroe: heroe.id, total, exito });
      // D-37: los disparadores (Aries Ártico, monedas) se resuelven después del efecto del Héroe.
      notificar(
        ctx,
        d,
        [{ tipo: 'tiradaHeroe', jugador: primera.jugador, heroe: contexto.heroe, exito }],
        emitir,
      );
      if (exito) activarEfecto(ctx, d, primera.jugador, contexto.heroe, emitir);
      return;
    }
    case 'ataque': {
      const monstruo = cartaDe(ctx.catalogo, d, contexto.monstruo);
      if (monstruo.tipo !== 'monstruo')
        throw new ErrorInterno(`${contexto.monstruo} no es un Monstruo`);
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
      const totalDesafiado = total;
      const totalDesafiante = totales[1];
      if (totalDesafiante === undefined)
        throw new ErrorInterno('Desafío sin tirada del desafiante');
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

function expirarTemporales(
  d: GameState,
  jugadorId: JugadorId,
  expira: 'finTurno' | 'inicioTurnoPropio',
  emitir: Emitir,
): void {
  const quedan = [];
  for (const t of d.temporales) {
    if (t.jugador === jugadorId && t.expira === expira) {
      emitir({ tipo: 'temporalTerminado', jugador: t.jugador, efecto: t.tipo, carta: t.carta });
    } else {
      quedan.push(t);
    }
  }
  d.temporales = quedan;
}

/** Fin de turno (R-026, R-027): comprueba la victoria y pasa al siguiente jugador en sentido horario. */
export function finTurno(ctx: Ctx, d: GameState, emitir: Emitir): void {
  const actual = jugadorActivo(d);
  emitir({ tipo: 'turnoTerminado', jugador: actual.id });
  expirarTemporales(d, actual.id, 'finTurno', emitir);
  if (comprobarVictoria(ctx.catalogo, d, actual, 'finTurno', emitir)) return;
  const i = d.jugadores.indexOf(actual);
  // D-43: el turno salta a quienes se han rendido.
  const n = d.jugadores.length;
  const siguiente = Array.from({ length: n }, (_, k) => d.jugadores[(i + 1 + k) % n]).find(
    (j) => j !== undefined && !d.rendidos.includes(j.id),
  );
  if (siguiente === undefined) throw new ErrorInterno('Sin jugadores');
  expirarTemporales(d, siguiente.id, 'inicioTurnoPropio', emitir);
  // D-03 / D-26 / D-36: 3 PA, más los extra de Megababosa (desde el turno siguiente a matarla).
  const pa = PA_POR_TURNO + paExtra(ctx, d, siguiente);
  d.turno = {
    jugador: siguiente.id,
    numero: d.turno.numero + 1,
    pa,
    paInicial: pa,
    heroesUsados: [],
    habilidadesUsadas: [],
  };
  emitir({ tipo: 'turnoIniciado', jugador: siguiente.id, numero: d.turno.numero });
  // R-029 / D-42: al empezar el turno se roba una carta gratis (sin gastar PA).
  robarCartas(ctx, d, siguiente, CARTAS_ROBO_INICIO_TURNO, emitir);
}

/** Si no queda nada pendiente y no quedan PA, el turno termina solo (R-026). */
export function avanzarTurno(ctx: Ctx, d: GameState, emitir: Emitir): void {
  if (d.ganador === null && d.pila.length === 0 && d.turno.pa <= 0) finTurno(ctx, d, emitir);
}
