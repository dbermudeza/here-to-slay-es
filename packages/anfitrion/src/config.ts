import type { NivelBot } from '@hts/bots';
import type { ConfigPartida, JugadorId, Modo } from '@hts/engine';

/** local: todos en el mismo dispositivo · bots: un humano contra bots · enLinea: cada uno en su dispositivo. */
export type ModoJuego = 'local' | 'bots' | 'enLinea';
export type Dificultad = NivelBot | 'mixta';
export type Control = 'humano' | NivelBot;

export interface JugadorConfig {
  id: JugadorId;
  nombre: string;
  control: Control;
}

export interface Segundos {
  desafio: number;
  modificadores: number;
  modificadoresDesafio: number;
}

/** Configuración de una partida que gestiona un anfitrión. */
export interface ConfigAnfitrion {
  modo: ModoJuego;
  reglas: Modo;
  jugadores: JugadorConfig[];
  semilla: string;
  /** Duraciones de las ventanas en segundos. */
  segundos: Segundos;
  /** Dificultad elegida (solo informativa). */
  dificultad?: Dificultad;
  /**
   * Límite de tiempo (segundos) de un jugador humano para cada decisión o acción. Si se agota, el
   * bot normal decide por él esa vez. null o ausente: sin límite.
   */
  limiteDecisionS?: number | null;
}

export const SEGUNDOS_POR_DEFECTO: Segundos = {
  desafio: 10,
  modificadores: 5,
  modificadoresDesafio: 10,
};

export function semillaAleatoria(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Nivel de cada bot según la dificultad: "mixta" alterna normal y fácil. */
export function nivelDeBot(dificultad: Dificultad, indice: number): NivelBot {
  if (dificultad !== 'mixta') return dificultad;
  return indice % 2 === 0 ? 'normal' : 'facil';
}

export function aConfigPartida(c: ConfigAnfitrion): ConfigPartida {
  return {
    jugadores: c.jugadores.map((j) => ({ id: j.id, nombre: j.nombre })),
    semilla: c.semilla,
    opciones: {
      modo: c.reglas,
      duracionVentanaDesafioMs: c.segundos.desafio * 1000,
      duracionVentanaModificadoresMs: c.segundos.modificadores * 1000,
      duracionVentanaModificadoresDesafioMs: c.segundos.modificadoresDesafio * 1000,
    },
  };
}
