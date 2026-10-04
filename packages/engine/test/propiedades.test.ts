import { existsSync, readFileSync } from 'node:fs';
import { ArchivoCartasSchema } from '@hts/cards';
import { describe, expect, it } from 'vitest';
import { RUTA_CARTAS_JSON } from '../../cards/src/rutas';
import {
  crearMotor,
  crearRng,
  describirEvento,
  ErrorCarga,
  eventosParaJugador,
  problemaDeConservacion,
  siguienteRng,
  SISTEMA,
  type Accion,
  type Actor,
  type EstadoRng,
  type Evento,
  type GameState,
  type Motor,
} from '../src';
import { A, B, C, CATALOGO, escenario, hacer, nuevaPartida, nuevoMotor } from './fixtures';

const motor = nuevoMotor();
const nombres = {
  carta: (id: string) => CATALOGO.find((c) => c.id === id)?.nombre ?? `¿${id}?`,
  jugador: (id: string) => id.toUpperCase(),
};

/** Elige al azar (con semilla) entre todas las acciones legales de todos los actores. */
function partidaAleatoria(
  m: Motor,
  semilla: string,
  pasosMax: number,
  alPaso?: (s: GameState, e: Evento[]) => void,
) {
  let s = nuevaPartida(m, { semilla });
  let rng: EstadoRng = crearRng(`azar-${semilla}`);
  const historial: { actor: Actor; accion: Accion }[] = [];
  for (let paso = 0; paso < pasosMax && s.ganador === null; paso++) {
    const opciones: { actor: Actor; accion: Accion }[] = [];
    for (const j of s.jugadores)
      for (const accion of m.accionesLegales(s, j.id)) opciones.push({ actor: j.id, accion });
    const v = s.pila[s.pila.length - 1];
    if (v !== undefined && 'secuencia' in v) {
      opciones.push({ actor: SISTEMA, accion: { tipo: 'CERRAR_VENTANA', secuencia: v.secuencia } });
    }
    expect(opciones.length, `bloqueo en el paso ${paso}`).toBeGreaterThan(0);
    let x: number;
    [x, rng] = siguienteRng(rng);
    const elegida = opciones[Math.floor(x * opciones.length)];
    if (elegida === undefined) throw new Error('sin opción');
    const r = m.reducer(s, elegida);
    if (!r.ok) throw new Error(`accionesLegales devolvió una acción ilegal: ${r.error.codigo}`);
    historial.push(elegida);
    s = r.state;
    alPaso?.(s, r.events);
  }
  return { state: s, historial };
}

describe('Propiedades del motor', () => {
  it('partidas aleatorias: sin excepciones, sin bloqueos y sin perder ni duplicar cartas', () => {
    for (let i = 0; i < 25; i++) {
      partidaAleatoria(motor, `fuzz${i}`, 400, (s, eventos) => {
        expect(problemaDeConservacion(s)).toBeNull();
        expect(s.turno.pa).toBeGreaterThanOrEqual(0);
        for (const e of eventos) expect(() => describirEvento(e, nombres)).not.toThrow();
      });
    }
  });

  it('es determinista: misma semilla y mismas acciones dan exactamente el mismo estado', () => {
    const { state, historial } = partidaAleatoria(motor, 'det', 300);
    let s = nuevaPartida(motor, { semilla: 'det' });
    for (const envio of historial) {
      const r = motor.reducer(s, envio);
      if (!r.ok) throw new Error(r.error.codigo);
      s = r.state;
    }
    expect(s).toEqual(state);
  });

  it('las acciones legales son exactamente las que el reducer acepta', () => {
    const { state } = partidaAleatoria(motor, 'legales', 120);
    for (const j of state.jugadores) {
      for (const accion of motor.accionesLegales(state, j.id)) {
        expect(motor.validar(state, { actor: j.id, accion })).toBeNull();
      }
    }
  });
});

describe.skipIf(!existsSync(RUTA_CARTAS_JSON))('Catálogo real (Referencias/cartas.es.json)', () => {
  const { cartas } = ArchivoCartasSchema.parse(JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8')));
  const real = crearMotor(cartas);

  it('el mazo principal tiene 115 cartas y cada jugador empieza con 5', () => {
    const s = nuevaPartida(real, { jugadores: [A, B, C, 'dani'] });
    expect(s.mazo.length + s.jugadores.reduce((n, j) => n + j.mano.length, 0)).toBe(115);
  });

  it('partidas aleatorias de 2 a 6 jugadores en ambos modos, sin errores ni pérdida de cartas', () => {
    const ids = [A, B, C, 'dani', 'eva', 'fito'];
    for (let n = 2; n <= 6; n++) {
      for (const modo of ['normal', 'dificil'] as const) {
        let s = nuevaPartida(real, {
          jugadores: ids.slice(0, n),
          semilla: `real${n}${modo}`,
          opciones: { modo },
        });
        let rng: EstadoRng = crearRng(`real${n}${modo}`);
        for (let paso = 0; paso < 600 && s.ganador === null; paso++) {
          const opciones: { actor: Actor; accion: Accion }[] = s.jugadores.flatMap((j) =>
            real.accionesLegales(s, j.id).map((accion) => ({ actor: j.id, accion })),
          );
          const v = s.pila[s.pila.length - 1];
          if (v !== undefined && 'secuencia' in v) {
            opciones.push({
              actor: SISTEMA,
              accion: { tipo: 'CERRAR_VENTANA', secuencia: v.secuencia },
            });
          }
          let x: number;
          [x, rng] = siguienteRng(rng);
          const elegida = opciones[Math.floor(x * opciones.length)];
          if (elegida === undefined) throw new Error(`bloqueo en el paso ${paso}`);
          const r = real.reducer(s, elegida);
          if (!r.ok) throw new Error(r.error.codigo);
          s = r.state;
          expect(problemaDeConservacion(s)).toBeNull();
        }
      }
    }
  });
});

describe('Información oculta (getPlayerView)', () => {
  it('cada jugador ve su mano, el tamaño de las ajenas y nunca el mazo ni el RNG', () => {
    const s = nuevaPartida(motor);
    const vista = motor.getPlayerView(s, A);
    const yo = vista.jugadores.find((j) => j.id === A);
    const otro = vista.jugadores.find((j) => j.id === B);
    expect(yo?.mano).toEqual(s.jugadores.find((j) => j.id === A)?.mano);
    expect(otro?.mano).toBeNull();
    expect(otro?.cartasEnMano).toBe(5);
    expect(vista.cartasEnMazo).toBe(s.mazo.length);
    const texto = JSON.stringify(vista);
    expect(texto).not.toContain('rng');
    expect(texto).not.toContain('dadosForzados');
    for (const uid of [...s.mazo, ...s.mazoMonstruos]) expect(texto).not.toContain(`"${uid}"`);
    for (const j of s.jugadores) {
      if (j.id === A) continue;
      for (const uid of j.mano) expect(texto).not.toContain(`"${uid}"`);
    }
  });

  it('un espectador no ve ninguna mano', () => {
    const vista = motor.getPlayerView(nuevaPartida(motor), null);
    for (const j of vista.jugadores) expect(j.mano).toBeNull();
  });

  it('las cartas robadas por otros llegan ocultas en los eventos', () => {
    const s = escenario(nuevaPartida(motor), { turnoDe: A });
    const { events } = hacer(motor, s, A, { tipo: 'ROBAR' });
    expect(eventosParaJugador(events, A)[0]).toMatchObject({
      tipo: 'cartaRobada',
      carta: expect.any(String),
    });
    expect(eventosParaJugador(events, B)[0]).toEqual({
      tipo: 'cartaRobada',
      jugador: A,
      uid: null,
      carta: null,
    });
    expect(describirEvento(eventosParaJugador(events, C)[0] as Evento, nombres)).toBe(
      'ANA roba una carta.',
    );
  });
});

describe('Guardar y cargar', () => {
  it('serializar y cargar devuelve el mismo estado, que sigue jugándose igual', () => {
    const { state } = partidaAleatoria(motor, 'guardar', 80);
    const cargado = motor.cargar(motor.serializar(state));
    expect(cargado).toEqual(state);
  });

  it('rechaza archivos que no son partidas, versiones desconocidas y estados inconsistentes', () => {
    const s = nuevaPartida(motor);
    expect(() => motor.cargar('no es json')).toThrow(ErrorCarga);
    expect(() => motor.cargar('{"formato":"otro"}')).toThrow(ErrorCarga);
    expect(() =>
      motor.cargar(JSON.stringify({ formato: 'hts-partida', estado: { ...s, version: 2 } })),
    ).toThrow(ErrorCarga);
    const roto = structuredClone(s);
    roto.mazo.push(roto.mazo[0] ?? '');
    expect(() => motor.cargar(motor.serializar(roto))).toThrow(/duplicada/);
    const ajeno = structuredClone(s);
    ajeno.instancias['x#1'] = 'carta_inexistente';
    expect(() => motor.cargar(motor.serializar(ajeno))).toThrow(/catálogo/);
  });
});

describe('Log en español', () => {
  it('describe los eventos principales de forma legible', () => {
    expect(describirEvento({ tipo: 'turnoIniciado', jugador: A, numero: 3 }, nombres)).toBe(
      'Turno 3: le toca a ANA.',
    );
    expect(
      describirEvento(
        {
          tipo: 'modificadorJugado',
          jugador: B,
          carta: 'modificador_mas2_menos2',
          valor: -2,
          sobre: A,
        },
        nombres,
      ),
    ).toBe('BETO juega +2/−2 (−2) sobre la tirada de ANA.');
    expect(
      describirEvento({ tipo: 'victoria', jugador: A, motivo: 'tresMonstruos' }, nombres),
    ).toContain('ha matado 3 Monstruos');
    expect(describirEvento({ tipo: 'ventanaCerrada', secuencia: 1 }, nombres)).toBeNull();
  });
});
