import { expect, it } from 'vitest';
import {
  A,
  acumular,
  activar,
  arriba,
  B,
  C,
  cima,
  decision,
  describeReal,
  descarte,
  evento,
  forzarDados,
  hacer,
  heroe,
  idsDe,
  jugadorDe,
  mano,
  mesa,
  motor,
  responder,
  sinPendientes,
  todosPasan,
  type R,
} from './reales';

/** Termina los turnos hasta que vuelve a tocarle a `jugador`. */
function hastaTurnoDe(r: R, jugador: string): R {
  let x = r;
  while (x.state.turno.jugador !== jugador) {
    x = acumular(x, hacer(motor, x.state, x.state.turno.jugador, { tipo: 'FIN_TURNO' }));
  }
  return x;
}

describeReal('Héroes Guardianes', () => {
  it('heroe_calming_voice: tus Héroes no pueden ser arrebatados hasta tu próximo turno', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut');
    let r = activar(s, 'heroe_calming_voice');
    expect(r.state.temporales).toEqual([
      {
        jugador: A,
        tipo: 'noArrebatable',
        valor: 0,
        expira: 'inicioTurnoPropio',
        carta: 'heroe_calming_voice',
      },
    ]);
    r = hastaTurnoDe(r, B);
    const intento = activar(r.state, 'heroe_kit_napper');
    expect(evento(intento, 'sinObjetivos')).toHaveLength(1);
    expect(jugadorDe(intento.state, A).grupo).toHaveLength(2);
    r = hastaTurnoDe(r, A);
    expect(r.state.temporales).toEqual([]);
  });

  it('heroe_guiding_light: busca un Héroe en la pila de descarte', () => {
    const s = mesa();
    const [peanut] = descarte(s, 'desafio', 'heroe_peanut').slice(1);
    const r = activar(s, 'heroe_guiding_light');
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toEqual([peanut]);
  });

  it('heroe_holy_curselifter: devuelve a tu mano un Objeto Maldito equipado a tu Héroe', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut', 'objeto_maldito_llave_selladora');
    const r = activar(s, 'heroe_holy_curselifter');
    expect(idsDe(r.state, jugadorDe(r.state, A).mano)).toEqual(['objeto_maldito_llave_selladora']);
    expect(jugadorDe(r.state, A).grupo.every((g) => g.objeto === null)).toBe(true);
  });

  it('heroe_iron_resolve: tus cartas no pueden ser desafiadas el resto del turno', () => {
    const s = mesa();
    const [peanut] = mano(s, A, 'heroe_peanut');
    let r = activar(s, 'heroe_iron_resolve');
    r = acumular(r, hacer(motor, r.state, A, { tipo: 'JUGAR_CARTA', uid: peanut ?? '' }));
    expect(evento(r, 'jugadaIndesafiable')).toHaveLength(1);
    expect(cima(r.state)?.tipo).toBe('tiradaInmediata');
    r = hacer(motor, r.state, A, { tipo: 'TIRADA_INMEDIATA', tirar: false });
    r = hastaTurnoDe(r, B);
    expect(r.state.temporales).toEqual([]);
  });

  it('heroe_mighty_blade: tus Héroes no pueden ser destruidos hasta tu próximo turno', () => {
    const s = mesa();
    let r = activar(s, 'heroe_mighty_blade');
    r = hastaTurnoDe(r, B);
    const intento = activar(r.state, 'heroe_bad_axe');
    expect(evento(intento, 'sinObjetivos')).toHaveLength(1);
    expect(jugadorDe(intento.state, A).grupo).toHaveLength(1);
  });

  it('heroe_radiant_horn: busca un Modificador en la pila de descarte', () => {
    const s = mesa();
    const [mod] = descarte(s, 'modificador_mas4', 'heroe_peanut');
    const r = activar(s, 'heroe_radiant_horn');
    expect(jugadorDe(r.state, A).mano).toEqual([mod]);
  });

  it.each([
    ['heroe_vibrant_glow', 5],
    ['heroe_wise_shield', 3],
  ])('%s: +%i a todas tus tiradas hasta el final del turno', (id, bono) => {
    const s = mesa();
    heroe(s, A, 'heroe_wily_red');
    let r = activar(s, id);
    const wily = jugadorDe(r.state, A).grupo.find(
      (g) => r.state.instancias[g.heroe] === 'heroe_wily_red',
    );
    r = hacer(motor, forzarDados(r.state, 2, 3), A, {
      tipo: 'TIRAR_HEROE',
      uid: wily?.heroe ?? '',
    });
    const v = cima(r.state);
    r = hacer(motor, r.state, '@sistema', {
      tipo: 'CERRAR_VENTANA',
      secuencia: v && 'secuencia' in v ? v.secuencia : 0,
    });
    expect(evento(r, 'tiradaFinal')[0]?.bonos).toEqual([{ carta: id, valor: bono }]);
    expect(evento(r, 'tiradaHeroe')[0]).toMatchObject({ total: 5 + bono, exito: 5 + bono >= 10 });
  });
});

describeReal('Héroes Cazadores', () => {
  it('heroe_bullseye: mira 3, se queda una y ordena las otras dos encima del mazo', () => {
    const s = mesa();
    const [peanut, desafio, mod] = arriba(s, 'heroe_peanut', 'desafio', 'modificador_mas4');
    let r = activar(s, 'heroe_bullseye');
    expect(decision(r.state)).toMatchObject({
      motivo: 'elegirDelMazo',
      pregunta: { opciones: [peanut, desafio, mod] },
    });
    r = responder(r, A, { cartas: [desafio ?? ''] });
    expect(decision(r.state)).toMatchObject({
      motivo: 'ordenarMazo',
      pregunta: { ordenado: true },
    });
    r = responder(r, A, { cartas: [mod ?? '', peanut ?? ''] });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toEqual([desafio]);
    expect(r.state.mazo.slice(0, 2)).toEqual([mod, peanut]);
  });

  it('heroe_hook: juega inmediatamente (obligatorio, D-41) un Objeto de tu mano y ROBA una carta', () => {
    const s = mesa();
    const [anillo] = mano(s, A, 'objeto_anillo_realmente_grande');
    const hook = heroe(s, A, 'heroe_hook');
    // Un solo Objeto y un solo Héroe sin Objeto: se juega sin preguntar (D-40).
    let r = activar(s, 'heroe_hook');
    expect(cima(r.state)?.tipo).toBe('ventanaDesafio');
    r = acumular(r, todosPasan(motor, r.state));
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).grupo).toEqual([{ heroe: hook, objeto: anillo }]);
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });

  it('heroe_hook: con varios Objetos hay que elegir uno, sin opción de no jugar', () => {
    const s = mesa();
    mano(s, A, 'objeto_anillo_realmente_grande', 'objeto_muneco_senuelo');
    const r = activar(s, 'heroe_hook');
    expect(decision(r.state).pregunta).toMatchObject({ min: 1, max: 1 });
  });

  it('heroe_hook: sin Objetos en la mano, solo ROBA', () => {
    const r = activar(mesa(), 'heroe_hook');
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });

  it('heroe_lookie_rookie: busca un Objeto (también Maldito) en la pila de descarte', () => {
    const s = mesa();
    const [llave] = descarte(s, 'objeto_maldito_llave_selladora', 'desafio');
    const r = activar(s, 'heroe_lookie_rookie');
    expect(jugadorDe(r.state, A).mano).toEqual([llave]);
  });

  it('heroe_quick_draw: ROBA 2 y puede jugar uno de los Objetos robados', () => {
    const s = mesa();
    const [anillo] = arriba(s, 'objeto_anillo_realmente_grande', 'heroe_peanut');
    let r = activar(s, 'heroe_quick_draw');
    r = responder(r, A, { cartas: [anillo ?? ''] });
    r = acumular(r, todosPasan(motor, r.state));
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).grupo[0]?.objeto).toBe(anillo);
    expect(idsDe(r.state, jugadorDe(r.state, A).mano)).toEqual(['heroe_peanut']);
  });

  it('heroe_serious_grey: DESTRUYE un Héroe y ROBA una carta', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut');
    const r = activar(s, 'heroe_serious_grey');
    expect(r.state.descarte).toContain(x);
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });

  it('heroe_sharp_fox: mira la mano de otro jugador (solo tú la ves)', () => {
    const s = mesa();
    const manoB = mano(s, B, 'desafio', 'modificador_mas4');
    let r = activar(s, 'heroe_sharp_fox');
    expect(decision(r.state).pregunta).toEqual({ tipo: 'ver', cartas: manoB, de: B });
    const vistaA = motor.getPlayerView(r.state, A);
    const vistaC = motor.getPlayerView(r.state, C);
    for (const u of manoB) {
      expect(vistaA.cartas[u]).toBeDefined();
      expect(vistaC.cartas[u]).toBeUndefined();
    }
    r = responder(r, A, { ok: true });
    sinPendientes(r.state);
    expect(jugadorDe(r.state, B).mano).toEqual(manoB);
  });

  it('heroe_wildshot: ROBA 3 y DESCARTA 1', () => {
    let r = activar(mesa(), 'heroe_wildshot');
    const [primera] = jugadorDe(r.state, A).mano;
    r = responder(r, A, { cartas: [primera ?? ''] });
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
    expect(r.state.descarte).toContain(primera);
  });

  it('heroe_wily_red: ROBA hasta tener 7 cartas', () => {
    const s = mesa();
    mano(s, A, 'desafio', 'desafio');
    const r = activar(s, 'heroe_wily_red');
    expect(jugadorDe(r.state, A).mano).toHaveLength(7);
  });
});
