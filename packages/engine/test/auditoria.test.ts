/**
 * Auditoría carta a carta (informe de QA). Pruebas con el catálogo real sobre elecciones que se
 * resuelven solas y sobre la información que el jugador debe ver (D-40 y su excepción para
 * Silent Shadow).
 */
import { expect, it } from 'vitest';
import {
  A,
  activar,
  arriba,
  B,
  C,
  cima,
  decision,
  descarte,
  heroe,
  jugarMagia,
  describeReal,
  jugadorDe,
  mano,
  mesa,
  motor,
  responder,
} from './cartas/reales';

describeReal('Auditoría: elecciones automáticas e información visible', () => {
  // --- Silent Shadow (ve la mano de un rival y se queda una carta elegida) ---

  it('heroe_silent_shadow [FALLO 1]: con 1 sola carta en la mano rival, el jugador debe verla antes de quedársela', () => {
    const s = mesa();
    const [x] = mano(s, B, 'desafio'); // B tiene una única carta
    let r = activar(s, 'heroe_silent_shadow');
    expect(cima(r.state)?.tipo).toBe('decision');
    expect(decision(r.state)).toMatchObject({
      jugador: A,
      motivo: 'tomarDeMano',
      pregunta: { tipo: 'cartas', opciones: [x], min: 1, max: 1 },
    });
    // Solo quien mira ve la carta.
    expect(motor.getPlayerView(r.state, A).cartas[x ?? '']).toBe('desafio');
    expect(motor.getPlayerView(r.state, C).cartas[x ?? '']).toBeUndefined();
    r = responder(r, A, { cartas: [x ?? ''] });
    expect(jugadorDe(r.state, A).mano).toContain(x);
    expect(jugadorDe(r.state, B).mano).toEqual([]);
  });

  it('heroe_silent_shadow [FALLO 1b]: con un único rival con mano y 1 carta también se muestra la mano', () => {
    const s = mesa();
    // C no tiene cartas: B es el único rival posible.
    mano(s, B, 'modificador_mas4');
    const r = activar(s, 'heroe_silent_shadow');
    expect(cima(r.state)?.tipo).toBe('decision');
    expect(decision(r.state)).toMatchObject({ jugador: A, motivo: 'tomarDeMano' });
  });

  it('heroe_silent_shadow: con 2+ cartas pregunta y solo A ve la mano de B', () => {
    const s = mesa();
    const [x, y] = mano(s, B, 'desafio', 'modificador_mas4');
    const r = activar(s, 'heroe_silent_shadow');
    expect(decision(r.state)).toMatchObject({ jugador: A, motivo: 'tomarDeMano' });
    const vistaA = motor.getPlayerView(r.state, A);
    expect(vistaA.cartas[x ?? '']).toBe('desafio');
    expect(vistaA.cartas[y ?? '']).toBe('modificador_mas4');
    const vistaC = motor.getPlayerView(r.state, C);
    expect(vistaC.cartas[x ?? '']).toBeUndefined();
    expect(vistaC.cartas[y ?? '']).toBeUndefined();
  });

  it('heroe_silent_shadow: con varios rivales con mano, A elige el jugador (no se elige solo)', () => {
    const s = mesa();
    mano(s, B, 'desafio', 'modificador_mas4');
    mano(s, C, 'desafio', 'modificador_mas4');
    const r = activar(s, 'heroe_silent_shadow');
    expect(decision(r.state)).toMatchObject({ jugador: A, motivo: 'elegirJugador' });
  });

  // --- Sharp Fox (solo ve la mano de un rival) ---

  it('heroe_sharp_fox: con 1 carta en la mano rival sí se muestra (pregunta "ver")', () => {
    const s = mesa();
    const [x] = mano(s, B, 'desafio');
    mano(s, C, 'desafio');
    let r = activar(s, 'heroe_sharp_fox');
    r = responder(r, A, { jugador: B });
    expect(decision(r.state).pregunta).toMatchObject({ tipo: 'ver', cartas: [x], de: B });
    expect(motor.getPlayerView(r.state, A).cartas[x ?? '']).toBe('desafio');
  });

  it('heroe_sharp_fox: con un único rival con mano, se elige solo pero se muestra su mano', () => {
    const s = mesa();
    const [x] = mano(s, B, 'desafio');
    const r = activar(s, 'heroe_sharp_fox');
    expect(decision(r.state)).toMatchObject({
      motivo: 'verMano',
      pregunta: { tipo: 'ver', de: B },
    });
    expect(decision(r.state).pregunta).toMatchObject({ cartas: [x] });
  });

  it('heroe_sharp_fox: sin rivales con cartas no pasa nada (0 opciones)', () => {
    const r = activar(mesa(), 'heroe_sharp_fox');
    expect(r.state.pila).toEqual([]);
  });

  // --- Bullseye («Mira las 3 cartas superiores…») ---

  it('heroe_bullseye: pregunta siempre (incluso con 1 carta en el mazo) y solo A ve las cartas', () => {
    const s = mesa();
    const [x, y, z] = arriba(s, 'desafio', 'modificador_mas4', 'heroe_peanut');
    const r = activar(s, 'heroe_bullseye');
    expect(decision(r.state)).toMatchObject({
      jugador: A,
      motivo: 'elegirDelMazo',
      pregunta: { opciones: [x, y, z], min: 1, max: 1 },
    });
    expect(motor.getPlayerView(r.state, A).cartas[y ?? '']).toBe('modificador_mas4');
    expect(motor.getPlayerView(r.state, B).cartas[y ?? '']).toBeUndefined();
  });

  // --- Búsquedas en el descarte (público): elección forzosa automática (D-40) ---

  it('heroe_guiding_light: con un único Héroe en el descarte se lo queda sin preguntar (D-40)', () => {
    const s = mesa();
    const [h] = descarte(s, 'heroe_peanut');
    const r = activar(s, 'heroe_guiding_light');
    expect(jugadorDe(r.state, A).mano).toEqual([h]);
    expect(r.state.pila).toEqual([]);
  });

  // --- Intercambio Forzado: lectura literal (ver informe, duda propuesta D-44) ---

  it('magia_intercambio_forzado: si A no tiene más Héroes, el recién arrebatado vuelve solo a su dueño (efecto nulo)', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    heroe(s, B, 'heroe_mellow_dee');
    heroe(s, C, 'heroe_wily_red');
    let r = jugarMagia(s, 'magia_intercambio_forzado');
    r = responder(r, A, { jugador: B });
    r = responder(r, A, { cartas: [x] });
    expect(r.state.pila).toEqual([]);
    expect(jugadorDe(r.state, A).grupo).toEqual([]);
    expect(jugadorDe(r.state, B).grupo).toHaveLength(2);
  });
});
