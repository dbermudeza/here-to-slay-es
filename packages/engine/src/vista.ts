import type {
  Evento,
  GameState,
  JugadorId,
  OpcionesPartida,
  Pendiente,
  Ranura,
  Turno,
  Uid,
} from './tipos';

export interface JugadorVista {
  id: JugadorId;
  nombre: string;
  lider: Uid;
  /** Solo la del propio jugador; null para los demás. */
  mano: Uid[] | null;
  cartasEnMano: number;
  grupo: Ranura[];
  monstruos: Uid[];
}

/**
 * Lo que puede ver un jugador (o un espectador, con `yo === null`). No incluye el orden del mazo,
 * las manos ajenas, el estado del RNG ni los dados forzados.
 */
export interface VistaJugador {
  yo: JugadorId | null;
  opciones: OpcionesPartida;
  turno: Turno;
  ganador: GameState['ganador'];
  jugadores: JugadorVista[];
  cartasEnMazo: number;
  descarte: Uid[];
  cartasEnMazoMonstruos: number;
  monstruosCentro: Uid[];
  pila: Pendiente[];
  /** Id de catálogo de cada carta visible para este jugador (y solo de esas). */
  cartas: Record<Uid, string>;
}

export function getPlayerView(estado: GameState, yo: JugadorId | null): VistaJugador {
  const visibles: Uid[] = [...estado.descarte, ...estado.monstruosCentro];
  const jugadores = estado.jugadores.map((j): JugadorVista => {
    const propia = j.id === yo;
    visibles.push(j.lider, ...j.monstruos);
    for (const r of j.grupo) {
      visibles.push(r.heroe);
      if (r.objeto !== null) visibles.push(r.objeto);
    }
    if (propia) visibles.push(...j.mano);
    return {
      id: j.id,
      nombre: j.nombre,
      lider: j.lider,
      mano: propia ? [...j.mano] : null,
      cartasEnMano: j.mano.length,
      grupo: j.grupo.map((r) => ({ ...r })),
      monstruos: [...j.monstruos],
    };
  });
  // Las cartas que se están jugando ya están reveladas (boca arriba).
  for (const p of estado.pila) {
    if (p.tipo === 'ventanaDesafio') visibles.push(p.jugada.uid);
    if (p.tipo === 'ventanaModificadores') {
      if (p.contexto.tipo === 'desafio') visibles.push(p.contexto.jugada.uid);
      for (const t of p.tiradas) visibles.push(...t.modificaciones.map((m) => m.uid));
    }
  }

  const cartas: Record<Uid, string> = {};
  for (const uid of visibles) {
    const id = estado.instancias[uid];
    if (id !== undefined) cartas[uid] = id;
  }

  return {
    yo,
    opciones: { ...estado.opciones },
    turno: { ...estado.turno, heroesUsados: [...estado.turno.heroesUsados] },
    ganador: estado.ganador,
    jugadores,
    cartasEnMazo: estado.mazo.length,
    descarte: [...estado.descarte],
    cartasEnMazoMonstruos: estado.mazoMonstruos.length,
    monstruosCentro: [...estado.monstruosCentro],
    pila: structuredCloneJson(estado.pila),
    cartas,
  };
}

/** Versión de un evento que puede recibir `yo`: oculta las cartas robadas por otros. */
export function eventoParaJugador(evento: Evento, yo: JugadorId | null): Evento {
  if (evento.tipo === 'cartaRobada' && evento.jugador !== yo) {
    return { ...evento, uid: null, carta: null };
  }
  return evento;
}

export function eventosParaJugador(eventos: readonly Evento[], yo: JugadorId | null): Evento[] {
  return eventos.map((e) => eventoParaJugador(e, yo));
}

function structuredCloneJson<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}
