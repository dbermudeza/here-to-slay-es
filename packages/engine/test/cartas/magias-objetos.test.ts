import type { Clase } from '@hts/cards';
import { expect, it } from 'vitest';
import { clasesDelGrupo } from '../../src';
import {
  A,
  activar,
  B,
  C,
  decision,
  describeReal,
  descarte,
  evento,
  hacer,
  heroe,
  idsDe,
  jugadorDe,
  jugarMagia,
  mano,
  mesa,
  motor,
  responder,
  sinPendientes,
} from './reales';

describeReal('Magias', () => {
  it('magia_llamada_a_los_caidos: busca un Héroe en la pila de descarte', () => {
    const s = mesa();
    const [peanut] = descarte(s, 'heroe_peanut');
    const r = jugarMagia(s, 'magia_llamada_a_los_caidos');
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toEqual([peanut]);
    expect(idsDe(r.state, r.state.descarte)).toEqual(['magia_llamada_a_los_caidos']);
  });

  it('magia_impulso_critico: ROBA 3 y DESCARTA 1', () => {
    let r = jugarMagia(mesa(), 'magia_impulso_critico');
    const [primera] = jugadorDe(r.state, A).mano;
    r = responder(r, A, { cartas: [primera ?? ''] });
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
  });

  it('magia_hechizo_destructivo: DESCARTA una carta y DESTRUYE un Héroe', () => {
    const s = mesa();
    const [desafio] = mano(s, A, 'desafio');
    const x = heroe(s, B, 'heroe_peanut');
    const r = jugarMagia(s, 'magia_hechizo_destructivo');
    sinPendientes(r.state);
    expect(r.state.descarte).toEqual(expect.arrayContaining([desafio, x]));
  });

  it('magia_hechizo_encantado: +2 a todas tus tiradas hasta el final del turno', () => {
    let r = jugarMagia(mesa(), 'magia_hechizo_encantado');
    expect(r.state.temporales).toEqual([
      {
        jugador: A,
        tipo: 'bonoTirada',
        valor: 2,
        expira: 'finTurno',
        carta: 'magia_hechizo_encantado',
      },
    ]);
    r = hacer(motor, r.state, A, { tipo: 'FIN_TURNO' });
    expect(r.state.temporales).toEqual([]);
  });

  it('magia_trampa_enredadora: DESCARTA 2 cartas y ARREBATA un Héroe', () => {
    const s = mesa();
    mano(s, A, 'desafio', 'desafio');
    const x = heroe(s, B, 'heroe_peanut');
    const r = jugarMagia(s, 'magia_trampa_enredadora');
    sinPendientes(r.state);
    expect(jugadorDe(r.state, A).mano).toEqual([]);
    expect(jugadorDe(r.state, A).grupo.map((g) => g.heroe)).toEqual([x]);
  });

  it('magia_intercambio_forzado: ARREBATA un Héroe del jugador elegido y le das uno tuyo', () => {
    const s = mesa();
    const propio = heroe(s, A, 'heroe_mellow_dee');
    const x = heroe(s, B, 'heroe_peanut');
    let r = jugarMagia(s, 'magia_intercambio_forzado');
    expect(decision(r.state)).toMatchObject({
      motivo: 'darHeroe',
      pregunta: { opciones: [propio, x] },
    });
    r = responder(r, A, { cartas: [propio] });
    expect(jugadorDe(r.state, A).grupo.map((g) => g.heroe)).toEqual([x]);
    expect(jugadorDe(r.state, B).grupo.map((g) => g.heroe)).toEqual([propio]);
  });

  it('magia_intercambio_forzado: puedes devolver el mismo Héroe que acabas de ARREBATAR (D-45)', () => {
    const s = mesa();
    const propio = heroe(s, A, 'heroe_mellow_dee');
    const x = heroe(s, B, 'heroe_peanut');
    let r = jugarMagia(s, 'magia_intercambio_forzado');
    r = responder(r, A, { cartas: [x] });
    expect(r.state.pila).toEqual([]);
    expect(jugadorDe(r.state, A).grupo.map((g) => g.heroe)).toEqual([propio]);
    expect(jugadorDe(r.state, B).grupo.map((g) => g.heroe)).toEqual([x]);
  });

  it('magia_vientos_huracanados: todos los Objetos equipados vuelven a la mano de su jugador', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut', 'objeto_anillo_realmente_grande');
    heroe(s, B, 'heroe_mellow_dee', 'objeto_maldito_llave_selladora');
    const r = jugarMagia(s, 'magia_vientos_huracanados');
    expect(idsDe(r.state, jugadorDe(r.state, A).mano)).toEqual(['objeto_anillo_realmente_grande']);
    expect(idsDe(r.state, jugadorDe(r.state, B).mano)).toEqual(['objeto_maldito_llave_selladora']);
    for (const j of r.state.jugadores) for (const g of j.grupo) expect(g.objeto).toBeNull();
  });

  it('magia_vientos_de_cambio: un Objeto equipado vuelve a la mano de su jugador y ROBAS', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut', 'objeto_anillo_realmente_grande');
    heroe(s, B, 'heroe_mellow_dee', 'objeto_maldito_llave_selladora');
    let r = jugarMagia(s, 'magia_vientos_de_cambio');
    const llave = jugadorDe(r.state, B).grupo[0]?.objeto ?? '';
    r = responder(r, A, { cartas: [llave] });
    expect(jugadorDe(r.state, B).mano).toEqual([llave]);
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });
});

describeReal('Objetos', () => {
  it.each<[string, Clase]>([
    ['objeto_mascara_de_bardo', 'bardo'],
    ['objeto_mascara_de_luchador', 'luchador'],
    ['objeto_mascara_de_guardian', 'guardian'],
    ['objeto_mascara_de_cazador', 'cazador'],
    ['objeto_mascara_de_ladron', 'ladron'],
    ['objeto_mascara_de_mago', 'mago'],
  ])('%s: el Héroe equipado se considera %s en lugar de su clase', (mascara, clase) => {
    const s = mesa({ [A]: 'lider_la_garra_sombria' });
    // Bad Axe es Luchador; Snowball es Mago.
    const original = clase === 'luchador' ? 'heroe_snowball' : 'heroe_bad_axe';
    heroe(s, A, original, mascara);
    const clases = [...clasesDelGrupo(motor.catalogo, s, jugadorDe(s, A))].sort();
    expect(clases).toEqual([...new Set(['ladron', clase])].sort());
  });

  it('objeto_muneco_senuelo: si el Héroe va a ser destruido, el Muñeco va al descarte en su lugar', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut', 'objeto_muneco_senuelo');
    const r = activar(s, 'heroe_bad_axe');
    expect(jugadorDe(r.state, B).grupo).toEqual([{ heroe: x, objeto: null }]);
    expect(idsDe(r.state, r.state.descarte)).toEqual(['objeto_muneco_senuelo']);
    expect(evento(r, 'senueloUsado')).toHaveLength(1);
  });

  it('objeto_muneco_senuelo: también protege del sacrificio', () => {
    const s = mesa();
    const x = heroe(s, B, 'heroe_peanut', 'objeto_muneco_senuelo');
    let r = activar(s, 'heroe_hopper');
    r = responder(r, A, { jugador: B });
    expect(jugadorDe(r.state, B).grupo).toEqual([{ heroe: x, objeto: null }]);
  });

  it('objeto_moneda_particularmente_oxidada: si fallas la tirada del Héroe equipado, ROBAS', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut', 'objeto_moneda_particularmente_oxidada');
    const r = activar(s, 'heroe_peanut', [1, 1]);
    expect(evento(r, 'tiradaHeroe')[0]?.exito).toBe(false);
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });

  it('objeto_anillo_realmente_grande: +2 a la tirada del Héroe equipado (no a otros)', () => {
    const s = mesa();
    heroe(s, A, 'heroe_wily_red', 'objeto_anillo_realmente_grande');
    heroe(s, A, 'heroe_peanut');
    const r = activar(s, 'heroe_wily_red', [4, 4]);
    expect(evento(r, 'tiradaFinal')[0]).toMatchObject({
      bonos: [{ carta: 'objeto_anillo_realmente_grande', valor: 2 }],
      total: 10,
    });
    expect(evento(r, 'tiradaHeroe')[0]?.exito).toBe(true);
    const otra = activar(r.state, 'heroe_peanut', [3, 3]);
    expect(evento(otra, 'tiradaFinal')[0]?.bonos).toEqual([]);
  });

  it('objeto_maldito_maldicion_de_los_ojos_de_serpiente: −2 a la tirada del Héroe equipado', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut', 'objeto_maldito_maldicion_de_los_ojos_de_serpiente');
    const r = activar(s, 'heroe_peanut', [4, 4]);
    expect(evento(r, 'tiradaHeroe')[0]).toMatchObject({ total: 6, exito: false });
  });

  it('objeto_maldito_llave_selladora: no se puede usar el efecto del Héroe equipado', () => {
    const s = mesa();
    const x = heroe(s, A, 'heroe_peanut', 'objeto_maldito_llave_selladora');
    const r = motor.reducer(s, { actor: A, accion: { tipo: 'TIRAR_HEROE', uid: x } });
    expect(r.ok ? null : r.error.codigo).toBe('HEROE_SELLADO');
    expect(motor.accionesLegales(s, A)).not.toContainEqual({ tipo: 'TIRAR_HEROE', uid: x });
  });

  it('objeto_maldito_moneda_sospechosamente_brillante: si superas la tirada del Héroe equipado, DESCARTAS', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut', 'objeto_maldito_moneda_sospechosamente_brillante');
    let r = activar(s, 'heroe_peanut');
    // Primero el efecto de Peanut (ROBA 2) y después la moneda (DESCARTA 1).
    expect(jugadorDe(r.state, A).mano).toHaveLength(2);
    r = responder(r, A, { cartas: [jugadorDe(r.state, A).mano[0] ?? ''] });
    expect(jugadorDe(r.state, A).mano).toHaveLength(1);
  });

  it('un Objeto Maldito se puede equipar al Héroe de un rival', () => {
    const s = mesa();
    const x = heroe(s, C, 'heroe_peanut');
    const [llave] = mano(s, A, 'objeto_maldito_llave_selladora');
    const r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: llave ?? '', objetivo: x });
    expect(r.state.pila[0]).toMatchObject({ tipo: 'ventanaDesafio' });
  });
});
