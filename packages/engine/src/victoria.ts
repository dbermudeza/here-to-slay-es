import { CLASES } from '@hts/cards';
import { clasesDelGrupo } from './consultas';
import type { Emitir } from './ops';
import type { Catalogo, GameState, Jugador, Modo, MotivoVictoria } from './tipos';

interface Condicion {
  motivo: MotivoVictoria;
  /** Si también se comprueba en el momento de MATAR un Monstruo, además de al final del turno. */
  alMatar: boolean;
  cumple: (monstruos: number, clases: number) => boolean;
}

const TODAS = CLASES.length;

/**
 * R-090..R-093.
 * - Normal: 3 Monstruos, o un Grupo completo (6 clases).
 * - Difícil: 6 clases + 1 Monstruo, o 4 Monstruos + 3 clases.
 */
// TODO(regla) D-20: momento en que se comprueban las condiciones del modo difícil.
const CONDICIONES: Record<Modo, Condicion[]> = {
  normal: [
    { motivo: 'tresMonstruos', alMatar: true, cumple: (m) => m >= 3 },
    { motivo: 'grupoCompleto', alMatar: false, cumple: (_m, c) => c >= TODAS },
  ],
  dificil: [
    { motivo: 'grupoCompletoYMonstruo', alMatar: false, cumple: (m, c) => c >= TODAS && m >= 1 },
    { motivo: 'cuatroMonstruosTresClases', alMatar: true, cumple: (m, c) => m >= 4 && c >= 3 },
  ],
};

/** Comprueba si `j` gana. Si gana, lo registra en el estado y devuelve true. */
export function comprobarVictoria(
  catalogo: Catalogo,
  d: GameState,
  j: Jugador,
  momento: 'alMatar' | 'finTurno',
  emitir: Emitir,
): boolean {
  if (d.ganador !== null) return true;
  const monstruos = j.monstruos.length;
  const clases = clasesDelGrupo(catalogo, d, j).size;
  for (const c of CONDICIONES[d.opciones.modo]) {
    if (momento === 'alMatar' && !c.alMatar) continue;
    if (c.cumple(monstruos, clases)) {
      d.ganador = { jugador: j.id, motivo: c.motivo };
      emitir({ tipo: 'victoria', jugador: j.id, motivo: c.motivo });
      return true;
    }
  }
  return false;
}
