import { describe, expect, it } from 'vitest';
import { problemaDeConservacion, type Modo } from '@hts/engine';
import { BOTS, jugarPartida, type NivelBot } from '../src';
import { HAY_CATALOGO, motor } from '../../engine/test/cartas/reales';

const PARTIDAS = 1000;

describe.skipIf(!HAY_CATALOGO)('Simulación bot contra bot (catálogo real)', () => {
  it(`${PARTIDAS} partidas: sin excepciones, sin bloqueos, sin perder cartas y siempre con ganador`, () => {
    let sinGanador = 0;
    for (let i = 0; i < PARTIDAS; i++) {
      const n = 2 + (i % 5);
      const modo: Modo = Math.floor(i / 5) % 2 === 0 ? 'normal' : 'dificil';
      const ids = Array.from({ length: n }, (_, k) => `j${k}`);
      const nivel = (k: number): NivelBot => ((i + k) % 3 === 0 ? 'facil' : 'normal');
      const r = jugarPartida(
        motor,
        {
          jugadores: ids.map((id) => ({ id, nombre: id })),
          semilla: `sim-${i}`,
          opciones: { modo },
        },
        Object.fromEntries(ids.map((id, k) => [id, BOTS[nivel(k)]])),
        {
          maxAcciones: 20_000,
          alAplicar: (_envio, estado) => {
            const problema = problemaDeConservacion(estado);
            if (problema !== null) throw new Error(`Partida ${i}: ${problema}`);
          },
        },
      );
      if (r.ganador === null) sinGanador += 1;
    }
    expect(sinGanador).toBe(0);
  }, 900_000);

  it('el bot normal gana claramente al fácil en partidas 1 contra 1', () => {
    let normal = 0;
    const total = 100;
    for (let i = 0; i < total; i++) {
      const [x, y] = i % 2 === 0 ? (['n', 'f'] as const) : (['f', 'n'] as const);
      const r = jugarPartida(
        motor,
        {
          jugadores: [
            { id: x, nombre: x },
            { id: y, nombre: y },
          ],
          semilla: `duelo-${i}`,
        },
        { n: BOTS.normal, f: BOTS.facil },
      );
      if (r.ganador === 'n') normal += 1;
    }
    expect(normal).toBeGreaterThanOrEqual(80);
  }, 120_000);

  it('misma semilla, misma partida (bots deterministas)', () => {
    const config = {
      jugadores: ['a', 'b', 'c'].map((id) => ({ id, nombre: id })),
      semilla: 'repetible',
    };
    const bots = { a: BOTS.normal, b: BOTS.facil, c: BOTS.normal };
    const r1 = jugarPartida(motor, config, bots);
    const r2 = jugarPartida(motor, config, bots);
    expect(r2.estado).toEqual(r1.estado);
    expect(r2.acciones).toBe(r1.acciones);
  });
});
