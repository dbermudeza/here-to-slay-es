/** Configuración de partida: compartida con el servidor a través de @hts/anfitrion. */
import type { ConfigAnfitrion } from '@hts/anfitrion';
import type { JugadorId } from '@hts/engine';

export {
  aConfigPartida,
  nivelDeBot,
  SEGUNDOS_POR_DEFECTO,
  semillaAleatoria,
  type Control,
  type Dificultad,
  type JugadorConfig,
  type ModoJuego,
} from '@hts/anfitrion';

/** Configuración de una partida en este navegador (o la que describe una partida en línea). */
export type ConfigLocal = ConfigAnfitrion;

export const esHumano = (c: ConfigLocal, id: JugadorId): boolean =>
  c.jugadores.find((j) => j.id === id)?.control === 'humano';
