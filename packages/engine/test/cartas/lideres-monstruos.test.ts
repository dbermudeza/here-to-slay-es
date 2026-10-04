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
  evento,
  forzarDados,
  hacer,
  heroe,
  jugadorDe,
  jugarMagia,
  mano,
  mesa,
  monstruo,
  motor,
  responder,
  sinPendientes,
  todosPasan,
  type R,
} from './reales';
import type { GameState } from '../../src';

/** A juega un Héroe de su mano y B lo DESAFÍA; devuelve el estado con la ventana de modificadores abierta. */
function desafioDeBAA(s: GameState, dados: number[]): R {
  const [h] = mano(s, A, 'heroe_peanut');
  const [d] = mano(s, B, 'desafio');
  let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h ?? '' });
  r = acumular(
    r,
    hacer(motor, forzarDados(r.state, ...dados), B, { tipo: 'DESAFIAR', uid: d ?? '' }),
  );
  return r;
}

describeReal('Líderes de Grupo', () => {
  it('lider_la_cancion_carismatica: +1 a tus tiradas para usar efectos de Héroe', () => {
    const r = activar(
      mesa({ [A]: 'lider_la_cancion_carismatica', [B]: 'lider_la_flecha_divina' }),
      'heroe_peanut',
      [3, 3],
    );
    expect(evento(r, 'tiradaFinal')[0]).toMatchObject({
      bonos: [{ carta: 'lider_la_cancion_carismatica', valor: 1 }],
      total: 7,
    });
    expect(evento(r, 'tiradaHeroe')[0]?.exito).toBe(true);
  });

  it('lider_el_sabio_encapuchado: cada vez que juegas una Magia, ROBAS', () => {
    const s = mesa({ [A]: 'lider_el_sabio_encapuchado', [C]: 'lider_la_flecha_divina' });
    const r = jugarMagia(s, 'magia_hechizo_encantado');
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });

  it('lider_la_flecha_divina: +1 a tus tiradas para ATACAR', () => {
    const s = mesa({ [A]: 'lider_la_flecha_divina' });
    heroe(s, A, 'heroe_peanut');
    // Aries Ártico solo pide un Héroe: se coloca en el centro.
    const objetivo = monstruo(s, B, 'monstruo_aries_artico');
    jugadorDe(s, B).monstruos = [];
    s.monstruosCentro.push(objetivo);
    let r = hacer(motor, forzarDados(s, 2, 3), A, { tipo: 'ATACAR', uid: objetivo });
    r = cerrarVentana(r.state);
    expect(evento(r, 'tiradaFinal')[0]?.bonos).toEqual([
      { carta: 'lider_la_flecha_divina', valor: 1 },
    ]);
  });

  it('lider_el_puno_de_la_razon: +2 cuando te desafían (D-33)', () => {
    const s = mesa({ [A]: 'lider_el_puno_de_la_razon' });
    let r = desafioDeBAA(s, [3, 3, 4, 4]);
    r = acumular(r, cerrarVentana(r.state));
    expect(evento(r, 'tiradaFinal')[0]).toMatchObject({
      jugador: A,
      total: 8,
      bonos: [{ carta: 'lider_el_puno_de_la_razon', valor: 2 }],
    });
    expect(evento(r, 'desafioResuelto')[0]?.ganador).toBe('desafiante');
  });

  it('lider_el_puno_de_la_razon: +2 a tus tiradas cuando DESAFÍAS', () => {
    const s = mesa({ [B]: 'lider_el_puno_de_la_razon', [A]: 'lider_la_flecha_divina' });
    let r = desafioDeBAA(s, [4, 4, 3, 3]);
    r = acumular(r, cerrarVentana(r.state));
    const finales = evento(r, 'tiradaFinal');
    expect(finales[0]).toMatchObject({ jugador: A, total: 8, bonos: [] });
    expect(finales[1]).toMatchObject({
      jugador: B,
      total: 8,
      bonos: [{ carta: 'lider_el_puno_de_la_razon', valor: 2 }],
    });
    expect(evento(r, 'desafioResuelto')[0]?.ganador).toBe('desafiante');
  });

  it('lider_el_cuerno_protector: al jugar un Modificador, +1 o −1 adicional a esa tirada', () => {
    const s = mesa({ [A]: 'lider_el_cuerno_protector' });
    const [mod] = mano(s, A, 'modificador_mas2_menos2');
    const x = heroe(s, A, 'heroe_peanut');
    let r = acumular(
      { state: s, events: [] },
      hacer(motor, forzarDados(s, 2, 2), A, { tipo: 'TIRAR_HEROE', uid: x }),
    );
    r = acumular(
      r,
      hacer(motor, r.state, A, { tipo: 'JUGAR_MODIFICADOR', uid: mod ?? '', valor: 2, tirada: 0 }),
    );
    expect(decision(r.state)).toMatchObject({
      motivo: 'bonoCuerno',
      pregunta: { tipo: 'valor', opciones: [1, -1] },
    });
    r = responder(r, A, { valor: 1 });
    expect(cima(r.state)?.tipo).toBe('ventanaModificadores');
    r = acumular(r, cerrarVentana(r.state));
    expect(evento(r, 'tiradaHeroe')[0]).toMatchObject({ total: 7, exito: true });
  });

  it('lider_la_garra_sombria: una vez por turno, 1 PA para SACAR una carta de otro jugador', () => {
    const s = mesa({ [A]: 'lider_la_garra_sombria' });
    const [desafio] = mano(s, B, 'desafio');
    const lider = jugadorDe(s, A).lider;
    let r = hacer(motor, s, A, { tipo: 'USAR_HABILIDAD', uid: lider });
    sinPendientes(r.state);
    expect(r.state.turno.pa).toBe(2);
    expect(jugadorDe(r.state, A).mano).toEqual([desafio]);
    const otra = motor.reducer(r.state, {
      actor: A,
      accion: { tipo: 'USAR_HABILIDAD', uid: lider },
    });
    expect(otra.ok ? null : otra.error.codigo).toBe('HABILIDAD_NO_DISPONIBLE');
    r = hacer(motor, r.state, A, { tipo: 'FIN_TURNO' });
    const ajena = motor.reducer(r.state, {
      actor: B,
      accion: { tipo: 'USAR_HABILIDAD', uid: lider },
    });
    expect(ajena.ok ? null : ajena.error.codigo).toBe('HABILIDAD_NO_DISPONIBLE');
  });
});

describeReal('Monstruos (habilidades al matarlos)', () => {
  it('monstruo_reina_del_abismo: +1 por cada Modificador que otro juega sobre tu tirada', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_reina_del_abismo');
    const [mod] = mano(s, B, 'modificador_mas2_menos2');
    const x = heroe(s, A, 'heroe_peanut');
    let r = hacer(motor, forzarDados(s, 4, 4), A, { tipo: 'TIRAR_HEROE', uid: x });
    r = hacer(motor, r.state, B, {
      tipo: 'JUGAR_MODIFICADOR',
      uid: mod ?? '',
      valor: -2,
      tirada: 0,
    });
    r = cerrarVentana(r.state);
    expect(evento(r, 'tiradaFinal')[0]).toMatchObject({ modificadores: -2, total: 7 });
    expect(evento(r, 'tiradaHeroe')[0]?.exito).toBe(true);
  });

  it('monstruo_caldero_anuro: +1 a todas tus tiradas', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_caldero_anuro');
    const r = activar(s, 'heroe_peanut', [3, 3]);
    expect(evento(r, 'tiradaFinal')[0]?.bonos).toEqual([
      { carta: 'monstruo_caldero_anuro', valor: 1 },
    ]);
  });

  it('monstruo_aries_artico: al superar una tirada de Héroe, puedes ROBAR', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_aries_artico');
    let r = activar(s, 'heroe_napping_nibbles');
    expect(decision(r.state)).toMatchObject({ jugador: A, motivo: 'confirmar' });
    r = responder(r, A, { si: true });
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });

  it('monstruo_alasangre: quien te DESAFÍA debe DESCARTAR una carta', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_alasangre');
    mano(s, B, 'modificador_mas4');
    const r = desafioDeBAA(s, [3, 3, 3, 3]);
    expect(jugadorDe(r.state, B).mano).toEqual([]);
    expect(cima(r.state)?.tipo).toBe('ventanaModificadores');
  });

  it('monstruo_dientes_de_sable_corrupto: puedes ARREBATAR en lugar de DESTRUIR', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_dientes_de_sable_corrupto');
    const x = heroe(s, B, 'heroe_peanut');
    let r = activar(s, 'heroe_bad_axe');
    expect(decision(r.state).motivo).toBe('arrebatarEnLugarDeDestruir');
    r = responder(r, A, { si: true });
    expect(jugadorDe(r.state, A).grupo.map((g) => g.heroe)).toContain(x);
    expect(r.state.descarte).not.toContain(x);
  });

  it('monstruo_serpiente_coronada: cada vez que alguien juega un Modificador, puedes ROBAR', () => {
    const s = mesa();
    monstruo(s, C, 'monstruo_serpiente_coronada');
    const [mod] = mano(s, B, 'modificador_mas4');
    const x = heroe(s, A, 'heroe_peanut');
    let r = acumular(
      { state: s, events: [] },
      hacer(motor, forzarDados(s, 3, 3), A, { tipo: 'TIRAR_HEROE', uid: x }),
    );
    r = acumular(
      r,
      hacer(motor, r.state, B, { tipo: 'JUGAR_MODIFICADOR', uid: mod ?? '', valor: 4, tirada: 0 }),
    );
    r = responder(r, C, { si: true });
    expect(jugadorDe(r.state, C).mano).toHaveLength(1);
    // Al terminar el disparador, la ventana sigue abierta con la cuenta reiniciada.
    expect(cima(r.state)?.tipo).toBe('ventanaModificadores');
    expect(evento(r, 'ventanaReiniciada').length).toBeGreaterThanOrEqual(2);
  });

  it('monstruo_rey_dragon_oscuro: +1 a tus tiradas de efecto de Héroe', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_rey_dragon_oscuro');
    const r = activar(s, 'heroe_peanut', [3, 3]);
    expect(evento(r, 'tiradaHeroe')[0]).toMatchObject({ total: 7, exito: true });
  });

  it('monstruo_dracos: cada vez que destruyen un Héroe de tu Grupo, puedes ROBAR', () => {
    const s = mesa({}, 'dracos');
    monstruo(s, B, 'monstruo_dracos');
    heroe(s, B, 'heroe_peanut');
    let r = activar(s, 'heroe_bad_axe');
    expect(decision(r.state)).toMatchObject({ jugador: B, motivo: 'confirmar' });
    r = responder(r, B, { si: true });
    expect(jugadorDe(r.state, B).mano).toHaveLength(1);
  });

  it('monstruo_malamamut: cada vez que ROBAS un Objeto, puedes jugarlo inmediatamente', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_malamamut');
    const h = heroe(s, A, 'heroe_peanut');
    const [anillo] = arriba(s, 'objeto_anillo_realmente_grande');
    let r = acumular({ state: s, events: [] }, hacer(motor, s, A, { tipo: 'ROBAR' }));
    r = responder(r, A, { cartas: [anillo ?? ''] });
    r = acumular(r, todosPasan(motor, r.state));
    expect(jugadorDe(r.state, A).grupo).toEqual([{ heroe: h, objeto: anillo }]);
    expect(r.state.turno.pa).toBe(2);
  });

  it('monstruo_megababosa: un PA extra en cada uno de tus turnos', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_megababosa');
    let r = hacer(motor, s, A, { tipo: 'FIN_TURNO' });
    expect(r.state.turno.pa).toBe(3);
    r = hacer(motor, r.state, B, { tipo: 'FIN_TURNO' });
    r = hacer(motor, r.state, C, { tipo: 'FIN_TURNO' });
    expect(r.state.turno).toMatchObject({ jugador: A, pa: 4 });
  });

  it('monstruo_megababosa: matarla no da el PA extra hasta el turno siguiente (D-36)', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut');
    heroe(s, A, 'heroe_mellow_dee');
    heroe(s, A, 'heroe_wily_red');
    heroe(s, A, 'heroe_napping_nibbles');
    const babosa = monstruo(s, B, 'monstruo_megababosa');
    jugadorDe(s, B).monstruos = [];
    s.monstruosCentro.push(babosa);
    let r = hacer(motor, forzarDados(s, 6, 6), A, { tipo: 'ATACAR', uid: babosa });
    r = acumular(r, cerrarVentana(r.state));
    expect(jugadorDe(r.state, A).monstruos).toContain(babosa);
    expect(r.state.turno).toMatchObject({ jugador: A, pa: 1 });
    r = acumular(r, hacer(motor, r.state, A, { tipo: 'FIN_TURNO' }));
    r = acumular(r, hacer(motor, r.state, B, { tipo: 'FIN_TURNO' }));
    r = acumular(r, hacer(motor, r.state, C, { tipo: 'FIN_TURNO' }));
    expect(r.state.turno).toMatchObject({ jugador: A, pa: 4 });
  });

  it('monstruo_orthus: cada vez que ROBAS una Magia, puedes jugarla inmediatamente', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_orthus');
    const [magia] = arriba(s, 'magia_hechizo_encantado');
    let r = acumular({ state: s, events: [] }, hacer(motor, s, A, { tipo: 'ROBAR' }));
    r = responder(r, A, { cartas: [magia ?? ''] });
    r = acumular(r, todosPasan(motor, r.state));
    expect(r.state.temporales).toMatchObject([{ jugador: A, valor: 2 }]);
  });

  it('monstruo_rex_mayor: al ROBAR un Modificador, puedes revelarlo y ROBAR otra', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_rex_mayor');
    arriba(s, 'modificador_mas4', 'heroe_peanut');
    let r = acumular({ state: s, events: [] }, hacer(motor, s, A, { tipo: 'ROBAR' }));
    r = responder(r, A, { si: true });
    expect(evento(r, 'cartaRevelada')).toEqual([
      { tipo: 'cartaRevelada', jugador: A, carta: 'modificador_mas4' },
    ]);
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
  });

  it('monstruo_terratuga: tus Héroes no pueden ser destruidos', () => {
    const s = mesa();
    monstruo(s, B, 'monstruo_terratuga');
    heroe(s, B, 'heroe_peanut');
    const r = activar(s, 'heroe_bad_axe');
    expect(evento(r, 'sinObjetivos')).toHaveLength(1);
    expect(jugadorDe(r.state, B).grupo).toHaveLength(1);
  });

  it('monstruo_guiverno_titan: +1 a tus tiradas en un desafío', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_guiverno_titan');
    let r = desafioDeBAA(s, [3, 3, 3, 3]);
    r = acumular(r, cerrarVentana(r.state));
    expect(evento(r, 'tiradaFinal')[0]).toMatchObject({ jugador: A, total: 7 });
    expect(evento(r, 'desafioResuelto')[0]?.ganador).toBe('desafiado');
  });

  it('monstruo_osolechuza_veterano: los Objetos que juegas no pueden ser desafiados', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_osolechuza_veterano');
    const h = heroe(s, A, 'heroe_peanut');
    const [anillo] = mano(s, A, 'objeto_anillo_realmente_grande');
    const r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: anillo ?? '', objetivo: h });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).grupo).toEqual([{ heroe: h, objeto: anillo }]);
  });
});
