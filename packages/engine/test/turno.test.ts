import { describe, expect, it } from 'vitest';
import {
  A,
  B,
  C,
  darCarta,
  escenario,
  hacer,
  jugadorDe,
  nuevaPartida,
  nuevoMotor,
  rechazo,
  tipos,
} from './fixtures';

const motor = nuevoMotor();
const base = () => escenario(nuevaPartida(motor), { turnoDe: A });

describe('Turno y puntos de acción', () => {
  it('R-021a: ROBAR cuesta 1 PA y añade la carta superior del mazo a la mano', () => {
    const s = base();
    const superior = s.mazo[0];
    const { state, events } = hacer(motor, s, A, { tipo: 'ROBAR' });
    expect(state.turno.pa).toBe(2);
    expect(jugadorDe(state, A).mano).toEqual([superior]);
    expect(tipos(events)).toEqual(['cartaRobada']);
  });

  it('R-020: se puede repetir la misma acción mientras queden PA', () => {
    let s = base();
    s = hacer(motor, s, A, { tipo: 'ROBAR' }).state;
    s = hacer(motor, s, A, { tipo: 'ROBAR' }).state;
    expect(jugadorDe(s, A).mano).toHaveLength(2);
    expect(s.turno.pa).toBe(1);
  });

  it('R-026: al gastar el último PA el turno pasa al siguiente jugador (sentido horario)', () => {
    let s = base();
    s = hacer(motor, s, A, { tipo: 'ROBAR' }).state;
    s = hacer(motor, s, A, { tipo: 'ROBAR' }).state;
    const { state, events } = hacer(motor, s, A, { tipo: 'ROBAR' });
    expect(tipos(events)).toEqual([
      'cartaRobada',
      'turnoTerminado',
      'turnoIniciado',
      'cartaRobada',
    ]);
    expect(state.turno).toEqual({
      jugador: B,
      numero: s.turno.numero + 1,
      pa: 3,
      heroesUsados: [],
      habilidadesUsadas: [],
    });
  });

  it('R-029: al empezar el turno se roba una carta gratis y se conservan los 3 PA', () => {
    const s = base();
    const superior = s.mazo[0];
    const { state, events } = hacer(motor, s, A, { tipo: 'FIN_TURNO' });
    expect(jugadorDe(state, B).mano).toEqual([superior]);
    expect(state.turno).toMatchObject({ jugador: B, pa: 3 });
    expect(events).toContainEqual({
      tipo: 'cartaRobada',
      jugador: B,
      uid: superior,
      carta: expect.any(String),
    });
  });

  it('R-029 / R-095: el robo de inicio de turno también rebaraja el descarte si el mazo está vacío', () => {
    const s = base();
    s.descarte = s.mazo.splice(0);
    const { state, events } = hacer(motor, s, A, { tipo: 'FIN_TURNO' });
    expect(tipos(events)).toContain('mazoRebarajado');
    expect(jugadorDe(state, B).mano).toHaveLength(1);
  });

  it('R-026: FIN_TURNO termina el turno aunque queden PA; el último jugador pasa al primero', () => {
    let s = escenario(nuevaPartida(motor), { turnoDe: C });
    s = hacer(motor, s, C, { tipo: 'FIN_TURNO' }).state;
    expect(s.turno.jugador).toBe(A);
    expect(s.turno.pa).toBe(3);
  });

  it('R-028: los PA no usados no se acumulan', () => {
    let s = base();
    s = hacer(motor, s, A, { tipo: 'FIN_TURNO' }).state;
    s = hacer(motor, s, B, { tipo: 'FIN_TURNO' }).state;
    s = hacer(motor, s, C, { tipo: 'FIN_TURNO' }).state;
    expect(s.turno).toMatchObject({ jugador: A, pa: 3 });
  });

  it('solo el jugador activo puede hacer acciones de turno', () => {
    const s = base();
    expect(rechazo(motor, s, B, { tipo: 'ROBAR' })).toBe('NO_ES_TU_TURNO');
    expect(rechazo(motor, s, B, { tipo: 'FIN_TURNO' })).toBe('NO_ES_TU_TURNO');
    expect(rechazo(motor, s, 'nadie', { tipo: 'ROBAR' })).toBe('JUGADOR_DESCONOCIDO');
  });

  it('D-03: no se puede gastar más PA de los que quedan', () => {
    let s = base();
    s = hacer(motor, s, A, { tipo: 'ROBAR' }).state;
    expect(rechazo(motor, s, A, { tipo: 'RENOVAR_MANO' })).toBe('PA_INSUFICIENTES');
    s = hacer(motor, s, A, { tipo: 'ROBAR' }).state;
    expect(rechazo(motor, s, A, { tipo: 'ATACAR', uid: s.monstruosCentro[0] ?? '' })).toBe(
      'PA_INSUFICIENTES',
    );
  });

  it('R-023: RENOVAR_MANO cuesta 3 PA, descarta toda la mano y roba 5', () => {
    const s = base();
    const viejas = [darCarta(s, A, 'desafio'), darCarta(s, A, 'magia_prueba')];
    const { state, events } = hacer(motor, s, A, { tipo: 'RENOVAR_MANO' });
    const mano = jugadorDe(state, A).mano;
    expect(mano).toHaveLength(5);
    expect(mano.some((u) => viejas.includes(u))).toBe(false);
    expect(state.descarte).toEqual(viejas);
    expect(tipos(events).slice(0, 2)).toEqual(['cartasDescartadas', 'manoRenovada']);
    expect(state.turno.jugador).toBe(B);
  });

  it('R-023: RENOVAR_MANO con la mano vacía solo roba 5', () => {
    const { state, events } = hacer(motor, base(), A, { tipo: 'RENOVAR_MANO' });
    expect(jugadorDe(state, A).mano).toHaveLength(5);
    expect(tipos(events)).not.toContain('cartasDescartadas');
  });

  it('D-04: no hay límite de mano: se roba y se termina el turno sin descartar', () => {
    const s = base();
    for (let i = 0; i < 6; i++) darCarta(s, A, 'modificador_mas2_menos2');
    for (let i = 0; i < 6; i++) darCarta(s, A, 'desafio');
    let r = hacer(motor, s, A, { tipo: 'ROBAR' });
    r = hacer(motor, r.state, A, { tipo: 'FIN_TURNO' });
    expect(jugadorDe(r.state, A).mano).toHaveLength(13);
    expect(tipos(r.events)).not.toContain('cartasDescartadas');
    expect(r.state.turno.jugador).toBe(B);
  });

  it('R-095 / D-16: si el mazo se agota, se baraja la pila de descarte como nuevo mazo', () => {
    const s = base();
    s.descarte = s.mazo.splice(0, s.mazo.length - 1);
    const unica = s.mazo[0];
    let r = hacer(motor, s, A, { tipo: 'ROBAR' });
    expect(jugadorDe(r.state, A).mano).toEqual([unica]);
    r = hacer(motor, r.state, A, { tipo: 'ROBAR' });
    expect(tipos(r.events)).toEqual(['mazoRebarajado', 'cartaRobada']);
    expect(r.state.descarte).toEqual([]);
    expect(r.state.mazo).toHaveLength(s.descarte.length - 1);
  });

  it('D-16: sin mazo ni descarte, robar no tiene efecto pero gasta el PA', () => {
    const s = base();
    jugadorDe(s, B).mano.push(...s.mazo.splice(0));
    expect(s.mazo).toHaveLength(0);
    const { state, events } = hacer(motor, s, A, { tipo: 'ROBAR' });
    expect(tipos(events)).toEqual(['mazoAgotado']);
    expect(state.turno.pa).toBe(2);
  });

  it('no modifica el estado recibido (inmutabilidad)', () => {
    const s = base();
    const copia = structuredClone(s);
    hacer(motor, s, A, { tipo: 'RENOVAR_MANO' });
    expect(s).toEqual(copia);
  });
});
