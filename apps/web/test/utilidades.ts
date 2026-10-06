import type { GameState } from '@hts/engine';
import { CATALOGO, escenario, nuevoMotor } from '../../../packages/engine/test/fixtures';
import {
  aConfigPartida,
  SEGUNDOS_POR_DEFECTO,
  type ConfigLocal,
  type Control,
} from '../src/juego/config';
import { RelojManual } from '@hts/anfitrion';
import { DirectorVivo } from '../src/juego/director-vivo';

export { CATALOGO };
export const motor = nuevoMotor();

/** Reloj controlable para los tests (el del paquete compartido). */
export { RelojManual as RelojFalso };

export function config(
  modo: ConfigLocal['modo'],
  controles: Control[],
  semilla = 'web',
): ConfigLocal {
  return {
    modo,
    reglas: 'normal',
    semilla,
    segundos: SEGUNDOS_POR_DEFECTO,
    jugadores: controles.map((control, i) => ({ id: `j${i + 1}`, nombre: `J${i + 1}`, control })),
  };
}

/** Director sobre un escenario controlado (manos vacías, turno de j1). */
export function directorEn(
  c: ConfigLocal,
  preparar?: (s: GameState) => void,
  reloj = new RelojManual(),
) {
  const s = escenario(motor.crearPartida(aConfigPartida(c)).state, { turnoDe: 'j1' });
  preparar?.(s);
  const director = new DirectorVivo(motor, c, s, reloj, {
    retardoBotMs: 100,
    celebracionMs: 0,
    pausaResultadoMs: 0,
    presentacionLiderMs: 0,
  });
  return { director, reloj };
}
