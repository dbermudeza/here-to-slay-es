import { expect, it } from 'vitest';
import {
  A,
  activar,
  arriba,
  B,
  C,
  cima,
  decision,
  describeReal,
  evento,
  heroe,
  idsDe,
  jugadorDe,
  mano,
  mesa,
  motor,
  responder,
  sinPendientes,
  todosPasan,
  acumular,
} from './reales';

describeReal('Héroes Luchadores', () => {
  it('heroe_bad_axe: DESTRUYE un Héroe elegido', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    heroe(s, C, 'heroe_mellow_dee');
    let r = activar(s, 'heroe_bad_axe');
    expect(decision(r.state)).toMatchObject({ jugador: A, motivo: 'destruir' });
    r = responder(r, A, { cartas: [x] });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, B).grupo).toEqual([]);
    expect(r.state.descarte).toContain(x);
    expect(jugadorDe(r.state, C).grupo).toHaveLength(1);
  });

  it('heroe_bad_axe: sin Héroes rivales no hace nada', () => {
    const r = activar(mesa(), 'heroe_bad_axe');
    sinPendientes(r.state);
    expect(evento(r, 'sinObjetivos')).toHaveLength(1);
  });

  it('heroe_bear_claw: SACA una carta; si es un Héroe, SACA otra del mismo jugador', () => {
    const s = mesa();
    mano(s, B, 'heroe_peanut', 'heroe_mellow_dee');
    let r = activar(s, 'heroe_bear_claw');
    expect(decision(r.state).pregunta).toEqual({ tipo: 'oculta', de: B, cartas: 2 });
    r = responder(r, A, { indice: 0 });
    sinPendientes(r.state);
    expect(idsDe(r.state, jugadorDe(r.state, A).mano)).toEqual([
      'heroe_mellow_dee',
      'heroe_peanut',
    ]);
  });

  it('heroe_bear_claw: si la carta no es un Héroe, no saca otra', () => {
    const s = mesa();
    mano(s, B, 'desafio', 'desafio');
    let r = activar(s, 'heroe_bear_claw');
    r = responder(r, A, { indice: 1 });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
    expect(jugadorDe(r.state, B).mano).toHaveLength(1);
  });

  it('heroe_beary_wise: cada rival DESCARTA una carta y tú te quedas con una de ellas', () => {
    const s = mesa();
    const [desafio] = mano(s, B, 'desafio');
    const [mod] = mano(s, C, 'modificador_mas4', 'magia_impulso_critico');
    let r = activar(s, 'heroe_beary_wise');
    // B solo tiene una carta: la descarta sin elegir. C elige.
    expect(decision(r.state)).toMatchObject({ jugador: C, motivo: 'descartar' });
    r = responder(r, C, { cartas: [mod ?? ''] });
    expect(decision(r.state).pregunta).toMatchObject({ tipo: 'cartas', opciones: [desafio, mod] });
    r = responder(r, A, { cartas: [desafio ?? ''] });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toEqual([desafio]);
    expect(r.state.descarte).toContain(mod);
  });

  it('heroe_fury_knuckle: SACA una carta; si es un Desafío, SACA otra', () => {
    const s = mesa();
    mano(s, B, 'desafio', 'desafio');
    let r = activar(s, 'heroe_fury_knuckle');
    r = responder(r, A, { indice: 0 });
    sinPendientes(r.state);
    expect(idsDe(r.state, jugadorDe(r.state, A).mano)).toEqual(['desafio', 'desafio']);
  });

  it('heroe_heavy_bear: el jugador elegido DESCARTA 2 cartas', () => {
    const s = mesa();
    const cartasB = mano(s, B, 'desafio', 'modificador_mas4', 'heroe_peanut');
    let r = activar(s, 'heroe_heavy_bear');
    expect(decision(r.state).pregunta).toEqual({ tipo: 'jugador', opciones: [B, C] });
    r = responder(r, A, { jugador: B });
    expect(decision(r.state)).toMatchObject({ jugador: B, pregunta: { min: 2, max: 2 } });
    r = responder(r, B, { cartas: [cartasB[0] ?? '', cartasB[2] ?? ''] });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, B).mano).toEqual([cartasB[1]]);
  });

  it('heroe_pan_chucks: ROBA 2; si hay un Desafío, puede revelarlo y DESTRUIR un Héroe', () => {
    const s = mesa();
    arriba(s, 'desafio', 'heroe_peanut');
    const x = heroe(s, B, 'heroe_mellow_dee');
    let r = activar(s, 'heroe_pan_chucks');
    expect(decision(r.state).pregunta).toEqual({ tipo: 'confirmar' });
    r = responder(r, A, { si: true });
    sinPendientes(r.state);
    expect(evento(r, 'cartaRevelada')).toEqual([
      { tipo: 'cartaRevelada', jugador: A, carta: 'desafio' },
    ]);
    expect(r.state.descarte).toContain(x);
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
  });

  it('heroe_pan_chucks: sin Desafío entre las robadas no pregunta nada', () => {
    const s = mesa();
    arriba(s, 'heroe_peanut', 'modificador_mas4');
    heroe(s, B, 'heroe_mellow_dee');
    const r = activar(s, 'heroe_pan_chucks');
    sinPendientes(r.state);
    expect(jugadorDe(r.state, B).grupo).toHaveLength(1);
  });

  it('heroe_qi_bear: DESCARTA hasta 3 cartas y DESTRUYE un Héroe por cada una', () => {
    const s = mesa();
    const cartasA = mano(s, A, 'desafio', 'desafio', 'modificador_mas4');
    const x = heroe(s, B, 'heroe_peanut');
    heroe(s, B, 'heroe_mellow_dee');
    const z = heroe(s, C, 'heroe_wily_red');
    let r = activar(s, 'heroe_qi_bear');
    expect(decision(r.state).pregunta).toMatchObject({ min: 0, max: 3 });
    r = responder(r, A, { cartas: [cartasA[0] ?? '', cartasA[1] ?? ''] });
    r = responder(r, A, { cartas: [x] });
    r = responder(r, A, { cartas: [z] });
    sinPendientes(r.state);
    expect(evento(r, 'heroeDestruido')).toHaveLength(2);
    expect(jugadorDe(r.state, B).grupo).toHaveLength(1);
  });

  it('heroe_qi_bear: si no descarta nada, no destruye nada', () => {
    const s = mesa();
    mano(s, A, 'desafio');
    heroe(s, B, 'heroe_peanut');
    let r = activar(s, 'heroe_qi_bear');
    r = responder(r, A, { cartas: [] });
    sinPendientes(r.state);
    expect(evento(r, 'heroeDestruido')).toEqual([]);
  });

  it('heroe_tough_teddy: cada rival con un Luchador en su Grupo DESCARTA una carta', () => {
    const s = mesa();
    heroe(s, B, 'heroe_bad_axe');
    mano(s, B, 'desafio');
    mano(s, C, 'desafio');
    const r = activar(s, 'heroe_tough_teddy');
    sinPendientes(r.state);
    expect(jugadorDe(r.state, B).mano).toEqual([]);
    expect(jugadorDe(r.state, C).mano).toHaveLength(1);
  });
});

describeReal('Héroes Bardos', () => {
  it('heroe_dodgy_dealer: intercambia la mano con otro jugador', () => {
    const s = mesa();
    const manoA = mano(s, A, 'desafio');
    const manoB = mano(s, B, 'heroe_peanut', 'modificador_mas4');
    let r = activar(s, 'heroe_dodgy_dealer');
    r = responder(r, A, { jugador: B });
    expect(jugadorDe(r.state, A).mano).toEqual(manoB);
    expect(jugadorDe(r.state, B).mano).toEqual(manoA);
  });

  it('heroe_fuzzy_cheeks: ROBA y puede jugar inmediatamente un Héroe de la mano (sin PA)', () => {
    const s = mesa();
    const [peanut] = arriba(s, 'heroe_peanut');
    let r = activar(s, 'heroe_fuzzy_cheeks');
    expect(decision(r.state)).toMatchObject({
      motivo: 'jugarInmediato',
      pregunta: { min: 0, max: 1 },
    });
    r = responder(r, A, { cartas: [peanut ?? ''] });
    expect(cima(r.state)?.tipo).toBe('ventanaDesafio');
    r = acumular(r, todosPasan(motor, r.state));
    expect(jugadorDe(r.state, A).grupo.map((x) => x.heroe)).toContain(peanut);
    expect(cima(r.state)).toMatchObject({ tipo: 'tiradaInmediata', heroe: peanut });
    expect(r.state.turno.pa).toBe(2);
  });

  it('heroe_fuzzy_cheeks: jugar el Héroe es opcional', () => {
    const s = mesa();
    arriba(s, 'heroe_peanut');
    let r = activar(s, 'heroe_fuzzy_cheeks');
    r = responder(r, A, { cartas: [] });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });

  it('heroe_greedy_cheeks: cada rival te DA una carta de su mano, elegida por él', () => {
    const s = mesa();
    const [desafio] = mano(s, B, 'desafio');
    const [mod] = mano(s, C, 'modificador_mas4', 'magia_impulso_critico');
    let r = activar(s, 'heroe_greedy_cheeks');
    expect(decision(r.state)).toMatchObject({ jugador: C, motivo: 'dar' });
    r = responder(r, C, { cartas: [mod ?? ''] });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toEqual([desafio, mod]);
    expect(evento(r, 'cartaDada')).toHaveLength(2);
  });

  it('heroe_lucky_bucky: SACA una carta y, si es un Héroe, puede jugarlo inmediatamente', () => {
    const s = mesa();
    const [peanut] = mano(s, B, 'heroe_peanut');
    let r = activar(s, 'heroe_lucky_bucky');
    r = responder(r, A, { cartas: [peanut ?? ''] });
    r = acumular(r, todosPasan(motor, r.state));
    expect(jugadorDe(r.state, A).grupo.map((x) => x.heroe)).toContain(peanut);
  });

  it('heroe_mellow_dee: ROBA y, si es un Héroe, puede jugarlo (aquí decide no hacerlo)', () => {
    const s = mesa();
    const [peanut] = arriba(s, 'heroe_peanut');
    let r = activar(s, 'heroe_mellow_dee');
    expect(decision(r.state).pregunta).toMatchObject({ opciones: [peanut] });
    r = responder(r, A, { cartas: [] });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toEqual([peanut]);
  });

  it('heroe_mellow_dee: si la carta robada no es un Héroe, no pregunta', () => {
    const s = mesa();
    arriba(s, 'desafio');
    sinPendientes(activar(s, 'heroe_mellow_dee').state);
  });

  it('heroe_napping_nibbles: no hace nada', () => {
    const s = mesa();
    const r = activar(s, 'heroe_napping_nibbles', [1, 1]);
    sinPendientes(r.state);
    expect(evento(r, 'efectoActivado')).toHaveLength(1);
    expect(jugadorDe(r.state, A).mano).toEqual([]);
  });

  it('heroe_peanut: ROBA 2 cartas', () => {
    const r = activar(mesa(), 'heroe_peanut');
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
  });

  it('heroe_tipsy_tootie: ARREBATA un Héroe del jugador elegido y se va a su Grupo', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    const r = activar(s, 'heroe_tipsy_tootie');
    sinPendientes(r.state);
    expect(
      idsDe(
        r.state,
        jugadorDe(r.state, A).grupo.map((g) => g.heroe),
      ),
    ).toEqual(['heroe_peanut']);
    expect(
      idsDe(
        r.state,
        jugadorDe(r.state, B).grupo.map((g) => g.heroe),
      ),
    ).toEqual(['heroe_tipsy_tootie']);
    expect(jugadorDe(r.state, A).grupo[0]?.heroe).toBe(x);
  });
});
