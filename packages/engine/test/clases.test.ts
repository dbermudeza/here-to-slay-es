import { CLASES, type Clase } from '@hts/cards';
import { describe, expect, it } from 'vitest';
import { clasesDelGrupo, crearMotor, desgloseClases, type GameState } from '../src';
import {
  A,
  B,
  CATALOGO_CON_MASCARA_CAZADOR,
  escenario,
  jugadorDe,
  nuevaPartida,
  ponerHeroe,
} from './fixtures';

const motor = crearMotor(CATALOGO_CON_MASCARA_CAZADOR);

function conLider(lider: Clase): GameState {
  return escenario(nuevaPartida(motor), { turnoDe: A, lideres: { [A]: lider } });
}

function desglose(s: GameState, id = A) {
  const j = jugadorDe(s, id);
  return desgloseClases(motor.catalogo, (uid) => s.instancias[uid], j.lider, j.grupo);
}

/** Clases con alguien que las aporta. */
const cubiertas = (d: ReturnType<typeof desglose>) =>
  CLASES.filter((c) => d.porClase[c].length > 0);

describe('desgloseClases (R-046, R-091)', () => {
  it('R-091: desglose básico, con el Líder y los Héroes; las clases sin nadie, vacías', () => {
    const s = conLider('bardo');
    const luchador = ponerHeroe(s, A, 'luchador');
    const mago = ponerHeroe(s, A, 'mago');
    const d = desglose(s);
    expect(Object.keys(d.porClase)).toEqual([...CLASES]);
    expect(d.porClase.bardo).toEqual([
      { carta: 'lider_bardo', uid: jugadorDe(s, A).lider, origen: 'lider' },
    ]);
    expect(d.porClase.luchador).toEqual([
      { carta: 'heroe_luchador', uid: luchador, origen: 'heroe' },
    ]);
    expect(d.porClase.mago).toEqual([{ carta: 'heroe_mago', uid: mago, origen: 'heroe' }]);
    expect(d.porClase.guardian).toEqual([]);
    expect(d.total).toBe(3);
  });

  it('R-046: una máscara quita la clase original del Héroe y añade la suya', () => {
    const s = conLider('bardo');
    const guardian = ponerHeroe(s, A, 'guardian', 'objeto_mascara_cazador');
    const d = desglose(s);
    expect(d.porClase.guardian).toEqual([]);
    expect(d.porClase.cazador).toEqual([
      {
        carta: 'heroe_guardian',
        uid: guardian,
        origen: 'mascara',
        objeto: 'objeto_mascara_cazador',
      },
    ]);
    expect(cubiertas(d)).toEqual(['bardo', 'cazador']);
    expect(d.total).toBe(2);
  });

  it('R-046/R-091: el Líder Guardián cubre la clase que quita la máscara de Cazador → 6 clases', () => {
    const s = conLider('guardian');
    ponerHeroe(s, A, 'guardian', 'objeto_mascara_cazador');
    for (const c of ['luchador', 'ladron', 'mago', 'bardo'] as const) ponerHeroe(s, A, c);
    const d = desglose(s);
    expect(d.total).toBe(6);
    expect(d.porClase.guardian.map((a) => a.origen)).toEqual(['lider']);
    expect(d.porClase.cazador.map((a) => a.origen)).toEqual(['mascara']);
  });

  it('R-046/R-091: el mismo Grupo con un Líder de otra clase se queda en 5', () => {
    const s = conLider('bardo');
    ponerHeroe(s, A, 'guardian', 'objeto_mascara_cazador');
    for (const c of ['luchador', 'ladron', 'mago', 'bardo'] as const) ponerHeroe(s, A, c);
    const d = desglose(s);
    expect(d.total).toBe(5);
    expect(d.porClase.guardian).toEqual([]);
    expect(d.porClase.bardo.map((a) => a.origen)).toEqual(['lider', 'heroe']);
  });

  it('R-091: varios Héroes de la misma clase aparecen todos pero cuentan una vez', () => {
    const s = conLider('mago');
    const l1 = ponerHeroe(s, A, 'luchador');
    const l2 = ponerHeroe(s, A, 'luchador');
    const d = desglose(s);
    expect(d.porClase.luchador.map((a) => a.uid)).toEqual([l1, l2]);
    expect(d.total).toBe(2);
  });

  it('coincide con clasesDelGrupo, la fuente de la victoria y de los Monstruos', () => {
    const s = conLider('guardian');
    ponerHeroe(s, A, 'guardian', 'objeto_mascara_cazador');
    ponerHeroe(s, A, 'bardo', 'objeto_mascara_mago');
    ponerHeroe(s, A, 'ladron');
    const clases = clasesDelGrupo(motor.catalogo, s, jugadorDe(s, A));
    const d = desglose(s);
    expect(cubiertas(d)).toEqual(CLASES.filter((c) => clases.has(c)));
    expect(d.total).toBe(clases.size);
  });

  it('funciona con la vista filtrada de otro jugador (getPlayerView) e ignora uids desconocidos', () => {
    const s = conLider('guardian');
    ponerHeroe(s, A, 'guardian', 'objeto_mascara_cazador');
    ponerHeroe(s, A, 'mago');
    const vista = motor.getPlayerView(s, B);
    const ja = vista.jugadores.find((j) => j.id === A);
    if (ja === undefined) throw new Error('falta A');
    const d = desgloseClases(motor.catalogo, (uid) => vista.cartas[uid], ja.lider, ja.grupo);
    expect(d).toEqual(desglose(s));
    const sinNada = desgloseClases(motor.catalogo, () => null, ja.lider, ja.grupo);
    expect(sinNada.total).toBe(0);
  });
});
