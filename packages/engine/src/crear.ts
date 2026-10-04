import { TIPOS_MAZO_PRINCIPAL } from '@hts/cards';
import type { Ctx } from './efectos';
import { crearRng } from './rng';
import { barajar, CARTAS_MANO_INICIAL, MONSTRUOS_EN_CENTRO, PA_POR_TURNO } from './ops';
import {
  OPCIONES_POR_DEFECTO,
  type Evento,
  type GameState,
  type Jugador,
  type JugadorId,
  type OpcionesPartida,
  type Uid,
} from './tipos';

export const MIN_JUGADORES = 2;
export const MAX_JUGADORES = 6;

export interface ConfigPartida {
  /** En orden de asiento (sentido horario). */
  jugadores: readonly { id: JugadorId; nombre: string }[];
  semilla: string;
  opciones?: Partial<OpcionesPartida>;
}

export class ErrorConfiguracion extends Error {}

/** Preparación de la partida (R-010..R-015). */
export function crearPartida(
  ctx: Ctx,
  config: ConfigPartida,
): { state: GameState; events: Evento[] } {
  const n = config.jugadores.length;
  // D-01: de 2 a 6 jugadores, uno por Líder.
  if (n < MIN_JUGADORES || n > MAX_JUGADORES) {
    throw new ErrorConfiguracion(
      `Se necesitan entre ${MIN_JUGADORES} y ${MAX_JUGADORES} jugadores.`,
    );
  }
  const ids = new Set(config.jugadores.map((j) => j.id));
  if (ids.size !== n || [...ids].some((id) => id.trim() === '' || id.startsWith('@'))) {
    throw new ErrorConfiguracion(
      'Los ids de jugador deben ser únicos, no vacíos y no empezar por "@".',
    );
  }

  const instancias: Record<Uid, string> = {};
  const crearCopias = (id: string, copias: number): Uid[] =>
    Array.from({ length: copias }, (_, i) => {
      const uid = `${id}#${i + 1}`;
      instancias[uid] = id;
      return uid;
    });

  const cartas = [...ctx.catalogo.values()];
  const mazo = cartas
    .filter((c) => TIPOS_MAZO_PRINCIPAL.includes(c.tipo))
    .flatMap((c) => crearCopias(c.id, c.copias));
  const mazoMonstruos = cartas
    .filter((c) => c.tipo === 'monstruo')
    .flatMap((c) => crearCopias(c.id, c.copias));
  // R-011: en partidas de 2 jugadores no se usa el Líder Ladrón.
  const lideres = cartas.filter((c) => c.tipo === 'lider' && !(n === 2 && c.clase === 'ladron'));
  if (lideres.length < n)
    throw new ErrorConfiguracion('No hay suficientes Líderes para tantos jugadores.');
  if (mazoMonstruos.length < MONSTRUOS_EN_CENTRO) {
    throw new ErrorConfiguracion('El catálogo no tiene suficientes Monstruos.');
  }

  const opciones: OpcionesPartida = { ...OPCIONES_POR_DEFECTO, ...config.opciones };
  const d: GameState = {
    version: 1,
    opciones,
    rng: crearRng(config.semilla),
    secuencia: 0,
    siguienteEfecto: 1,
    instancias,
    jugadores: [],
    mazo,
    descarte: [],
    mazoMonstruos,
    monstruosCentro: [],
    turno: { jugador: '', numero: 1, pa: PA_POR_TURNO, heroesUsados: [], habilidadesUsadas: [] },
    pila: [],
    temporales: [],
    ganador: null,
    dadosForzados: [],
  };
  const events: Evento[] = [{ tipo: 'partidaCreada', modo: opciones.modo, jugadores: [...ids] }];

  // D-02: los Líderes se reparten al azar; empieza quien recibe el último (R-015).
  const lideresBarajados = lideres.map((c) => c.id);
  barajar(d, lideresBarajados);
  const ordenReparto = config.jugadores.map((_, i) => i);
  barajar(d, ordenReparto);

  const jugadores: Jugador[] = config.jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    lider: '',
    mano: [],
    grupo: [],
    monstruos: [],
  }));
  ordenReparto.forEach((indice, k) => {
    const j = jugadores[indice];
    const lider = lideresBarajados[k];
    if (j === undefined || lider === undefined)
      throw new ErrorConfiguracion('Reparto de Líderes inválido.');
    const [uid] = crearCopias(lider, 1);
    if (uid === undefined) throw new ErrorConfiguracion('Reparto de Líderes inválido.');
    j.lider = uid;
    events.push({ tipo: 'liderAsignado', jugador: j.id, carta: lider });
  });
  d.jugadores = jugadores;

  // R-013: barajar y repartir 5 cartas a cada jugador.
  barajar(d, d.mazo);
  for (let ronda = 0; ronda < CARTAS_MANO_INICIAL; ronda++) {
    for (const j of jugadores) {
      const uid = d.mazo.shift();
      if (uid !== undefined) j.mano.push(uid);
    }
  }

  // R-014: 3 Monstruos boca arriba.
  barajar(d, d.mazoMonstruos);
  d.monstruosCentro = d.mazoMonstruos.splice(0, MONSTRUOS_EN_CENTRO);

  const ultimo = jugadores[ordenReparto[ordenReparto.length - 1] ?? 0];
  if (ultimo === undefined) throw new ErrorConfiguracion('Sin jugadores.');
  d.turno.jugador = ultimo.id;
  events.push({ tipo: 'turnoIniciado', jugador: ultimo.id, numero: 1 });

  return { state: d, events };
}
