/**
 * Director de partida sin pantalla: hace de host para partidas entre bots (tests, simulación) y
 * simula los temporizadores de las ventanas sin esperar tiempo real.
 *
 * - Turno libre / decisiones: actúa el jugador al que le toca.
 * - Ventana de desafío: cada rival, en orden, desafía o pasa.
 * - Ventana de Modificadores: se pregunta en rondas a todos; si en una ronda completa nadie juega
 *   nada, se cierra (equivale a que venza la cuenta regresiva).
 */
import {
  crearRng,
  siguienteRng,
  SISTEMA,
  type Accion,
  type ConfigPartida,
  type Envio,
  type Evento,
  type GameState,
  type JugadorId,
  type Motor,
} from '@hts/engine';
import type { Bot } from './tipos';

export interface OpcionesDirector {
  /** Semilla de las decisiones de los bots (la del motor va en la configuración de la partida). */
  semillaBots?: string;
  /** Tope de seguridad de acciones; si se alcanza, la partida termina sin ganador. */
  maxAcciones?: number;
  /** Se llama tras cada acción aplicada. */
  alAplicar?: (envio: Envio, estado: GameState, eventos: readonly Evento[]) => void;
}

export interface ResultadoPartida {
  estado: GameState;
  ganador: JugadorId | null;
  acciones: number;
  turnos: number;
  /** Ids de cartas jugadas (intentos) durante la partida. */
  cartasJugadas: string[];
}

export class ErrorDirector extends Error {}

export function jugarPartida(
  motor: Motor,
  config: ConfigPartida,
  bots: Readonly<Record<JugadorId, Bot>>,
  opciones: OpcionesDirector = {},
): ResultadoPartida {
  const maxAcciones = opciones.maxAcciones ?? 20_000;
  let estado = motor.crearPartida(config).state;
  const azares = new Map<JugadorId, () => number>();
  for (const j of estado.jugadores) {
    if (bots[j.id] === undefined) throw new ErrorDirector(`Falta el bot del jugador ${j.id}`);
    let rng = crearRng(`${opciones.semillaBots ?? config.semilla}:${j.id}`);
    azares.set(j.id, () => {
      const [x, siguiente] = siguienteRng(rng);
      rng = siguiente;
      return x;
    });
  }

  let acciones = 0;
  const cartasJugadas: string[] = [];

  const aplicar = (envio: Envio): void => {
    const r = motor.reducer(estado, envio);
    if (!r.ok) {
      throw new ErrorDirector(
        `Acción ilegal de ${envio.actor} (${r.error.codigo}): ${JSON.stringify(envio.accion)}`,
      );
    }
    estado = r.state;
    acciones += 1;
    for (const e of r.events) if (e.tipo === 'cartaJugada') cartasJugadas.push(e.carta);
    opciones.alAplicar?.(envio, estado, r.events);
  };

  /** Pregunta al bot de `jugador`. `obligatoria`: si devuelve null se usa su primera acción legal. */
  const preguntar = (jugador: JugadorId, obligatoria: boolean): Accion | null => {
    const legales = motor.accionesLegales(estado, jugador);
    if (legales.length === 0) return null;
    const bot = bots[jugador];
    const azar = azares.get(jugador);
    if (bot === undefined || azar === undefined) throw new ErrorDirector(`Sin bot para ${jugador}`);
    const accion = bot.elegir({
      vista: motor.getPlayerView(estado, jugador),
      legales,
      catalogo: motor.catalogo,
      azar,
    });
    return accion ?? (obligatoria ? (legales[0] ?? null) : null);
  };

  const enOrdenDesde = (inicio: JugadorId): JugadorId[] => {
    const ids = estado.jugadores.map((j) => j.id);
    const i = ids.indexOf(inicio);
    return [...ids.slice(i), ...ids.slice(0, i)];
  };

  while (estado.ganador === null && acciones < maxAcciones) {
    const cima = estado.pila[estado.pila.length - 1];

    if (cima === undefined) {
      const accion = preguntar(estado.turno.jugador, true);
      if (accion === null) throw new ErrorDirector('El jugador del turno no tiene acciones');
      aplicar({ actor: estado.turno.jugador, accion });
      continue;
    }

    switch (cima.tipo) {
      case 'ventanaDesafio': {
        const pendientes = enOrdenDesde(estado.turno.jugador).filter(
          (id) => id !== cima.jugada.jugador && !cima.pasaron.includes(id),
        );
        const id = pendientes[0];
        if (id === undefined) throw new ErrorDirector('Ventana de desafío sin rivales pendientes');
        const accion = preguntar(id, false) ?? { tipo: 'PASAR' as const };
        aplicar({ actor: id, accion: accion.tipo === 'DESAFIAR' ? accion : { tipo: 'PASAR' } });
        break;
      }
      case 'ventanaModificadores': {
        let jugo = false;
        for (const id of enOrdenDesde(estado.turno.jugador)) {
          const accion = preguntar(id, false);
          if (accion?.tipo === 'JUGAR_MODIFICADOR') {
            aplicar({ actor: id, accion });
            jugo = true;
            break;
          }
        }
        if (!jugo)
          aplicar({
            actor: SISTEMA,
            accion: { tipo: 'CERRAR_VENTANA', secuencia: cima.secuencia },
          });
        break;
      }
      case 'tiradaInmediata':
      case 'elegir':
      case 'decision': {
        const accion = preguntar(cima.jugador, true);
        if (accion === null)
          throw new ErrorDirector(`${cima.jugador} no puede responder a ${cima.tipo}`);
        aplicar({ actor: cima.jugador, accion });
        break;
      }
      case 'efecto':
        throw new ErrorDirector('Un efecto quedó en la cima de la pila sin esperar nada');
    }
  }

  return {
    estado,
    ganador: estado.ganador?.jugador ?? null,
    acciones,
    turnos: estado.turno.numero,
    cartasJugadas,
  };
}
