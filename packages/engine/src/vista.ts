import type {
  Decision,
  Evento,
  GameState,
  JugadorId,
  MarcoEfecto,
  OpcionesPartida,
  Pendiente,
  Pregunta,
  Ranura,
  Temporal,
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

/** Un efecto en curso, sin sus variables internas (que pueden contener cartas ocultas). */
export interface MarcoVista {
  tipo: 'efecto';
  id: number;
  jugador: JugadorId;
  carta: string;
  fuente: Uid;
}

/** Una decisión pendiente. La pregunta solo la ve el jugador que debe responder. */
export type DecisionVista = Omit<Decision, 'pregunta'> & { pregunta: Pregunta | null };

export type PendienteVista =
  Exclude<Pendiente, MarcoEfecto | Decision> | MarcoVista | DecisionVista;

/**
 * Lo que puede ver un jugador (o un espectador, con `yo === null`). No incluye el orden del mazo,
 * las manos ajenas, el estado del RNG ni los dados forzados.
 */
export interface VistaJugador {
  yo: JugadorId | null;
  opciones: OpcionesPartida;
  turno: Turno;
  ganador: GameState['ganador'];
  rendidos: JugadorId[];
  jugadores: JugadorVista[];
  cartasEnMazo: number;
  descarte: Uid[];
  cartasEnMazoMonstruos: number;
  monstruosCentro: Uid[];
  pila: PendienteVista[];
  temporales: Temporal[];
  /** Id de catálogo de cada carta visible para este jugador (y solo de esas). */
  cartas: Record<Uid, string>;
}

const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

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

  const pila = estado.pila.map((p): PendienteVista => {
    switch (p.tipo) {
      case 'efecto':
        return { tipo: 'efecto', id: p.id, jugador: p.jugador, carta: p.carta, fuente: p.fuente };
      case 'decision': {
        if (p.jugador !== yo) return { ...clonar(p), pregunta: null };
        if (p.pregunta.tipo === 'cartas') visibles.push(...p.pregunta.opciones);
        if (p.pregunta.tipo === 'ver') visibles.push(...p.pregunta.cartas);
        return clonar(p);
      }
      case 'ventanaDesafio':
        // La carta que se intenta jugar ya está revelada (boca arriba).
        visibles.push(p.jugada.uid);
        return clonar(p);
      case 'ventanaModificadores':
        if (p.contexto.tipo === 'desafio') visibles.push(p.contexto.jugada.uid);
        for (const t of p.tiradas) {
          for (const m of t.modificaciones) if (m.uid !== null) visibles.push(m.uid);
        }
        return clonar(p);
      default:
        return clonar(p);
    }
  });

  const cartas: Record<Uid, string> = {};
  for (const uid of visibles) {
    const id = estado.instancias[uid];
    if (id !== undefined) cartas[uid] = id;
  }

  return {
    yo,
    opciones: { ...estado.opciones },
    turno: clonar(estado.turno),
    ganador: estado.ganador,
    rendidos: [...estado.rendidos],
    jugadores,
    cartasEnMazo: estado.mazo.length,
    descarte: [...estado.descarte],
    cartasEnMazoMonstruos: estado.mazoMonstruos.length,
    monstruosCentro: [...estado.monstruosCentro],
    pila,
    temporales: clonar(estado.temporales),
    cartas,
  };
}

/** Versión de un evento que puede recibir `yo`: oculta las cartas que no debe conocer. */
export function eventoParaJugador(evento: Evento, yo: JugadorId | null): Evento {
  switch (evento.tipo) {
    case 'cartaRobada':
      return evento.jugador === yo ? evento : { ...evento, uid: null, carta: null };
    case 'cartaSacada':
      return evento.jugador === yo || evento.de === yo
        ? evento
        : { ...evento, uid: null, carta: null };
    case 'cartaDada':
      return evento.jugador === yo || evento.a === yo
        ? evento
        : { ...evento, uid: null, carta: null };
    default:
      return evento;
  }
}

export function eventosParaJugador(eventos: readonly Evento[], yo: JugadorId | null): Evento[] {
  return eventos.map((e) => eventoParaJugador(e, yo));
}
