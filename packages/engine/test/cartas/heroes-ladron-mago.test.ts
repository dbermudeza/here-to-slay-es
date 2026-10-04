import { expect, it } from 'vitest';
import {
  A,
  acumular,
  activar,
  arriba,
  B,
  C,
  cerrarVentana,
  cima,
  decision,
  describeReal,
  descarte,
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
} from './reales';

describeReal('Héroes Ladrones', () => {
  it('heroe_kit_napper: ARREBATA un Héroe elegido', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    heroe(s, C, 'heroe_mellow_dee');
    let r = activar(s, 'heroe_kit_napper');
    r = responder(r, A, { cartas: [x] });
    expect(jugadorDe(r.state, A).grupo.map((g) => g.heroe)).toContain(x);
    expect(jugadorDe(r.state, B).grupo).toEqual([]);
  });

  it('heroe_kit_napper: el Héroe arrebatado conserva su Objeto', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut', 'objeto_anillo_realmente_grande');
    const r = activar(s, 'heroe_kit_napper');
    const ranura = jugadorDe(r.state, A).grupo.find((g) => g.heroe === x);
    expect(r.state.instancias[ranura?.objeto ?? '']).toBe('objeto_anillo_realmente_grande');
  });

  it('heroe_meowzio: del jugador elegido, ARREBATA un Héroe y SACA una carta', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    const [desafio] = mano(s, B, 'desafio');
    heroe(s, C, 'heroe_mellow_dee');
    let r = activar(s, 'heroe_meowzio');
    r = responder(r, A, { jugador: B });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).grupo.map((g) => g.heroe)).toContain(x);
    expect(jugadorDe(r.state, A).mano).toEqual([desafio]);
  });

  it('heroe_plundering_puma: SACA 2 cartas; ese jugador puede ROBAR una', () => {
    const s = mesa();
    mano(s, B, 'desafio', 'desafio', 'modificador_mas4');
    let r = activar(s, 'heroe_plundering_puma');
    expect(decision(r.state).pregunta).toEqual({ tipo: 'oculta', de: B, cartas: 3 });
    r = responder(r, A, { indice: 0 });
    expect(decision(r.state).pregunta).toEqual({ tipo: 'oculta', de: B, cartas: 2 });
    r = responder(r, A, { indice: 1 });
    expect(decision(r.state)).toMatchObject({ jugador: B, motivo: 'robar' });
    r = responder(r, B, { si: true });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
    expect(jugadorDe(r.state, B).mano).toHaveLength(2);
  });

  it('heroe_shurikitty: DESTRUYE un Héroe y te quedas con su Objeto', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut', 'objeto_anillo_realmente_grande');
    const r = activar(s, 'heroe_shurikitty');
    expect(r.state.descarte).toContain(x);
    expect(idsDe(r.state, jugadorDe(r.state, A).mano)).toEqual(['objeto_anillo_realmente_grande']);
  });

  it('heroe_silent_shadow: mira la mano de otro jugador y elige una carta', () => {
    const s = mesa();
    const [desafio, mod] = mano(s, B, 'desafio', 'modificador_mas4');
    let r = activar(s, 'heroe_silent_shadow');
    expect(decision(r.state)).toMatchObject({
      motivo: 'tomarDeMano',
      pregunta: { opciones: [desafio, mod] },
    });
    r = responder(r, A, { cartas: [mod ?? ''] });
    expect(jugadorDe(r.state, A).mano).toEqual([mod]);
    expect(jugadorDe(r.state, B).mano).toEqual([desafio]);
  });

  it('heroe_slippery_paws: SACA 2 cartas y DESCARTA una de ellas', () => {
    const s = mesa();
    mano(s, A, 'heroe_peanut');
    mano(s, B, 'desafio', 'modificador_mas4', 'magia_impulso_critico');
    let r = activar(s, 'heroe_slippery_paws');
    r = responder(r, A, { indice: 0 });
    r = responder(r, A, { indice: 0 });
    const opciones = decision(r.state).pregunta;
    expect(opciones).toMatchObject({ tipo: 'cartas', min: 1, max: 1 });
    // Solo puede descartar una de las dos sacadas, no su propia carta.
    const sacadas = jugadorDe(r.state, A).mano.filter(
      (u) => r.state.instancias[u] !== 'heroe_peanut',
    );
    expect(opciones.tipo === 'cartas' ? [...opciones.opciones].sort() : []).toEqual(
      [...sacadas].sort(),
    );
    r = responder(r, A, { cartas: [sacadas[0] ?? ''] });
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
  });

  it('heroe_sly_pickings: SACA una carta y, si es un Objeto, puede jugarlo', () => {
    const s = mesa();
    const [anillo] = mano(s, B, 'objeto_anillo_realmente_grande');
    let r = activar(s, 'heroe_sly_pickings');
    r = responder(r, A, { cartas: [anillo ?? ''] });
    r = acumular(r, todosPasan(motor, r.state));
    expect(jugadorDe(r.state, A).grupo[0]?.objeto).toBe(anillo);
  });

  it('heroe_smooth_mimimeow: SACA una carta de cada rival con un Ladrón en su Grupo', () => {
    const s = mesa();
    heroe(s, B, 'heroe_kit_napper');
    const [desafio] = mano(s, B, 'desafio');
    mano(s, C, 'modificador_mas4');
    const r = activar(s, 'heroe_smooth_mimimeow');
    expect(jugadorDe(r.state, A).mano).toEqual([desafio]);
    expect(jugadorDe(r.state, C).mano).toHaveLength(1);
  });
});

describeReal('Héroes Magos', () => {
  it('heroe_bun_bun: busca una Magia en la pila de descarte', () => {
    const s = mesa();
    const [magia] = descarte(s, 'magia_impulso_critico', 'heroe_peanut');
    expect(jugadorDe(activar(s, 'heroe_bun_bun').state, A).mano).toEqual([magia]);
  });

  it('heroe_buttons: SACA una carta y, si es una Magia, puede jugarla', () => {
    const s = mesa();
    const [magia] = mano(s, B, 'magia_hechizo_encantado');
    let r = activar(s, 'heroe_buttons');
    r = responder(r, A, { cartas: [magia ?? ''] });
    r = acumular(r, todosPasan(motor, r.state));
    sinPendientes(r.state);
    expect(r.state.temporales).toMatchObject([{ jugador: A, tipo: 'bonoTirada', valor: 2 }]);
  });

  it('heroe_fluffy: DESTRUYE 2 Héroes', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    const y = heroe(s, C, 'heroe_mellow_dee');
    let r = activar(s, 'heroe_fluffy');
    r = responder(r, A, { cartas: [x] });
    sinPendientes(r.state);
    expect(r.state.descarte).toEqual(expect.arrayContaining([x, y]));
  });

  it('heroe_hopper: el jugador elegido SACRIFICA un Héroe (lo elige él)', () => {
    const s = mesa();
    heroe(s, B, 'heroe_peanut');
    const y = heroe(s, B, 'heroe_mellow_dee');
    let r = activar(s, 'heroe_hopper');
    r = responder(r, A, { jugador: B });
    expect(decision(r.state)).toMatchObject({ jugador: B, motivo: 'sacrificar' });
    r = responder(r, B, { cartas: [y] });
    expect(jugadorDe(r.state, B).grupo).toHaveLength(1);
    expect(evento(r, 'heroeSacrificado')).toHaveLength(1);
  });

  it('heroe_snowball: ROBA; si es Magia puede jugarla y entonces ROBA otra', () => {
    const s = mesa();
    const [magia, peanut] = arriba(s, 'magia_hechizo_encantado', 'heroe_peanut');
    let r = activar(s, 'heroe_snowball');
    r = responder(r, A, { cartas: [magia ?? ''] });
    r = acumular(r, todosPasan(motor, r.state));
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toEqual([peanut]);
    expect(r.state.descarte).toContain(magia);
  });

  it('heroe_snowball: si no juega la Magia, no roba la segunda', () => {
    const s = mesa();
    const [magia] = arriba(s, 'magia_hechizo_encantado', 'heroe_peanut');
    let r = activar(s, 'heroe_snowball');
    r = responder(r, A, { cartas: [] });
    expect(jugadorDe(r.state, A).mano).toEqual([magia]);
  });

  it('heroe_spooky: cada rival SACRIFICA un Héroe', () => {
    const s = mesa();
    heroe(s, B, 'heroe_peanut');
    const y = heroe(s, C, 'heroe_mellow_dee');
    heroe(s, C, 'heroe_wily_red');
    let r = activar(s, 'heroe_spooky');
    r = responder(r, C, { cartas: [y] });
    expect(jugadorDe(r.state, B).grupo).toEqual([]);
    expect(jugadorDe(r.state, C).grupo).toHaveLength(1);
  });

  it('heroe_whiskers: ARREBATA un Héroe y DESTRUYE otro', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    const y = heroe(s, C, 'heroe_mellow_dee');
    let r = activar(s, 'heroe_whiskers');
    r = responder(r, A, { cartas: [x] });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).grupo.map((g) => g.heroe)).toContain(x);
    expect(r.state.descarte).toContain(y);
  });

  it('heroe_wiggles: ARREBATA un Héroe y tira para usar su efecto inmediatamente', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    // 6+6 para Wiggles y 6+6 para Peanut.
    let r = activar(s, 'heroe_wiggles', [6, 6, 6, 6]);
    expect(cima(r.state)).toMatchObject({
      tipo: 'ventanaModificadores',
      contexto: { tipo: 'heroe', heroe: x },
    });
    expect(r.state.turno.pa).toBe(2);
    r = acumular(r, cerrarVentana(r.state));
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
    expect(r.state.turno.heroesUsados).toContain(x);
  });
});
