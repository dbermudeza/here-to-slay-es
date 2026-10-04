import type { NivelBot } from '@hts/bots';
import type { ConfigPartida, JugadorId, Modo } from '@hts/engine';

export type ModoJuego = 'local' | 'bots';
export type Dificultad = NivelBot | 'mixta';
export type Control = 'humano' | NivelBot;

export interface JugadorConfig {
  id: JugadorId;
  nombre: string;
  control: Control;
}

/** Configuración de una partida local (en este dispositivo o contra bots). */
export interface ConfigLocal {
  modo: ModoJuego;
  reglas: Modo;
  jugadores: JugadorConfig[];
  semilla: string;
  /** Duraciones de las ventanas en segundos. */
  segundos: { desafio: number; modificadores: number; modificadoresDesafio: number };
  /** Dificultad elegida (solo informativa en modo bots). */
  dificultad?: Dificultad;
}

export const SEGUNDOS_POR_DEFECTO: ConfigLocal['segundos'] = {
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

export function aConfigPartida(c: ConfigLocal): ConfigPartida {
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

export const esHumano = (c: ConfigLocal, id: JugadorId): boolean =>
  c.jugadores.find((j) => j.id === id)?.control === 'humano';
