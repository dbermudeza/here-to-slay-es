import { describe, expect, it } from 'vitest';
import { SISTEMA, type GameState } from '../src';
import {
  A,
  B,
  C,
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

/** A intenta jugar un Héroe Mago; B tiene un Desafío. */
function heroeJugado() {
  const s = escenario(nuevaPartida(motor), { turnoDe: A });
  const heroe = darCarta(s, A, 'heroe_mago');
  const desafio = darCarta(s, B, 'desafio');
  const r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: heroe });
  return { s: r.state, heroe, desafio };
}

/** B desafía con los dados indicados: [desafiado1, desafiado2, desafiante1, desafiante2]. */
function desafiar(s: GameState, desafio: string, dados: [number, number, number, number]) {
  return hacer(motor, forzarDados(s, ...dados), B, { tipo: 'DESAFIAR', uid: desafio });
}

describe('Desafío', () => {
  it('R-070: el que juega la carta no puede desafiarla', () => {
    const { s } = heroeJugado();
    const propio = darCarta(s, A, 'desafio');
    expect(rechazo(motor, s, A, { tipo: 'DESAFIAR', uid: propio })).toBe('NO_PUEDES_DESAFIARTE');
    expect(rechazo(motor, s, A, { tipo: 'PASAR' })).toBe('NO_PUEDES_DESAFIARTE');
  });

  it('R-070: solo se desafía con una carta de Desafío de la propia mano', () => {
    const { s } = heroeJugado();
    const mod = darCarta(s, B, 'modificador_mas4');
    expect(rechazo(motor, s, B, { tipo: 'DESAFIAR', uid: mod })).toBe('TIPO_DE_CARTA_INVALIDO');
    expect(rechazo(motor, s, C, { tipo: 'DESAFIAR', uid: 'desafio#9' })).toBe('CARTA_NO_EN_MANO');
  });

  it('R-071 / D-11: ambos tiran y la carta de Desafío va al descarte de inmediato', () => {
    const { s, desafio } = heroeJugado();
    const { state, events } = desafiar(s, desafio, [3, 3, 2, 2]);
    expect(state.descarte).toEqual([desafio]);
    expect(tipos(events)).toEqual([
      'ventanaCerrada',
      'desafio',
      'dadosTirados',
      'dadosTirados',
      'ventanaModificadoresAbierta',
    ]);
    expect(cima(state)).toMatchObject({
      tipo: 'ventanaModificadores',
      tiradas: [
        { jugador: A, dados: [3, 3] },
        { jugador: B, dados: [2, 2] },
      ],
    });
  });

  it('R-072 / D-10: si el desafiante saca igual o más, la carta va al descarte y no se recupera el PA', () => {
    for (const dados of [
      [3, 3, 3, 3],
      [2, 2, 5, 5],
    ] as const) {
      const { s, heroe, desafio } = heroeJugado();
      let r = desafiar(s, desafio, [...dados]);
      r = cerrar(motor, r.state);
      expect(r.events).toContainEqual(
        expect.objectContaining({ tipo: 'desafioResuelto', ganador: 'desafiante' }),
      );
      expect(r.state.descarte).toEqual([desafio, heroe]);
      expect(jugadorDe(r.state, A).grupo).toEqual([]);
      expect(r.state.turno.pa).toBe(2);
    }
  });

  it('R-073: si el desafiado saca más, su carta se juega con normalidad', () => {
    const { s, heroe, desafio } = heroeJugado();
    let r = desafiar(s, desafio, [4, 4, 3, 4]);
    r = cerrar(motor, r.state);
    expect(r.events).toContainEqual(
      expect.objectContaining({
        tipo: 'desafioResuelto',
        ganador: 'desafiado',
        totalDesafiado: 8,
        totalDesafiante: 7,
      }),
    );
    expect(jugadorDe(r.state, A).grupo).toEqual([{ heroe, objeto: null }]);
    // R-076: la tirada inmediata se ofrece después de resolver el desafío.
    expect(cima(r.state)).toMatchObject({ tipo: 'tiradaInmediata', heroe });
  });

  it('R-074 / D-10: una jugada solo se desafía una vez y la carta de Desafío no se puede desafiar', () => {
    const { s, desafio } = heroeJugado();
    const otro = darCarta(s, C, 'desafio');
    const r = desafiar(s, desafio, [3, 3, 2, 2]);
    expect(rechazo(motor, r.state, C, { tipo: 'DESAFIAR', uid: otro })).toBe('NO_ES_MOMENTO');
    expect(r.state.pila.some((p) => p.tipo === 'ventanaDesafio')).toBe(false);
  });

  it('la ventana se cierra sola cuando todos los rivales pasan; no se puede pasar dos veces', () => {
    const { s } = heroeJugado();
    const r = hacer(motor, s, B, { tipo: 'PASAR' });
    expect(cima(r.state)?.tipo).toBe('ventanaDesafio');
    expect(rechazo(motor, r.state, B, { tipo: 'PASAR' })).toBe('YA_PASASTE');
    const fin = hacer(motor, r.state, C, { tipo: 'PASAR' });
    expect(tipos(fin.events)).toEqual(['pasa', 'ventanaCerrada', 'heroeEntra']);
  });

  it('se puede desafiar después de que otro rival haya pasado', () => {
    const { s, desafio } = heroeJugado();
    const r = hacer(motor, s, C, { tipo: 'PASAR' });
    expect(
      motor.validar(r.state, { actor: B, accion: { tipo: 'DESAFIAR', uid: desafio } }),
    ).toBeNull();
  });

  it('se pueden desafiar Objetos y Magias', () => {
    const s = escenario(nuevaPartida(motor), { turnoDe: A });
    const h = ponerHeroe(s, A, 'bardo');
    const o = darCarta(s, A, 'objeto_anillo');
    const desafio = darCarta(s, B, 'desafio');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: o, objetivo: h });
    r = desafiar(r.state, desafio, [1, 1, 1, 1]);
    r = cerrar(motor, r.state);
    expect(jugadorDe(r.state, A).grupo).toEqual([{ heroe: h, objeto: null }]);
    expect(r.state.descarte).toEqual([desafio, o]);
  });

  it('mientras hay una ventana abierta, el jugador activo no puede hacer acciones de turno', () => {
    const { s } = heroeJugado();
    expect(rechazo(motor, s, A, { tipo: 'ROBAR' })).toBe('HAY_DECISION_PENDIENTE');
    expect(rechazo(motor, s, A, { tipo: 'FIN_TURNO' })).toBe('HAY_DECISION_PENDIENTE');
  });

  it('CERRAR_VENTANA solo lo envía el sistema y con la secuencia actual', () => {
    const { s } = heroeJugado();
    const v = cima(s);
    if (v?.tipo !== 'ventanaDesafio') throw new Error('sin ventana');
    expect(rechazo(motor, s, A, { tipo: 'CERRAR_VENTANA', secuencia: v.secuencia })).toBe(
      'SOLO_SISTEMA',
    );
    expect(rechazo(motor, s, SISTEMA, { tipo: 'CERRAR_VENTANA', secuencia: v.secuencia - 1 })).toBe(
      'SECUENCIA_OBSOLETA',
    );
  });
});

describe('Modificadores', () => {
  /** A tira por un Héroe Bardo (7+) en su Grupo con los dados indicados. */
  function tiradaHeroe(d1: number, d2: number) {
    const s = escenario(nuevaPartida(motor), { turnoDe: A });
    const heroe = ponerHeroe(s, A, 'bardo');
    const r = hacer(motor, forzarDados(s, d1, d2), A, { tipo: 'TIRAR_HEROE', uid: heroe });
    return { s: r.state, heroe };
  }

  it('R-060 / R-067: tras cada tirada se abre una ventana de 5 s', () => {
    const { s } = tiradaHeroe(3, 3);
    expect(cima(s)).toMatchObject({ tipo: 'ventanaModificadores', duracionMs: 5000 });
  });

  it('R-060 / R-064 / R-065: cualquier jugador, incluido quien tira, puede jugar varios y se suman', () => {
    const { s } = tiradaHeroe(2, 2);
    const propio = darCarta(s, A, 'modificador_mas4');
    const ajeno = darCarta(s, B, 'modificador_mas2_menos2');
    const otro = darCarta(s, C, 'modificador_mas2_menos2');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_MODIFICADOR', uid: propio, valor: 4, tirada: 0 });
    r = hacer(motor, r.state, B, { tipo: 'JUGAR_MODIFICADOR', uid: ajeno, valor: -2, tirada: 0 });
    r = hacer(motor, r.state, C, { tipo: 'JUGAR_MODIFICADOR', uid: otro, valor: 2, tirada: 0 });
    r = cerrar(motor, r.state);
    expect(r.events).toContainEqual(
      expect.objectContaining({ tipo: 'tiradaHeroe', total: 8, exito: true }),
    );
  });

  it('R-066: el Modificador va a la pila de descarte y no cuesta PA', () => {
    const { s } = tiradaHeroe(2, 2);
    const mod = darCarta(s, B, 'modificador_mas4');
    const r = hacer(motor, s, B, { tipo: 'JUGAR_MODIFICADOR', uid: mod, valor: 4, tirada: 0 });
    expect(r.state.descarte).toEqual([mod]);
    expect(r.state.turno.pa).toBe(2);
  });

  it('R-061: solo se puede elegir uno de los valores impresos en la carta', () => {
    const { s } = tiradaHeroe(2, 2);
    const doble = darCarta(s, B, 'modificador_mas2_menos2');
    expect(
      rechazo(motor, s, B, { tipo: 'JUGAR_MODIFICADOR', uid: doble, valor: 4, tirada: 0 }),
    ).toBe('VALOR_INVALIDO');
    expect(
      rechazo(motor, s, B, { tipo: 'JUGAR_MODIFICADOR', uid: doble, valor: 2, tirada: 1 }),
    ).toBe('TIRADA_INVALIDA');
    const des = darCarta(s, B, 'desafio');
    expect(rechazo(motor, s, B, { tipo: 'JUGAR_MODIFICADOR', uid: des, valor: 2, tirada: 0 })).toBe(
      'TIPO_DE_CARTA_INVALIDO',
    );
  });

  it('R-067: cada Modificador reinicia la cuenta (nueva secuencia) y un cierre antiguo se rechaza', () => {
    const { s } = tiradaHeroe(2, 2);
    const v0 = cima(s);
    if (v0?.tipo !== 'ventanaModificadores') throw new Error('sin ventana');
    const mod = darCarta(s, B, 'modificador_mas4');
    const r = hacer(motor, s, B, { tipo: 'JUGAR_MODIFICADOR', uid: mod, valor: 4, tirada: 0 });
    const v1 = cima(r.state);
    if (v1?.tipo !== 'ventanaModificadores') throw new Error('sin ventana');
    expect(v1.secuencia).toBeGreaterThan(v0.secuencia);
    expect(r.events).toContainEqual({
      tipo: 'ventanaReiniciada',
      secuencia: v1.secuencia,
      duracionMs: 5000,
    });
    expect(
      rechazo(motor, r.state, SISTEMA, { tipo: 'CERRAR_VENTANA', secuencia: v0.secuencia }),
    ).toBe('SECUENCIA_OBSOLETA');
  });

  it('no se juegan Modificadores fuera de una ventana de tirada', () => {
    const s = escenario(nuevaPartida(motor), { turnoDe: A });
    const mod = darCarta(s, B, 'modificador_mas4');
    expect(rechazo(motor, s, B, { tipo: 'JUGAR_MODIFICADOR', uid: mod, valor: 4, tirada: 0 })).toBe(
      'NO_ES_MOMENTO',
    );
  });

  it('D-09: en un desafío la ventana dura 10 s y se puede modificar cualquiera de las dos tiradas', () => {
    const { s, desafio } = heroeJugado();
    let r = desafiar(s, desafio, [3, 3, 3, 3]);
    expect(cima(r.state)).toMatchObject({ duracionMs: 10000 });
    // C (que no participa) ayuda al desafiado; el desafiado se baja su propia tirada; da igual quién.
    const ayuda = darCarta(r.state, C, 'modificador_mas2_menos2');
    const propio = darCarta(r.state, A, 'modificador_mas4');
    r = hacer(motor, r.state, C, { tipo: 'JUGAR_MODIFICADOR', uid: ayuda, valor: 2, tirada: 0 });
    r = hacer(motor, r.state, A, { tipo: 'JUGAR_MODIFICADOR', uid: propio, valor: 4, tirada: 1 });
    r = cerrar(motor, r.state);
    expect(r.events).toContainEqual(
      expect.objectContaining({
        tipo: 'desafioResuelto',
        ganador: 'desafiante',
        totalDesafiado: 8,
        totalDesafiante: 10,
      }),
    );
  });
});
