import type { Clase } from '@hts/cards';
import { describe, expect, it } from 'vitest';
import type { GameState, Modo } from '../src';
import {
  A,
  B,
  cerrar,
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

function preparado(modo: Modo, monstruosPrevios: number, clases: Clase[]): GameState {
  const s = escenario(nuevaPartida(motor, { opciones: { modo } }), {
    turnoDe: A,
    lideres: { [A]: 'bardo' },
    centro: ['h', 'extra_1', 'extra_2'],
  });
  for (const c of clases) ponerHeroe(s, A, c);
  // Monstruos ya matados en turnos anteriores.
  jugadorDe(s, A).monstruos.push(...s.mazoMonstruos.splice(0, monstruosPrevios));
  return s;
}

function matarUno(s: GameState) {
  const uid = s.monstruosCentro[0] ?? '';
  const r = hacer(motor, forzarDados(s, 6, 6), A, { tipo: 'ATACAR', uid });
  return cerrar(motor, r.state);
}

describe('Victoria — reglas normales', () => {
  it('R-090: matar el tercer Monstruo da la victoria inmediatamente', () => {
    const { state, events } = matarUno(preparado('normal', 2, ['luchador']));
    expect(state.ganador).toEqual({ jugador: A, motivo: 'tresMonstruos' });
    expect(tipos(events)).toContain('victoria');
    expect(tipos(events)).not.toContain('turnoTerminado');
  });

  it('con 2 Monstruos aún no se gana', () => {
    const { state } = matarUno(preparado('normal', 1, ['luchador']));
    expect(state.ganador).toBeNull();
  });

  it('R-091: un Grupo con 6 clases (contando el Líder) gana al TERMINAR el turno', () => {
    const s = preparado('normal', 0, ['luchador', 'guardian', 'cazador', 'ladron', 'mago']);
    const r = hacer(motor, s, A, { tipo: 'ROBAR' });
    expect(r.state.ganador).toBeNull();
    const fin = hacer(motor, r.state, A, { tipo: 'FIN_TURNO' });
    expect(fin.state.ganador).toEqual({ jugador: A, motivo: 'grupoCompleto' });
    expect(fin.state.turno.jugador).toBe(A);
  });

  it('R-091: las máscaras cuentan para el Grupo completo', () => {
    const s = preparado('normal', 0, ['luchador', 'guardian', 'cazador', 'ladron']);
    ponerHeroe(s, A, 'bardo', 'objeto_mascara_mago');
    expect(hacer(motor, s, A, { tipo: 'FIN_TURNO' }).state.ganador?.motivo).toBe('grupoCompleto');
  });

  it('con 5 clases no se gana', () => {
    const s = preparado('normal', 0, ['luchador', 'guardian', 'cazador', 'ladron']);
    expect(hacer(motor, s, A, { tipo: 'FIN_TURNO' }).state.ganador).toBeNull();
  });

  it('solo se comprueba el Grupo del jugador que termina el turno', () => {
    const s = preparado('normal', 0, []);
    for (const c of ['luchador', 'guardian', 'cazador', 'ladron', 'mago', 'bardo'] as const)
      ponerHeroe(s, B, c);
    expect(hacer(motor, s, A, { tipo: 'FIN_TURNO' }).state.ganador).toBeNull();
  });

  it('tras la victoria se rechaza cualquier acción', () => {
    const { state } = matarUno(preparado('normal', 2, ['luchador']));
    expect(rechazo(motor, state, A, { tipo: 'ROBAR' })).toBe('PARTIDA_TERMINADA');
    expect(motor.accionesLegales(state, A)).toEqual([]);
  });
});

describe('Victoria — reglas difíciles (R-092, R-093)', () => {
  it('3 Monstruos ya no bastan', () => {
    const { state } = matarUno(preparado('dificil', 2, ['luchador']));
    expect(state.ganador).toBeNull();
  });

  it('6 clases sin Monstruos no bastan', () => {
    const s = preparado('dificil', 0, ['luchador', 'guardian', 'cazador', 'ladron', 'mago']);
    expect(hacer(motor, s, A, { tipo: 'FIN_TURNO' }).state.ganador).toBeNull();
  });

  it('6 clases + 1 Monstruo gana al terminar el turno', () => {
    const s = preparado('dificil', 0, ['luchador', 'guardian', 'cazador', 'ladron', 'mago']);
    const r = matarUno(s);
    expect(r.state.ganador).toBeNull();
    expect(hacer(motor, r.state, A, { tipo: 'FIN_TURNO' }).state.ganador?.motivo).toBe(
      'grupoCompletoYMonstruo',
    );
  });

  it('4 Monstruos + 3 clases gana al matar el cuarto', () => {
    const { state } = matarUno(preparado('dificil', 3, ['luchador', 'mago']));
    expect(state.ganador).toEqual({ jugador: A, motivo: 'cuatroMonstruosTresClases' });
  });

  it('4 Monstruos con solo 2 clases no bastan', () => {
    const { state } = matarUno(preparado('dificil', 3, ['luchador']));
    expect(state.ganador).toBeNull();
  });
});
