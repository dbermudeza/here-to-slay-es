import { describe, expect, it } from 'vitest';
import {
  darCarta,
  escenario,
  forzarDados,
  nuevoMotor,
  ponerHeroe,
} from '../../engine/test/fixtures';
import {
  aConfigPartida,
  Anfitrion,
  PAUSA_RESULTADO_POR_DEFECTO_MS,
  RelojManual,
  SEGUNDOS_POR_DEFECTO,
  type ConfigAnfitrion,
  type OpcionesAnfitrion,
} from '../src';

/**
 * Pausa de resultado: tras un evento que la interfaz enseña como resultado (tirada, duelo, jugada
 * resuelta o anulada), los bots esperan `pausaResultadoMs` antes de su siguiente acción para que
 * el resultado se vea. No es una regla del juego (no cita ninguna regla): es ritmo del anfitrión.
 */
const motor = nuevoMotor();
const RETARDO = 100;

const config: ConfigAnfitrion = {
  modo: 'enLinea',
  reglas: 'normal',
  semilla: 'pausa-resultado',
  segundos: SEGUNDOS_POR_DEFECTO,
  jugadores: [
    { id: 'j1', nombre: 'J1', control: 'humano' },
    { id: 'j2', nombre: 'J2', control: 'normal' },
  ],
};

/** Turno del humano j1, con un Héroe en el Grupo cuya tirada fallará (1 + 1). */
function preparado(opciones: OpcionesAnfitrion = {}, turnoDe = 'j1') {
  const reloj = new RelojManual();
  const s = escenario(motor.crearPartida(aConfigPartida(config)).state, { turnoDe });
  const heroe = ponerHeroe(s, 'j1', 'bardo');
  const a = new Anfitrion(motor, config, forzarDados(s, 1, 1), reloj, {
    retardoBotMs: RETARDO,
    celebracionMs: 0,
    ...opciones,
  });
  return { a, reloj, heroe };
}

/** j1 tira por su Héroe y se deja vencer la ventana de Modificadores. Devuelve el instante. */
function tirarHeroe(a: Anfitrion, reloj: RelojManual, heroe: string): number {
  expect(a.enviar('j1', { tipo: 'TIRAR_HEROE', uid: heroe })).toBeNull();
  expect(a.estado.pila.at(-1)?.tipo).toBe('ventanaModificadores');
  reloj.avanzar(a.restanteMs() ?? 0);
  expect(a.eventos.at(-1)).toMatchObject({ tipo: 'tiradaHeroe', jugador: 'j1', exito: false });
  return reloj.t;
}

/** Eventos emitidos por j2 (el bot) desde el índice `desde`. */
function delBot(a: Anfitrion, desde: number): number {
  return a.eventos.slice(desde).filter((e) => 'jugador' in e && e.jugador === 'j2').length;
}

describe('Anfitrión: pausa de resultado para los bots', () => {
  it('el valor por defecto es 4500 ms', () => {
    expect(PAUSA_RESULTADO_POR_DEFECTO_MS).toBe(4500);
  });

  it('tras una tirada de Héroe, el bot no actúa antes de la pausa y sí al cumplirse', () => {
    const { a, reloj, heroe } = preparado();
    const t = tirarHeroe(a, reloj, heroe);
    // El humano no espera: puede acabar su turno durante la pausa.
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
    expect(a.estado.turno.jugador).toBe('j2');
    const desde = a.eventos.length;
    reloj.avanzar(t + PAUSA_RESULTADO_POR_DEFECTO_MS - 1 - reloj.t);
    expect(delBot(a, desde)).toBe(0);
    reloj.avanzar(1);
    expect(delBot(a, desde)).toBeGreaterThan(0);
  });

  it('la pausa se cuenta desde el evento, no desde la acción siguiente', () => {
    const { a, reloj, heroe } = preparado();
    const t = tirarHeroe(a, reloj, heroe);
    reloj.avanzar(4000);
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
    const desde = a.eventos.length;
    // Quedan 500 ms de pausa (más que el retardo normal de 100 ms).
    reloj.avanzar(t + PAUSA_RESULTADO_POR_DEFECTO_MS - 1 - reloj.t);
    expect(delBot(a, desde)).toBe(0);
    reloj.avanzar(1);
    expect(delBot(a, desde)).toBeGreaterThan(0);
  });

  it('si la pausa ya pasó, el bot actúa con su retardo normal', () => {
    const { a, reloj, heroe } = preparado();
    tirarHeroe(a, reloj, heroe);
    reloj.avanzar(10_000);
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
    const desde = a.eventos.length;
    reloj.avanzar(RETARDO - 1);
    expect(delBot(a, desde)).toBe(0);
    reloj.avanzar(1);
    expect(delBot(a, desde)).toBeGreaterThan(0);
  });

  it('sin evento de resultado, el bot actúa a los retardoBotMs de siempre', () => {
    const { a, reloj } = preparado({}, 'j2');
    reloj.avanzar(RETARDO - 1);
    expect(delBot(a, 0)).toBe(0);
    reloj.avanzar(1);
    expect(delBot(a, 0)).toBeGreaterThan(0);
  });

  it('con pausaResultadoMs: 0 no hay pausa', () => {
    const { a, reloj, heroe } = preparado({ pausaResultadoMs: 0 });
    tirarHeroe(a, reloj, heroe);
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
    const desde = a.eventos.length;
    reloj.avanzar(RETARDO);
    expect(delBot(a, desde)).toBeGreaterThan(0);
  });

  it('un Héroe jugado que entra en el Grupo también pausa a los bots', () => {
    const { a, reloj } = preparado();
    const mago = darCarta(a.estado, 'j1', 'heroe_mago');
    expect(a.enviar('j1', { tipo: 'JUGAR_CARTA', uid: mago })).toBeNull();
    // El bot pasa en la ventana de desafío (sin cartas de Desafío) y el Héroe entra.
    reloj.avanzar(RETARDO);
    expect(a.eventos.at(-1)).toMatchObject({ tipo: 'heroeEntra', jugador: 'j1' });
    const t = reloj.t;
    expect(a.enviar('j1', { tipo: 'TIRADA_INMEDIATA', tirar: false })).toBeNull();
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
    const desde = a.eventos.length;
    reloj.avanzar(t + PAUSA_RESULTADO_POR_DEFECTO_MS - 1 - reloj.t);
    expect(delBot(a, desde)).toBe(0);
    reloj.avanzar(1);
    expect(delBot(a, desde)).toBeGreaterThan(0);
  });
});
