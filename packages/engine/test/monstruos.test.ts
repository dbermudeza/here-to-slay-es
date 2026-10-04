import { describe, expect, it } from 'vitest';
import { cumpleRequisitos } from '../src';
import {
  A,
  B,
  cerrar,
  cima,
  darCarta,
  escenario,
  forzarDados,
  hacer,
  jugadorDe,
  nuevaPartida,
  nuevoMotor,
  ponerHeroe,
  rechazo,
  tipos,
} from './fixtures';

const motor = nuevoMotor();
const CENTRO = ['h', 'hh', 'mago_h'];

function preparado(lider: 'bardo' | 'mago' = 'bardo', centro = CENTRO) {
  return escenario(nuevaPartida(motor), { turnoDe: A, lideres: { [A]: lider }, centro });
}

const uidMonstruo = (s: ReturnType<typeof preparado>, id: string): string => {
  const uid = [...s.monstruosCentro, ...s.mazoMonstruos].find(
    (u) => s.instancias[u] === `monstruo_${id}`,
  );
  if (uid === undefined) throw new Error(id);
  return uid;
};

function atacar(s: ReturnType<typeof preparado>, id: string, d1: number, d2: number) {
  let r = hacer(motor, forzarDados(s, d1, d2), A, { tipo: 'ATACAR', uid: uidMonstruo(s, id) });
  r = cerrar(motor, r.state);
  return r;
}

describe('Requisitos de Monstruo (R-086)', () => {
  const req = (
    s: ReturnType<typeof preparado>,
    requisitos: Parameters<typeof cumpleRequisitos>[3],
  ) => cumpleRequisitos(motor.catalogo, s, jugadorDe(s, A), requisitos);

  it('el Líder cubre un símbolo de su clase, pero nunca un símbolo "H"', () => {
    const s = preparado('mago');
    expect(req(s, ['mago'])).toBe(true);
    expect(req(s, ['heroe'])).toBe(false);
    ponerHeroe(s, A, 'bardo');
    expect(req(s, ['mago', 'heroe'])).toBe(true);
  });

  it('una misma carta no cubre dos símbolos', () => {
    const s = preparado('bardo');
    ponerHeroe(s, A, 'mago');
    expect(req(s, ['mago'])).toBe(true);
    expect(req(s, ['mago', 'heroe'])).toBe(false);
    ponerHeroe(s, A, 'luchador');
    expect(req(s, ['mago', 'heroe'])).toBe(true);
    expect(req(s, ['heroe', 'heroe', 'heroe'])).toBe(false);
  });

  it('la búsqueda asigna bien aunque el orden de los Héroes sea desfavorable', () => {
    const s = preparado('bardo');
    ponerHeroe(s, A, 'mago');
    ponerHeroe(s, A, 'cazador');
    expect(req(s, ['heroe', 'mago'])).toBe(true);
    expect(req(s, ['cazador', 'mago', 'bardo'])).toBe(true);
    expect(req(s, ['cazador', 'mago', 'bardo', 'heroe'])).toBe(false);
  });

  it('las máscaras cuentan como la clase que otorgan (R-046)', () => {
    const s = preparado('bardo');
    ponerHeroe(s, A, 'luchador', 'objeto_mascara_mago');
    expect(req(s, ['mago'])).toBe(true);
    expect(req(s, ['luchador'])).toBe(false);
  });

  it('ATACAR se rechaza si no se cumplen los requisitos o el Monstruo no está en el centro', () => {
    const s = preparado('bardo', ['hh', 'mago_h', 'dracos']);
    ponerHeroe(s, A, 'bardo');
    expect(rechazo(motor, s, A, { tipo: 'ATACAR', uid: uidMonstruo(s, 'hh') })).toBe(
      'REQUISITOS_NO_CUMPLIDOS',
    );
    expect(rechazo(motor, s, A, { tipo: 'ATACAR', uid: uidMonstruo(s, 'h') })).toBe(
      'MONSTRUO_NO_DISPONIBLE',
    );
  });
});

describe('Ataque (R-085..R-089)', () => {
  it('R-085: atacar cuesta 2 PA y abre una ventana de modificadores', () => {
    const s = preparado();
    ponerHeroe(s, A, 'bardo');
    const r = hacer(motor, forzarDados(s, 4, 4), A, { tipo: 'ATACAR', uid: uidMonstruo(s, 'h') });
    expect(r.state.turno.pa).toBe(1);
    expect(cima(r.state)).toMatchObject({
      tipo: 'ventanaModificadores',
      contexto: { tipo: 'ataque' },
    });
  });

  it('R-087 / R-088 / R-089: con éxito el Monstruo pasa al Grupo y se revela otro', () => {
    const s = preparado();
    ponerHeroe(s, A, 'bardo');
    const m = uidMonstruo(s, 'h');
    const siguiente = s.mazoMonstruos[0];
    const { state, events } = atacar(s, 'h', 4, 4);
    expect(jugadorDe(state, A).monstruos).toEqual([m]);
    expect(state.monstruosCentro).not.toContain(m);
    expect(state.monstruosCentro).toContain(siguiente);
    expect(tipos(events)).toEqual(
      expect.arrayContaining(['ataqueResuelto', 'monstruoMatado', 'monstruoRevelado']),
    );
  });

  it('R-087: algunos Monstruos dejan ROBAR al matarlos', () => {
    const s = preparado();
    ponerHeroe(s, A, 'bardo');
    ponerHeroe(s, A, 'mago');
    const { state } = atacar(s, 'hh', 6, 6);
    expect(jugadorDe(state, A).mano).toHaveLength(1);
  });

  it('R-087: entre los dos rangos no pasa nada y no se recuperan los PA', () => {
    const s = preparado();
    ponerHeroe(s, A, 'bardo');
    const { state, events } = atacar(s, 'h', 3, 3);
    expect(events).toContainEqual(
      expect.objectContaining({ tipo: 'ataqueResuelto', total: 6, resultado: 'nada' }),
    );
    expect(state.monstruosCentro).toContain(uidMonstruo(s, 'h'));
    expect(state.turno.pa).toBe(1);
    expect(jugadorDe(state, A).grupo).toHaveLength(1);
  });

  it('R-087: en el rango de fracaso se paga el precio; con un solo Héroe se sacrifica directamente', () => {
    const s = preparado();
    const h = ponerHeroe(s, A, 'bardo', 'objeto_anillo');
    const { state, events } = atacar(s, 'h', 2, 3);
    expect(jugadorDe(state, A).grupo).toEqual([]);
    expect(state.descarte).toEqual(expect.arrayContaining([h]));
    expect(state.descarte).toHaveLength(2); // D-07: el Objeto va con él.
    expect(tipos(events)).toContain('heroeSacrificado');
  });

  it('R-087: con varios Héroes, el jugador elige cuál sacrificar', () => {
    const s = preparado();
    ponerHeroe(s, A, 'bardo');
    const elegido = ponerHeroe(s, A, 'mago');
    let r = atacar(s, 'h', 1, 1);
    expect(cima(r.state)).toEqual({
      tipo: 'elegir',
      jugador: A,
      accion: 'sacrificar',
      cantidad: 1,
    });
    expect(rechazo(motor, r.state, B, { tipo: 'ELEGIR', uids: [elegido] })).toBe('NO_ES_MOMENTO');
    expect(rechazo(motor, r.state, A, { tipo: 'ELEGIR', uids: [] })).toBe('SELECCION_INVALIDA');
    r = hacer(motor, r.state, A, { tipo: 'ELEGIR', uids: [elegido] });
    expect(jugadorDe(r.state, A).grupo.map((x) => x.heroe)).not.toContain(elegido);
  });

  it('R-087: los Monstruos de "DESCARTA 2" piden elegir 2 cartas de la mano', () => {
    const s = preparado();
    ponerHeroe(s, A, 'bardo');
    ponerHeroe(s, A, 'mago');
    const mano = [
      darCarta(s, A, 'desafio'),
      darCarta(s, A, 'magia_prueba'),
      darCarta(s, A, 'modificador_mas4'),
    ];
    let r = atacar(s, 'hh', 2, 2);
    expect(cima(r.state)).toMatchObject({ accion: 'descartar', cantidad: 2 });
    expect(
      rechazo(motor, r.state, A, { tipo: 'ELEGIR', uids: [mano[0] ?? '', mano[0] ?? ''] }),
    ).toBe('SELECCION_INVALIDA');
    r = hacer(motor, r.state, A, { tipo: 'ELEGIR', uids: [mano[0] ?? '', mano[2] ?? ''] });
    expect(jugadorDe(r.state, A).mano).toEqual([mano[1]]);
  });

  it('D-13: Dracos funciona al revés (5− lo mata, 8+ obliga a sacrificar)', () => {
    const s = preparado('bardo', ['dracos', 'hh', 'mago_h']);
    ponerHeroe(s, A, 'bardo');
    const bajo = atacar(s, 'dracos', 2, 2);
    expect(jugadorDe(bajo.state, A).monstruos).toHaveLength(1);
    const alto = atacar(s, 'dracos', 5, 5);
    expect(jugadorDe(alto.state, A).monstruos).toHaveLength(0);
    expect(jugadorDe(alto.state, A).grupo).toHaveLength(0);
  });

  it('D-14: si el mazo de Monstruos está vacío, el centro no se repone', () => {
    const s = preparado();
    ponerHeroe(s, A, 'bardo');
    jugadorDe(s, B).monstruos.push(...s.mazoMonstruos.splice(0));
    const { state, events } = atacar(s, 'h', 6, 6);
    expect(state.monstruosCentro).toHaveLength(2);
    expect(tipos(events)).not.toContain('monstruoRevelado');
  });
});
