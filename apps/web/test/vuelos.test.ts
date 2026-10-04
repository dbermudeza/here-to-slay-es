// @vitest-environment node
import type { Evento } from '@hts/engine';
import { describe, expect, it } from 'vitest';
import { agruparVuelos, verVuelo } from '../src/juego/vuelos';

const nombre = (id: string): string => id.toUpperCase();
const carta = (id: string): string => `«${id}»`;

const robo = (jugador: string, c: string): Evento => ({
  tipo: 'cartaRobada',
  jugador,
  uid: `${c}#1`,
  carta: c,
});

describe('Vuelos de cartas', () => {
  it('agrupa robos consecutivos del mismo jugador y separa los de otro tipo', () => {
    const vuelos = agruparVuelos(
      [
        robo('a', 'x'),
        robo('a', 'y'),
        { tipo: 'turnoTerminado', jugador: 'a' },
        robo('b', 'z'),
        { tipo: 'cartaRecuperada', jugador: 'b', carta: 'w' },
      ],
      1,
    );
    expect(vuelos.map((v) => v.eventos.length)).toEqual([2, 1, 1]);
    expect(vuelos.map((v) => v.id)).toEqual([1, 2, 3]);
  });

  it('robar del mazo: quien roba ve sus cartas; los demás, el reverso', () => {
    const [v] = agruparVuelos([robo('a', 'x'), robo('a', 'y')], 1);
    if (v === undefined) throw new Error('sin vuelo');
    expect(verVuelo(v, 'a', nombre, carta)).toEqual({
      cartas: ['x', 'y'],
      origen: 'mazo',
      destino: 'mano:a',
      texto: 'Robas 2 cartas del mazo',
    });
    expect(verVuelo(v, 'b', nombre, carta)).toMatchObject({
      cartas: [null, null],
      texto: 'A roba 2 cartas del mazo',
    });
  });

  it('recuperar del descarte es público', () => {
    const [v] = agruparVuelos([{ tipo: 'cartaRecuperada', jugador: 'a', carta: 'x' }], 1);
    if (v === undefined) throw new Error('sin vuelo');
    expect(verVuelo(v, 'b', nombre, carta)).toEqual({
      cartas: ['x'],
      origen: 'descarte',
      destino: 'mano:a',
      texto: 'A recupera una carta de la pila de descarte',
    });
  });

  it('sacar de una mano ajena: lo ven el que saca y la víctima, no los demás', () => {
    const [v] = agruparVuelos(
      [{ tipo: 'cartaSacada', jugador: 'a', de: 'b', uid: 'x#1', carta: 'x' }],
      1,
    );
    if (v === undefined) throw new Error('sin vuelo');
    expect(verVuelo(v, 'a', nombre, carta)).toMatchObject({
      cartas: ['x'],
      origen: 'mano:b',
      destino: 'mano:a',
      texto: 'Sacas una carta de la mano de B',
    });
    expect(verVuelo(v, 'b', nombre, carta)).toMatchObject({
      cartas: ['x'],
      texto: 'A te saca una carta de la mano',
    });
    expect(verVuelo(v, 'c', nombre, carta)).toMatchObject({
      cartas: [null],
      texto: 'A saca una carta de la mano de B',
    });
  });

  it('dar una carta: de la mano del que la da a la del que la recibe', () => {
    const [v] = agruparVuelos(
      [{ tipo: 'cartaDada', jugador: 'b', a: 'a', uid: 'x#1', carta: 'x' }],
      1,
    );
    if (v === undefined) throw new Error('sin vuelo');
    expect(verVuelo(v, 'a', nombre, carta)).toMatchObject({
      origen: 'mano:b',
      destino: 'mano:a',
      texto: 'B te da una carta',
    });
    expect(verVuelo(v, 'c', nombre, carta)?.cartas).toEqual([null]);
  });

  it('arrebatar un Héroe del Grupo de otro es público', () => {
    const [v] = agruparVuelos(
      [{ tipo: 'heroeArrebatado', jugador: 'a', de: 'b', carta: 'h', objeto: null }],
      1,
    );
    if (v === undefined) throw new Error('sin vuelo');
    expect(verVuelo(v, 'c', nombre, carta)).toEqual({
      cartas: ['h'],
      origen: 'grupo:b',
      destino: 'grupo:a',
      texto: 'A arrebata «h» del Grupo de B',
    });
    expect(verVuelo(v, 'b', nombre, carta)?.texto).toBe('A te arrebata «h»');
    expect(verVuelo(v, 'a', nombre, carta)?.texto).toBe('Arrebatas «h» del Grupo de B');
  });

  it('mover un Héroe a otro Grupo', () => {
    const [v] = agruparVuelos([{ tipo: 'heroeMovido', de: 'a', a: 'b', carta: 'h' }], 1);
    if (v === undefined) throw new Error('sin vuelo');
    expect(verVuelo(v, null, nombre, carta)).toMatchObject({
      origen: 'grupo:a',
      destino: 'grupo:b',
      texto: '«h» pasa del Grupo de A al de B',
    });
  });
});
