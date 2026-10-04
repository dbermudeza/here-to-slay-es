import type { GameState } from '@hts/engine';
import { CATALOGO, escenario, nuevoMotor } from '../../../packages/engine/test/fixtures';
import {
  aConfigPartida,
  SEGUNDOS_POR_DEFECTO,
  type ConfigLocal,
  type Control,
} from '../src/juego/config';
import { DirectorVivo, type Reloj } from '../src/juego/director-vivo';

export { CATALOGO };
export const motor = nuevoMotor();

/** Reloj controlable para los tests: el tiempo solo avanza con `avanzar`. */
export class RelojFalso implements Reloj {
  t = 0;
  private siguienteId = 1;
  private tareas: { id: number; en: number; fn: () => void }[] = [];

  ahora = (): number => this.t;

  programar = (fn: () => void, ms: number): number => {
    const id = this.siguienteId++;
    this.tareas.push({ id, en: this.t + ms, fn });
    return id;
  };

  cancelar = (id: number): void => {
    this.tareas = this.tareas.filter((x) => x.id !== id);
  };

  /** Avanza el tiempo ejecutando las tareas que vencen, en orden. */
  avanzar(ms: number): void {
    const fin = this.t + ms;
    for (;;) {
      const proxima = [...this.tareas].sort((a, b) => a.en - b.en)[0];
      if (proxima === undefined || proxima.en > fin) break;
      this.tareas = this.tareas.filter((x) => x !== proxima);
      this.t = proxima.en;
      proxima.fn();
    }
    this.t = fin;
  }

  get pendientes(): number {
    return this.tareas.length;
  }
}

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
  reloj = new RelojFalso(),
) {
  const s = escenario(motor.crearPartida(aConfigPartida(c)).state, { turnoDe: 'j1' });
  preparar?.(s);
  const director = new DirectorVivo(motor, c, s, reloj, { retardoBotMs: 100 });
  return { director, reloj };
}
