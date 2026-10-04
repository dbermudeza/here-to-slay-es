import { describe, expect, it, vi } from 'vitest';
import { clasesDelGrupo, type ResolverEfecto } from '../src';
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
  todosPasan,
} from './fixtures';

const motor = nuevoMotor();
const base = () => escenario(nuevaPartida(motor), { turnoDe: A });

describe('Héroes', () => {
  it('R-030 / R-070: jugar un Héroe cuesta 1 PA y abre una ventana de desafío', () => {
    const s = base();
    const h = darCarta(s, A, 'heroe_mago');
    const { state, events } = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h });
    expect(state.turno.pa).toBe(2);
    expect(jugadorDe(state, A).mano).toEqual([]);
    expect(cima(state)).toMatchObject({
      tipo: 'ventanaDesafio',
      jugada: { tipo: 'heroe', uid: h },
      pasaron: [],
    });
    expect(tipos(events)).toEqual(['cartaJugada', 'ventanaDesafioAbierta']);
  });

  it('R-030: el Héroe entra en el Grupo cuando nadie lo desafía, y se ofrece la tirada inmediata', () => {
    const s = base();
    const h = darCarta(s, A, 'heroe_mago');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h });
    r = todosPasan(motor, r.state);
    expect(jugadorDe(r.state, A).grupo).toEqual([{ heroe: h, objeto: null }]);
    expect(cima(r.state)).toEqual({ tipo: 'tiradaInmediata', jugador: A, heroe: h });
  });

  it('el host puede cerrar la ventana de desafío por tiempo', () => {
    const s = base();
    const h = darCarta(s, A, 'heroe_mago');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h });
    r = cerrar(motor, r.state);
    expect(jugadorDe(r.state, A).grupo.map((x) => x.heroe)).toEqual([h]);
  });

  it('R-032 / D-05: la tirada inmediata no cuesta PA, pero cuenta como el uso de ese turno', () => {
    const s = base();
    const h = darCarta(s, A, 'heroe_mago');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h });
    r = todosPasan(motor, r.state);
    r = hacer(motor, forzarDados(r.state, 3, 3), A, { tipo: 'TIRADA_INMEDIATA', tirar: true });
    expect(r.state.turno.pa).toBe(2);
    expect(r.state.turno.heroesUsados).toEqual([h]);
    r = cerrar(motor, r.state);
    expect(rechazo(motor, r.state, A, { tipo: 'TIRAR_HEROE', uid: h })).toBe('HEROE_YA_USADO');
  });

  it('D-05: si no se hace la tirada inmediata, se puede tirar más tarde ese turno pagando 1 PA', () => {
    const s = base();
    const h = darCarta(s, A, 'heroe_mago');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h });
    r = todosPasan(motor, r.state);
    r = hacer(motor, r.state, A, { tipo: 'TIRADA_INMEDIATA', tirar: false });
    expect(r.state.pila).toEqual([]);
    r = hacer(motor, forzarDados(r.state, 4, 4), A, { tipo: 'TIRAR_HEROE', uid: h });
    expect(r.state.turno.pa).toBe(1);
  });

  it('R-033 / R-034: tirar por un Héroe del Grupo cuesta 1 PA, una vez por turno aunque falle', () => {
    const s = base();
    const h = ponerHeroe(s, A, 'bardo');
    let r = hacer(motor, forzarDados(s, 1, 1), A, { tipo: 'TIRAR_HEROE', uid: h });
    expect(r.state.turno.pa).toBe(2);
    r = cerrar(motor, r.state);
    expect(r.events).toContainEqual(
      expect.objectContaining({ tipo: 'tiradaHeroe', exito: false, total: 2 }),
    );
    // R-035: no se recupera el PA.
    expect(r.state.turno.pa).toBe(2);
    expect(rechazo(motor, r.state, A, { tipo: 'TIRAR_HEROE', uid: h })).toBe('HEROE_YA_USADO');
  });

  it('R-034: en el turno siguiente se puede volver a tirar por el mismo Héroe', () => {
    const s = base();
    const h = ponerHeroe(s, A, 'bardo');
    let r = hacer(motor, forzarDados(s, 1, 1), A, { tipo: 'TIRAR_HEROE', uid: h });
    r = cerrar(motor, r.state);
    for (const j of [A, B, 'cata']) r = hacer(motor, r.state, j, { tipo: 'FIN_TURNO' });
    expect(
      motor.validar(r.state, { actor: A, accion: { tipo: 'TIRAR_HEROE', uid: h } }),
    ).toBeNull();
  });

  it('solo se puede tirar por Héroes del propio Grupo', () => {
    const s = base();
    const ajeno = ponerHeroe(s, B, 'bardo');
    expect(rechazo(motor, s, A, { tipo: 'TIRAR_HEROE', uid: ajeno })).toBe('HEROE_NO_EN_GRUPO');
  });

  it('R-031: el efecto se activa si la tirada es ≥ al requisito, con el resolutor registrado', () => {
    const efecto = vi.fn<ResolverEfecto>();
    const m = nuevoMotor({ efectos: { heroe_bardo: efecto } });
    const s = escenario(nuevaPartida(m), { turnoDe: A });
    const h = ponerHeroe(s, A, 'bardo'); // requisito 7+
    let r = hacer(m, forzarDados(s, 3, 3), A, { tipo: 'TIRAR_HEROE', uid: h });
    r = cerrar(m, r.state);
    expect(efecto).not.toHaveBeenCalled();
    const s2 = escenario(r.state, { turnoDe: A });
    r = hacer(m, forzarDados(s2, 3, 4), A, { tipo: 'TIRAR_HEROE', uid: h });
    r = cerrar(m, r.state);
    expect(efecto).toHaveBeenCalledTimes(1);
    expect(efecto.mock.calls[0]?.[0]).toMatchObject({ jugador: A, uid: h });
    expect(tipos(r.events)).toContain('efectoActivado');
  });

  it('R-036: no hay límite de Héroes en el Grupo', () => {
    const s = base();
    for (let i = 0; i < 3; i++)
      for (const c of ['bardo', 'mago', 'luchador'] as const) ponerHeroe(s, A, c);
    const h = darCarta(s, A, 'heroe_guardian');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h });
    r = todosPasan(motor, r.state);
    expect(jugadorDe(r.state, A).grupo).toHaveLength(10);
  });
});

describe('Objetos', () => {
  it('R-041: un Objeto se equipa a un Héroe propio', () => {
    const s = base();
    const h = ponerHeroe(s, A, 'bardo');
    const o = darCarta(s, A, 'objeto_anillo');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: o, objetivo: h });
    r = todosPasan(motor, r.state);
    expect(jugadorDe(r.state, A).grupo).toEqual([{ heroe: h, objeto: o }]);
    expect(r.state.turno.pa).toBe(2);
  });

  it('D-06: cualquier Objeto, también uno Maldito, se puede equipar a un Héroe de otro jugador', () => {
    const s = base();
    const ajeno = ponerHeroe(s, B, 'bardo');
    const llave = darCarta(s, A, 'objeto_maldito_llave');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: llave, objetivo: ajeno });
    r = todosPasan(motor, r.state);
    expect(jugadorDe(r.state, B).grupo).toEqual([{ heroe: ajeno, objeto: llave }]);
    expect(r.events).toContainEqual(expect.objectContaining({ tipo: 'objetoEquipado', dueno: B }));

    const s2 = escenario(r.state, { turnoDe: A });
    const propio = ponerHeroe(s2, A, 'mago');
    const anillo = darCarta(s2, A, 'objeto_anillo');
    expect(
      motor.validar(s2, {
        actor: A,
        accion: { tipo: 'JUGAR_CARTA', uid: anillo, objetivo: propio },
      }),
    ).toBeNull();
  });

  it('R-042 / R-043: no se equipa a Líderes, ni a Héroes que ya tienen Objeto, ni sin objetivo', () => {
    const s = base();
    const conObjeto = ponerHeroe(s, A, 'bardo', 'objeto_anillo');
    const o = darCarta(s, A, 'objeto_anillo');
    const lider = jugadorDe(s, A).lider;
    expect(rechazo(motor, s, A, { tipo: 'JUGAR_CARTA', uid: o, objetivo: conObjeto })).toBe(
      'OBJETIVO_INVALIDO',
    );
    expect(rechazo(motor, s, A, { tipo: 'JUGAR_CARTA', uid: o, objetivo: lider })).toBe(
      'OBJETIVO_INVALIDO',
    );
    expect(rechazo(motor, s, A, { tipo: 'JUGAR_CARTA', uid: o })).toBe('OBJETIVO_INVALIDO');
  });

  it('las cartas que no son Objeto no admiten objetivo', () => {
    const s = base();
    const h = ponerHeroe(s, A, 'bardo');
    const magia = darCarta(s, A, 'magia_prueba');
    expect(rechazo(motor, s, A, { tipo: 'JUGAR_CARTA', uid: magia, objetivo: h })).toBe(
      'OBJETIVO_INVALIDO',
    );
  });

  it('R-046: una máscara cambia la clase del Héroe equipado', () => {
    const s = escenario(nuevaPartida(motor), { turnoDe: A, lideres: { [A]: 'bardo' } });
    const h = ponerHeroe(s, A, 'luchador');
    const mascara = darCarta(s, A, 'objeto_mascara_mago');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: mascara, objetivo: h });
    r = todosPasan(motor, r.state);
    expect([...clasesDelGrupo(motor.catalogo, r.state, jugadorDe(r.state, A))].sort()).toEqual([
      'bardo',
      'mago',
    ]);
  });

  it('R-021b: solo se pueden jugar Héroes, Objetos y Magias en el turno', () => {
    const s = base();
    const mod = darCarta(s, A, 'modificador_mas4');
    const des = darCarta(s, A, 'desafio');
    expect(rechazo(motor, s, A, { tipo: 'JUGAR_CARTA', uid: mod })).toBe('TIPO_DE_CARTA_INVALIDO');
    expect(rechazo(motor, s, A, { tipo: 'JUGAR_CARTA', uid: des })).toBe('TIPO_DE_CARTA_INVALIDO');
    expect(rechazo(motor, s, A, { tipo: 'JUGAR_CARTA', uid: 'heroe_bardo#1' })).toBe(
      'CARTA_NO_EN_MANO',
    );
  });
});

describe('Magia', () => {
  it('R-050 / R-051: cuesta 1 PA, resuelve su efecto y va a la pila de descarte', () => {
    const efecto = vi.fn<ResolverEfecto>();
    const m = nuevoMotor({ efectos: { magia_prueba: efecto } });
    const s = escenario(nuevaPartida(m), { turnoDe: A });
    const magia = darCarta(s, A, 'magia_prueba');
    let r = hacer(m, s, A, { tipo: 'JUGAR_CARTA', uid: magia });
    expect(r.state.turno.pa).toBe(2);
    r = todosPasan(m, r.state);
    expect(efecto).toHaveBeenCalledTimes(1);
    expect(r.state.descarte).toEqual([magia]);
    expect(tipos(r.events)).toEqual(expect.arrayContaining(['efectoActivado', 'magiaResuelta']));
  });
});
