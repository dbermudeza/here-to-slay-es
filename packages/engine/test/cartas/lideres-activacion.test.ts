/**
 * Evento `liderActivado`: se emite cada vez que la habilidad de un Líder actúa de verdad (R-082,
 * R-103): su bono se suma a una tirada, su disparador se ejecuta o se usa su habilidad. No se emite
 * para Monstruos ni Objetos, ni cuando la pasiva no aplica.
 */
import { expect, it } from 'vitest';
import {
  A,
  acumular,
  activar,
  B,
  C,
  cerrarVentana,
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
  type R,
} from './reales';
import { describirEvento, eventoParaJugador, type Evento, type GameState } from '../../src';

const tipos = (r: R): string[] => r.events.map((e) => e.tipo);

/** A juega un Héroe de su mano y B lo DESAFÍA; se cierra la ventana de modificadores. */
function desafioDeBAA(s: GameState, dados: number[]): R {
  const [h] = mano(s, A, 'heroe_peanut');
  const [d] = mano(s, B, 'desafio');
  let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h ?? '' });
  r = acumular(
    r,
    hacer(motor, forzarDados(r.state, ...dados), B, { tipo: 'DESAFIAR', uid: d ?? '' }),
  );
  return acumular(r, cerrarVentana(r.state));
}

/** A ataca a un Monstruo del centro que solo pide un Héroe y se cierra la ventana. */
function atacar(s: GameState, dados: [number, number]): R {
  heroe(s, A, 'heroe_peanut');
  const objetivo = monstruo(s, B, 'monstruo_aries_artico');
  jugadorDe(s, B).monstruos = [];
  s.monstruosCentro.push(objetivo);
  const r = hacer(motor, forzarDados(s, ...dados), A, { tipo: 'ATACAR', uid: objetivo });
  return acumular(r, cerrarVentana(r.state));
}

describeReal('liderActivado (R-082, R-103)', () => {
  it('R-104: el bono de La Canción Carismática se anuncia justo antes de su tiradaFinal', () => {
    const r = activar(
      mesa({ [A]: 'lider_la_cancion_carismatica', [B]: 'lider_la_flecha_divina' }),
      'heroe_peanut',
      [3, 3],
    );
    expect(evento(r, 'liderActivado')).toEqual([
      { tipo: 'liderActivado', jugador: A, carta: 'lider_la_cancion_carismatica' },
    ]);
    const t = tipos(r);
    expect(t.indexOf('tiradaFinal')).toBe(t.indexOf('liderActivado') + 1);
  });

  it('R-104: La Canción Carismática no se activa en una tirada de ataque', () => {
    const r = atacar(
      mesa({ [A]: 'lider_la_cancion_carismatica', [B]: 'lider_la_flecha_divina' }),
      [2, 3],
    );
    expect(evento(r, 'tiradaFinal')[0]?.bonos).toEqual([]);
    expect(evento(r, 'liderActivado')).toEqual([]);
  });

  it('R-104: La Flecha Divina se activa al ATACAR y no en una tirada de Héroe', () => {
    const r = atacar(mesa({ [A]: 'lider_la_flecha_divina' }), [2, 3]);
    expect(evento(r, 'liderActivado')).toEqual([
      { tipo: 'liderActivado', jugador: A, carta: 'lider_la_flecha_divina' },
    ]);
    const t = tipos(r);
    expect(t.indexOf('liderActivado')).toBeLessThan(t.indexOf('tiradaFinal'));
    const heroeR = activar(mesa({ [A]: 'lider_la_flecha_divina' }), 'heroe_peanut', [3, 3]);
    expect(evento(heroeR, 'liderActivado')).toEqual([]);
  });

  it('R-104 / D-33: El Puño de la Razón se activa al desafiar y al ser desafiado', () => {
    const desafiado = desafioDeBAA(mesa({ [A]: 'lider_el_puno_de_la_razon' }), [3, 3, 4, 4]);
    expect(evento(desafiado, 'liderActivado')).toEqual([
      { tipo: 'liderActivado', jugador: A, carta: 'lider_el_puno_de_la_razon' },
    ]);
    // Va antes de la tiradaFinal de A (la primera), no de la de B.
    const t = tipos(desafiado);
    expect(t.indexOf('tiradaFinal')).toBe(t.indexOf('liderActivado') + 1);

    const desafiante = desafioDeBAA(
      mesa({ [B]: 'lider_el_puno_de_la_razon', [A]: 'lider_la_flecha_divina' }),
      [4, 4, 3, 3],
    );
    expect(evento(desafiante, 'liderActivado')).toEqual([
      { tipo: 'liderActivado', jugador: B, carta: 'lider_el_puno_de_la_razon' },
    ]);
    const finales = desafiante.events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.tipo === 'tiradaFinal');
    const iLider = tipos(desafiante).indexOf('liderActivado');
    expect(iLider).toBe((finales[1]?.i ?? -1) - 1);
  });

  it('R-082: El Sabio Encapuchado se activa al jugar una Magia, tras disparadorActivado', () => {
    const r = jugarMagia(
      mesa({ [A]: 'lider_el_sabio_encapuchado', [C]: 'lider_la_flecha_divina' }),
      'magia_hechizo_encantado',
    );
    expect(evento(r, 'liderActivado')).toEqual([
      { tipo: 'liderActivado', jugador: A, carta: 'lider_el_sabio_encapuchado' },
    ]);
    const t = tipos(r);
    expect(t.indexOf('liderActivado')).toBe(t.indexOf('disparadorActivado') + 1);
  });

  it('R-082: El Sabio Encapuchado no se activa cuando otro juega la Magia', () => {
    // C tiene el Sabio por defecto; A juega la Magia.
    const r = jugarMagia(mesa({ [A]: 'lider_la_flecha_divina' }), 'magia_hechizo_encantado');
    expect(evento(r, 'liderActivado')).toEqual([]);
  });

  it('R-082: El Cuerno Protector se activa al jugar su dueño un Modificador, no otro', () => {
    const s = mesa({ [A]: 'lider_el_cuerno_protector' });
    const [propio] = mano(s, A, 'modificador_mas2_menos2');
    const [ajeno] = mano(s, B, 'modificador_mas4');
    const x = heroe(s, A, 'heroe_peanut');
    let r = hacer(motor, forzarDados(s, 2, 2), A, { tipo: 'TIRAR_HEROE', uid: x });
    r = acumular(
      r,
      hacer(motor, r.state, B, {
        tipo: 'JUGAR_MODIFICADOR',
        uid: ajeno ?? '',
        valor: 4,
        tirada: 0,
      }),
    );
    expect(evento(r, 'liderActivado')).toEqual([]);
    r = acumular(
      r,
      hacer(motor, r.state, A, {
        tipo: 'JUGAR_MODIFICADOR',
        uid: propio ?? '',
        valor: 2,
        tirada: 0,
      }),
    );
    expect(evento(r, 'liderActivado')).toEqual([
      { tipo: 'liderActivado', jugador: A, carta: 'lider_el_cuerno_protector' },
    ]);
    r = responder(r, A, { valor: 1 });
    expect(evento(r, 'liderActivado')).toHaveLength(1);
  });

  it('R-082: La Garra Sombría se activa al usar su habilidad, tras habilidadUsada', () => {
    const s = mesa({ [A]: 'lider_la_garra_sombria' });
    mano(s, B, 'desafio');
    const r = hacer(motor, s, A, { tipo: 'USAR_HABILIDAD', uid: jugadorDe(s, A).lider });
    expect(evento(r, 'liderActivado')).toEqual([
      { tipo: 'liderActivado', jugador: A, carta: 'lider_la_garra_sombria' },
    ]);
    const t = tipos(r);
    expect(t.indexOf('liderActivado')).toBe(t.indexOf('habilidadUsada') + 1);
  });

  it('R-088: los bonos y disparadores de Monstruos no emiten liderActivado', () => {
    const s = mesa({ [A]: 'lider_la_flecha_divina' });
    monstruo(s, A, 'monstruo_caldero_anuro');
    monstruo(s, A, 'monstruo_aries_artico');
    const r = activar(s, 'heroe_napping_nibbles', [3, 3]);
    expect(evento(r, 'tiradaFinal')[0]?.bonos).toEqual([
      { carta: 'monstruo_caldero_anuro', valor: 1 },
    ]);
    expect(evento(r, 'disparadorActivado').map((e) => e.carta)).toContain('monstruo_aries_artico');
    expect(evento(r, 'liderActivado')).toEqual([]);
  });

  it('es público: todos lo ven igual y tiene texto en el historial', () => {
    const e: Evento = { tipo: 'liderActivado', jugador: A, carta: 'lider_la_garra_sombria' };
    for (const yo of [A, B, C, null]) expect(eventoParaJugador(e, yo)).toEqual(e);
    const nombres = { jugador: (id: string) => id.toUpperCase(), carta: () => 'La Garra Sombría' };
    expect(describirEvento(e, nombres)).toBe(
      `${A.toUpperCase()} ha activado la habilidad de su Líder, La Garra Sombría.`,
    );
  });
});
