import { describe, expect, it } from 'vitest';
import { ErrorConfiguracion, problemaDeConservacion, type Evento } from '../src';
import { A, B, C, CATALOGO, nuevaPartida, nuevoMotor } from './fixtures';

const motor = nuevoMotor();
const totalMazo = CATALOGO.filter((c) =>
  ['heroe', 'objeto', 'objeto_maldito', 'magia', 'modificador', 'desafio'].includes(c.tipo),
).reduce((n, c) => n + c.copias, 0);

describe('Preparación', () => {
  it('D-01: admite de 2 a 6 jugadores', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let n = 2; n <= 6; n++)
      expect(() => nuevaPartida(motor, { jugadores: ids.slice(0, n) })).not.toThrow();
    expect(() => nuevaPartida(motor, { jugadores: ['a'] })).toThrow(ErrorConfiguracion);
    expect(() => nuevaPartida(motor, { jugadores: ids })).toThrow(ErrorConfiguracion);
  });

  it('rechaza ids de jugador repetidos o reservados', () => {
    expect(() => nuevaPartida(motor, { jugadores: ['a', 'a'] })).toThrow(ErrorConfiguracion);
    expect(() => nuevaPartida(motor, { jugadores: ['a', '@sistema'] })).toThrow(ErrorConfiguracion);
  });

  it('R-010 / D-02: cada jugador recibe un Líder distinto al azar', () => {
    const s = nuevaPartida(motor);
    const lideres = s.jugadores.map((j) => s.instancias[j.lider]);
    expect(new Set(lideres).size).toBe(3);
    for (const id of lideres) expect(id).toMatch(/^lider_/);
    const otros = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const x = nuevaPartida(motor, { semilla: `s${i}` });
      otros.add(String(x.instancias[x.jugadores[0]?.lider ?? '']));
    }
    expect(otros.size).toBeGreaterThan(1);
  });

  it('R-011: en partidas de 2 jugadores nunca sale el Líder Ladrón', () => {
    for (let i = 0; i < 40; i++) {
      const s = nuevaPartida(motor, { jugadores: [A, B], semilla: `dos${i}` });
      for (const j of s.jugadores) expect(s.instancias[j.lider]).not.toBe('lider_ladron');
    }
  });

  it('R-012: los Líderes no repartidos no forman parte de la partida', () => {
    const s = nuevaPartida(motor);
    const lideres = Object.values(s.instancias).filter((id) => id.startsWith('lider_'));
    expect(lideres).toHaveLength(3);
  });

  it('R-013: reparte 5 cartas a cada jugador y el resto forma el mazo', () => {
    const s = nuevaPartida(motor);
    for (const j of s.jugadores) expect(j.mano).toHaveLength(5);
    expect(s.mazo).toHaveLength(totalMazo - 15);
    expect(s.descarte).toEqual([]);
  });

  it('R-014: 3 Monstruos boca arriba y el resto en el mazo de Monstruos', () => {
    const s = nuevaPartida(motor);
    expect(s.monstruosCentro).toHaveLength(3);
    expect(s.mazoMonstruos).toHaveLength(CATALOGO.filter((c) => c.tipo === 'monstruo').length - 3);
  });

  it('R-015: empieza quien recibió el último Líder, con 3 PA', () => {
    for (let i = 0; i < 10; i++) {
      const { state, events } = motor.crearPartida({
        jugadores: [A, B, C].map((id) => ({ id, nombre: id })),
        semilla: `inicio${i}`,
      });
      const asignados = events.filter(
        (e): e is Extract<Evento, { tipo: 'liderAsignado' }> => e.tipo === 'liderAsignado',
      );
      expect(state.turno.jugador).toBe(asignados[asignados.length - 1]?.jugador);
      expect(state.turno.pa).toBe(3);
    }
  });

  it('es determinista: misma semilla, misma partida; otra semilla, otra partida', () => {
    expect(nuevaPartida(motor, { semilla: 'x' })).toEqual(nuevaPartida(motor, { semilla: 'x' }));
    expect(nuevaPartida(motor, { semilla: 'x' }).mazo).not.toEqual(
      nuevaPartida(motor, { semilla: 'y' }).mazo,
    );
  });

  it('conserva todas las cartas', () => {
    expect(problemaDeConservacion(nuevaPartida(motor))).toBeNull();
  });

  it('aplica el modo y las duraciones de ventana configuradas', () => {
    const s = nuevaPartida(motor, {
      opciones: { modo: 'dificil', duracionVentanaDesafioMs: 3000 },
    });
    expect(s.opciones).toEqual({
      modo: 'dificil',
      duracionVentanaDesafioMs: 3000,
      duracionVentanaModificadoresMs: 5000,
      duracionVentanaModificadoresDesafioMs: 10000,
    });
  });
});
