import { describe, expect, it } from 'vitest';
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
import type { OpcionesPartida } from '../src';

const motor = nuevoMotor();
const base = (opciones: Partial<OpcionesPartida> = {}) =>
  escenario(nuevaPartida(motor, { opciones }), { turnoDe: A, centro: ['h', 'hh', 'mago_h'] });

describe('Rendirse (D-43)', () => {
  it('se puede fuera de turno: sus cartas van al descarte y deja de actuar', () => {
    const s = base();
    const mano = darCarta(s, B, 'magia_prueba');
    const heroe = ponerHeroe(s, B, 'bardo', 'objeto_anillo');
    const { state, events } = hacer(motor, s, B, { tipo: 'RENDIRSE' });
    expect(state.rendidos).toEqual([B]);
    expect(tipos(events)).toEqual(['jugadorRendido', 'cartasRetiradas']);
    expect(jugadorDe(state, B).mano).toEqual([]);
    expect(jugadorDe(state, B).grupo).toEqual([]);
    expect(state.descarte).toEqual(expect.arrayContaining([mano, heroe]));
    // Su Líder se queda con él, fuera de juego.
    expect(jugadorDe(state, B).lider).toBe(s.jugadores[1]?.lider);
    expect(state.turno.jugador).toBe(A);
    expect(motor.accionesLegales(state, B)).toEqual([]);
    expect(rechazo(motor, state, B, { tipo: 'RENDIRSE' })).toBe('JUGADOR_RENDIDO');
  });

  it('RENDIRSE nunca aparece entre las acciones legales (los bots no se rinden)', () => {
    const s = base();
    expect(motor.accionesLegales(s, A).some((a) => a.tipo === 'RENDIRSE')).toBe(false);
    expect(motor.validar(s, { actor: B, accion: { tipo: 'RENDIRSE' } })).toBeNull();
  });

  it('el turno salta a quien se ha rendido', () => {
    let s = hacer(motor, base(), B, { tipo: 'RENDIRSE' }).state;
    s = hacer(motor, s, A, { tipo: 'FIN_TURNO' }).state;
    expect(s.turno.jugador).toBe(C);
    s = hacer(motor, s, C, { tipo: 'FIN_TURNO' }).state;
    expect(s.turno.jugador).toBe(A);
  });

  it('rendirse en el propio turno pasa el turno al siguiente', () => {
    const { state, events } = hacer(motor, base(), A, { tipo: 'RENDIRSE' });
    expect(state.turno.jugador).toBe(B);
    expect(tipos(events)).toContain('turnoTerminado');
  });

  it('gana el único humano que queda cuando los demás se rinden', () => {
    let s = hacer(motor, base(), B, { tipo: 'RENDIRSE' }).state;
    expect(s.ganador).toBeNull();
    const { state, events } = hacer(motor, s, C, { tipo: 'RENDIRSE' });
    expect(state.ganador).toEqual({ jugador: A, motivo: 'rendicion' });
    expect(events).toContainEqual({ tipo: 'victoria', jugador: A, motivo: 'rendicion' });
    s = state;
    expect(rechazo(motor, s, A, { tipo: 'ROBAR' })).toBe('PARTIDA_TERMINADA');
  });

  it('los bots no cuentan: con un bot en la mesa, si el otro humano se rinde, gana el que queda', () => {
    const s = base({ bots: [C] });
    const { state } = hacer(motor, s, B, { tipo: 'RENDIRSE' });
    expect(state.ganador).toEqual({ jugador: A, motivo: 'rendicion' });
  });

  it('si se rinde el último humano, la partida sigue entre los bots', () => {
    const s = base({ bots: [B, C] });
    const { state } = hacer(motor, s, A, { tipo: 'RENDIRSE' });
    expect(state.ganador).toBeNull();
    expect(state.turno.jugador).toBe(B);
    const r = hacer(motor, state, B, { tipo: 'FIN_TURNO' }).state;
    const r2 = hacer(motor, r, C, { tipo: 'FIN_TURNO' }).state;
    expect(r2.turno.jugador).toBe(B);
  });

  it('con su carta en la ventana de desafío: se resuelve, no tira y sus cartas se retiran', () => {
    const s = base();
    const heroe = darCarta(s, A, 'heroe_mago');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: heroe });
    expect(cima(r.state)?.tipo).toBe('ventanaDesafio');
    r = hacer(motor, r.state, A, { tipo: 'RENDIRSE' });
    // Los rivales aún pueden desafiar.
    expect(cima(r.state)?.tipo).toBe('ventanaDesafio');
    r = hacer(motor, r.state, B, { tipo: 'PASAR' });
    r = hacer(motor, r.state, C, { tipo: 'PASAR' });
    expect(r.state.pila).toEqual([]);
    expect(jugadorDe(r.state, A).grupo).toEqual([]);
    expect(r.state.descarte).toContain(heroe);
    expect(r.state.turno.jugador).toBe(B);
    expect(tipos(r.events)).not.toContain('dadosTirados');
  });

  it('cuenta como que pasa en la ventana de desafío de otro', () => {
    const s = base();
    const heroe = darCarta(s, A, 'heroe_mago');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: heroe });
    r = hacer(motor, r.state, C, { tipo: 'PASAR' });
    r = hacer(motor, r.state, B, { tipo: 'RENDIRSE' });
    expect(cima(r.state)?.tipo).not.toBe('ventanaDesafio');
  });

  it('lo que tenía que elegir se resuelve solo', () => {
    const s = base();
    ponerHeroe(s, A, 'bardo');
    ponerHeroe(s, A, 'mago');
    darCarta(s, A, 'desafio');
    darCarta(s, A, 'magia_prueba');
    darCarta(s, A, 'modificador_mas4');
    const hh = s.monstruosCentro[1] ?? '';
    let r = hacer(motor, forzarDados(s, 2, 2), A, { tipo: 'ATACAR', uid: hh });
    r = cerrar(motor, r.state);
    expect(cima(r.state)).toMatchObject({ tipo: 'elegir', jugador: A, accion: 'descartar' });
    r = hacer(motor, r.state, A, { tipo: 'RENDIRSE' });
    expect(r.state.pila).toEqual([]);
    expect(jugadorDe(r.state, A).mano).toEqual([]);
    expect(jugadorDe(r.state, A).grupo).toEqual([]);
    expect(r.state.turno.jugador).toBe(B);
  });

  it('carga partidas guardadas antes de poder rendirse', () => {
    const s = base();
    const antiguo = JSON.parse(motor.serializar(s)) as {
      estado: Record<string, unknown> & { opciones: Record<string, unknown> };
    };
    delete antiguo.estado['rendidos'];
    delete antiguo.estado.opciones['bots'];
    const cargado = motor.cargar(JSON.stringify(antiguo));
    expect(cargado.rendidos).toEqual([]);
    expect(cargado.opciones.bots).toEqual([]);
  });

  it('la vista muestra quién se ha rendido', () => {
    const { state } = hacer(motor, base(), B, { tipo: 'RENDIRSE' });
    expect(motor.getPlayerView(state, A).rendidos).toEqual([B]);
  });
});
