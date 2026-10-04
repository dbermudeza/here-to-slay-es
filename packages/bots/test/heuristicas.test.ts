import { describe, expect, it } from 'vitest';
import type { Accion, GameState, JugadorId } from '@hts/engine';
import { BOTS, botFacil, botNormal, jugarPartida, type Bot, type EntradaBot } from '../src';
import {
  A,
  B,
  C,
  HAY_CATALOGO,
  forzarDados,
  hacer,
  heroe,
  jugadorDe,
  mano,
  mesa,
  monstruo,
  motor,
} from '../../engine/test/cartas/reales';

/** Lo que el director entregaría al bot de `jugador` en este estado. */
function entrada(s: GameState, jugador: JugadorId, azar = (): number => 0.5): EntradaBot {
  return {
    vista: motor.getPlayerView(s, jugador),
    legales: motor.accionesLegales(s, jugador),
    catalogo: motor.catalogo,
    azar,
  };
}

/** Pone un Monstruo concreto en el centro. */
function alCentro(s: GameState, id: string): string {
  const uid = monstruo(s, B, id);
  jugadorDe(s, B).monstruos = [];
  s.monstruosCentro.push(uid);
  return uid;
}

describe.skipIf(!HAY_CATALOGO)('Heurísticas del bot normal', () => {
  it('ataca al Monstruo que le da la victoria', () => {
    const s = mesa();
    monstruo(s, A, 'monstruo_megababosa');
    monstruo(s, A, 'monstruo_orthus');
    heroe(s, A, 'heroe_peanut');
    mano(s, A, 'heroe_mellow_dee');
    const objetivo = alCentro(s, 'monstruo_aries_artico');
    expect(botNormal.elegir(entrada(s, A))).toEqual({ tipo: 'ATACAR', uid: objetivo });
  });

  it('juega el Héroe que le completa el Grupo', () => {
    const s = mesa({ [A]: 'lider_la_flecha_divina' });
    for (const h of ['heroe_bad_axe', 'heroe_peanut', 'heroe_calming_voice', 'heroe_kit_napper'])
      heroe(s, A, h);
    const [mago] = mano(s, A, 'heroe_fluffy', 'desafio');
    expect(botNormal.elegir(entrada(s, A))).toEqual({ tipo: 'JUGAR_CARTA', uid: mago });
  });

  it('desafía la carta que daría la victoria a un rival', () => {
    const s = mesa({ [A]: 'lider_la_flecha_divina' });
    for (const h of ['heroe_bad_axe', 'heroe_peanut', 'heroe_calming_voice', 'heroe_kit_napper'])
      heroe(s, A, h);
    const [mago] = mano(s, A, 'heroe_fluffy');
    const [desafio] = mano(s, B, 'desafio');
    const r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: mago ?? '' });
    expect(botNormal.elegir(entrada(r.state, B))).toEqual({ tipo: 'DESAFIAR', uid: desafio });
  });

  it('no desafía una carta inofensiva de un rival que va por detrás', () => {
    const s = mesa();
    const [h] = mano(s, A, 'heroe_napping_nibbles');
    mano(s, B, 'desafio');
    monstruo(s, B, 'monstruo_orthus');
    const r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h ?? '' });
    expect(botNormal.elegir(entrada(r.state, B))).toEqual({ tipo: 'PASAR' });
  });

  it('juega un Modificador sobre su tirada solo si convierte el fallo en éxito', () => {
    const preparar = (d1: number, d2: number): GameState => {
      const s = mesa({ [A]: 'lider_la_flecha_divina' });
      const x = heroe(s, A, 'heroe_peanut'); // 7+
      mano(s, A, 'modificador_mas2_menos2', 'modificador_mas4');
      return hacer(motor, forzarDados(s, d1, d2), A, { tipo: 'TIRAR_HEROE', uid: x }).state;
    };
    // 3 + 2 = 5: +2 basta y es el más barato.
    const fallo = botNormal.elegir(entrada(preparar(3, 2), A));
    expect(fallo).toMatchObject({ tipo: 'JUGAR_MODIFICADOR', valor: 2, tirada: 0 });
    // 4 + 4 = 8: ya tiene éxito.
    expect(botNormal.elegir(entrada(preparar(4, 4), A))).toBeNull();
  });

  it('baja la tirada de ataque de un rival si así fracasa', () => {
    const s = mesa();
    heroe(s, A, 'heroe_peanut');
    const m = alCentro(s, 'monstruo_aries_artico'); // 10+ mata
    mano(s, B, 'modificador_menos4');
    const r = hacer(motor, forzarDados(s, 5, 5), A, { tipo: 'ATACAR', uid: m });
    expect(botNormal.elegir(entrada(r.state, B))).toMatchObject({
      tipo: 'JUGAR_MODIFICADOR',
      valor: -4,
    });
    expect(botNormal.elegir(entrada(r.state, C))).toBeNull();
  });

  it('elige destruir el Héroe del rival más peligroso', () => {
    const s = mesa();
    heroe(s, B, 'heroe_peanut');
    const peligroso = heroe(s, C, 'heroe_mellow_dee');
    monstruo(s, C, 'monstruo_orthus');
    monstruo(s, C, 'monstruo_megababosa');
    const x = heroe(s, A, 'heroe_bad_axe');
    let r = hacer(motor, forzarDados(s, 6, 6), A, { tipo: 'TIRAR_HEROE', uid: x });
    const v = r.state.pila[r.state.pila.length - 1];
    r = hacer(motor, r.state, '@sistema', {
      tipo: 'CERRAR_VENTANA',
      secuencia: v && 'secuencia' in v ? v.secuencia : 0,
    });
    expect(botNormal.elegir(entrada(r.state, A))).toEqual({
      tipo: 'RESPONDER',
      respuesta: { cartas: [peligroso] },
    });
  });
});

describe.skipIf(!HAY_CATALOGO)('Bot fácil y garantías comunes', () => {
  it('el bot fácil solo devuelve acciones legales (o null en ventanas)', () => {
    const vistas: Accion[] = [];
    const espia: Bot = {
      nivel: 'facil',
      elegir: (e) => {
        const a = botFacil.elegir(e);
        if (a !== null) {
          expect(e.legales).toContainEqual(a);
          vistas.push(a);
        }
        return a;
      },
    };
    jugarPartida(
      motor,
      { jugadores: [A, B, C].map((id) => ({ id, nombre: id })), semilla: 'facil' },
      { [A]: espia, [B]: espia, [C]: espia },
    );
    expect(vistas.length).toBeGreaterThan(50);
  });

  it('los bots solo reciben la vista filtrada: nunca manos ajenas, mazo ni RNG', () => {
    const comprobar: Bot = {
      nivel: 'normal',
      elegir: (e) => {
        const texto = JSON.stringify(e.vista);
        expect(texto).not.toContain('"rng"');
        expect(texto).not.toContain('dadosForzados');
        for (const j of e.vista.jugadores) if (j.id !== e.vista.yo) expect(j.mano).toBeNull();
        return BOTS.normal.elegir(e);
      },
    };
    const r = jugarPartida(
      motor,
      { jugadores: [A, B].map((id) => ({ id, nombre: id })), semilla: 'filtrada' },
      { [A]: comprobar, [B]: comprobar },
    );
    expect(r.ganador).not.toBeNull();
  });
});
