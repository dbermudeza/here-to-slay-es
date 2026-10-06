/**
 * Presentación del Líder: cada vez que se activa la habilidad del Líder de un jugador (evento
 * `liderActivado`, R-082/R-103), la partida se detiene para todos `presentacionLiderMs`, como en la
 * celebración. Varias activaciones seguidas se presentan una tras otra. Usa el catálogo real (se
 * salta si falta Referencias/).
 */
import { SISTEMA, type Evento, type GameState, type Motor } from '@hts/engine';
import { expect, it } from 'vitest';
import {
  A,
  B,
  C,
  describeReal,
  forzarDados,
  heroe,
  jugadorDe,
  mano,
  mesa,
  monstruo,
  motor,
} from '../../engine/test/cartas/reales';
import {
  Anfitrion,
  PRESENTACION_LIDER_POR_DEFECTO_MS,
  RelojManual,
  SEGUNDOS_POR_DEFECTO,
  type ConfigAnfitrion,
  type OpcionesAnfitrion,
} from '../src';

const PRESENTACION = PRESENTACION_LIDER_POR_DEFECTO_MS;

function config(extra: Partial<ConfigAnfitrion> = {}): ConfigAnfitrion {
  return {
    modo: 'enLinea',
    reglas: 'normal',
    semilla: 'presentacion',
    segundos: SEGUNDOS_POR_DEFECTO,
    jugadores: [A, B, C].map((id) => ({ id, nombre: id.toUpperCase(), control: 'humano' })),
    ...extra,
  };
}

function anfitrion(
  s: GameState,
  opciones: OpcionesAnfitrion = {},
  extra: Partial<ConfigAnfitrion> = {},
  previos: readonly Evento[] = [],
  m: Motor = motor,
) {
  const reloj = new RelojManual();
  const a = new Anfitrion(
    m,
    config(extra),
    s,
    reloj,
    { retardoBotMs: 100, celebracionMs: 0, pausaResultadoMs: 0, ...opciones },
    previos,
  );
  return { a, reloj };
}

const activaciones = (a: Anfitrion) => a.eventos.filter((e) => e.tipo === 'liderActivado');

/** Cierra la ventana abierta como lo haría su cuenta regresiva. */
function cerrarVentana(a: Anfitrion): void {
  const cima = a.estado.pila.at(-1);
  if (cima === undefined || !('secuencia' in cima)) throw new Error('No hay ventana abierta');
  expect(a.enviar(SISTEMA, { tipo: 'CERRAR_VENTANA', secuencia: cima.secuencia })).toBeNull();
}

/** El jugador del turno tira por un Héroe de su Grupo y se cierra la ventana de Modificadores. */
function tirarHeroe(a: Anfitrion, uid: string): void {
  expect(a.enviar(a.estado.turno.jugador, { tipo: 'TIRAR_HEROE', uid })).toBeNull();
  cerrarVentana(a);
}

/** Mesa con A como La Canción Carismática y dos Héroes; todas las tiradas fallan (1 + 1 + 1). */
function cancion(): { s: GameState; heroes: [string, string] } {
  const s = mesa({ [A]: 'lider_la_cancion_carismatica', [B]: 'lider_la_flecha_divina' });
  const heroes: [string, string] = [
    heroe(s, A, 'heroe_peanut'),
    heroe(s, A, 'heroe_napping_nibbles'),
  ];
  return { s: forzarDados(s, ...Array<number>(12).fill(1)), heroes };
}

/** Mesa con A como La Flecha Divina y Aries Ártico en el centro, que muere con 5 + 5 + 1. */
function flecha(monstruosPrevios: string[] = []): { s: GameState; objetivo: string } {
  const s = mesa({ [A]: 'lider_la_flecha_divina' });
  heroe(s, A, 'heroe_peanut');
  for (const m of monstruosPrevios) monstruo(s, A, m);
  const objetivo = monstruo(s, B, 'monstruo_aries_artico');
  jugadorDe(s, B).monstruos = [];
  s.monstruosCentro.push(objetivo);
  return { s: forzarDados(s, 5, 5), objetivo };
}

/**
 * Motor que repite cada `liderActivado` en el mismo lote de eventos: simula dos activaciones del
 * mismo Líder en una sola acción.
 */
const motorDoble: Motor = {
  ...motor,
  reducer: (s, a) => {
    const r = motor.reducer(s, a);
    if (!r.ok) return r;
    return {
      ...r,
      events: r.events.flatMap((e): Evento[] => (e.tipo === 'liderActivado' ? [e, e] : [e])),
    };
  },
};

describeReal('Anfitrión: presentación del Líder', () => {
  it('R-082: la activación detiene la partida 4 s para todos', () => {
    expect(PRESENTACION_LIDER_POR_DEFECTO_MS).toBe(4000);
    const s = mesa({ [A]: 'lider_la_garra_sombria' });
    mano(s, B, 'desafio');
    mano(s, C, 'desafio');
    const { a, reloj } = anfitrion(s);
    const versiones: number[] = [];
    a.suscribir(() => versiones.push(a.version));
    expect(a.presentacionLider).toBeNull();
    expect(a.restantePresentacionLiderMs()).toBeNull();

    expect(a.enviar(A, { tipo: 'USAR_HABILIDAD', uid: jugadorDe(s, A).lider })).toBeNull();
    expect(a.presentacionLider).toEqual({
      id: 1,
      jugador: A,
      carta: 'lider_la_garra_sombria',
      duracionMs: PRESENTACION,
    });
    expect(a.restantePresentacionLiderMs()).toBe(PRESENTACION);
    expect(a.legales()).toEqual([]);
    expect(a.legalesDe(A)).toEqual([]);
    expect(a.legalesDe(B)).toEqual([]);
    expect(a.enviar(A, { tipo: 'RESPONDER', respuesta: { jugador: B } })).toBe(
      'PRESENTACION_LIDER',
    );
    expect(a.enviar(B, { tipo: 'ROBAR' })).toBe('PRESENTACION_LIDER');
    expect(a.validar({ tipo: 'ROBAR' })).toBe('PRESENTACION_LIDER');
    expect(a.motivosDe(A).length).toBeGreaterThan(0);
    expect(a.motivosDe(A).every((m) => m.codigo === 'PRESENTACION_LIDER')).toBe(true);

    reloj.avanzar(PRESENTACION - 1);
    expect(a.restantePresentacionLiderMs()).toBe(1);
    const antes = versiones.length;
    reloj.avanzar(1);
    expect(a.presentacionLider).toBeNull();
    expect(a.restantePresentacionLiderMs()).toBeNull();
    expect(versiones.length).toBeGreaterThan(antes);
    // La partida sigue: A elige a quién SACAR una carta.
    expect(a.legalesDe(A).length).toBeGreaterThan(0);
  });

  it('R-082: dos activaciones seguidas del mismo Líder en el turno dan dos presentaciones', () => {
    const { s, heroes } = cancion();
    const { a, reloj } = anfitrion(s);
    tirarHeroe(a, heroes[0]);
    expect(a.presentacionLider).toMatchObject({ id: 1, jugador: A });
    reloj.avanzar(PRESENTACION);
    expect(a.presentacionLider).toBeNull();

    tirarHeroe(a, heroes[1]);
    expect(activaciones(a)).toHaveLength(2);
    expect(a.estado.turno.numero).toBe(s.turno.numero);
    expect(a.presentacionLider).toEqual({
      id: 2,
      jugador: A,
      carta: 'lider_la_cancion_carismatica',
      duracionMs: PRESENTACION,
    });
    expect(a.enviar(A, { tipo: 'FIN_TURNO' })).toBe('PRESENTACION_LIDER');
    reloj.avanzar(PRESENTACION);
    expect(a.presentacionLider).toBeNull();
    expect(a.legalesDe(A)).toContainEqual({ tipo: 'FIN_TURNO' });
  });

  it('R-082: dos activaciones en el mismo lote se presentan en orden, una tras otra', () => {
    const { s, heroes } = cancion();
    const { a, reloj } = anfitrion(s, { pausaResultadoMs: 3000 }, {}, [], motorDoble);
    tirarHeroe(a, heroes[0]);
    expect(activaciones(a)).toHaveLength(2);
    expect(a.presentacionLider).toMatchObject({ id: 1, jugador: A });
    expect(a.pausaResultado).toBeNull();
    reloj.avanzar(PRESENTACION);
    expect(a.presentacionLider).toMatchObject({ id: 2, jugador: A });
    expect(a.restantePresentacionLiderMs()).toBe(PRESENTACION);
    expect(a.pausaResultado).toBeNull();
    expect(a.enviar(A, { tipo: 'FIN_TURNO' })).toBe('PRESENTACION_LIDER');
    reloj.avanzar(PRESENTACION);
    expect(a.presentacionLider).toBeNull();
    // La pausa de resultado llega después de todas las presentaciones.
    expect(a.restantePausaResultadoMs()).toBe(3000);
    reloj.avanzar(3000);
    expect(a.enviar(A, { tipo: 'FIN_TURNO' })).toBeNull();
  });

  it('R-104: tras la presentación viene la pausa de resultado completa', () => {
    const { s, heroes } = cancion();
    const { a, reloj } = anfitrion(s, { pausaResultadoMs: 3000 });
    tirarHeroe(a, heroes[0]);
    expect(a.presentacionLider).not.toBeNull();
    expect(a.pausaResultado).toBeNull();
    reloj.avanzar(PRESENTACION);
    expect(a.presentacionLider).toBeNull();
    expect(a.pausaResultado).not.toBeNull();
    expect(a.restantePausaResultadoMs()).toBe(3000);
    expect(a.enviar(A, { tipo: 'FIN_TURNO' })).toBe('PAUSA_RESULTADO');
    reloj.avanzar(3000);
    expect(a.pausaResultado).toBeNull();
    expect(a.enviar(A, { tipo: 'FIN_TURNO' })).toBeNull();
  });

  it('R-088: al matar un Monstruo, primero la presentación y luego la celebración (sin pausa)', () => {
    const { s, objetivo } = flecha();
    const { a, reloj } = anfitrion(s, { celebracionMs: 4000, pausaResultadoMs: 3000 });
    expect(a.enviar(A, { tipo: 'ATACAR', uid: objetivo })).toBeNull();
    cerrarVentana(a);
    expect(a.eventos.some((e) => e.tipo === 'monstruoMatado')).toBe(true);
    expect(a.presentacionLider).toMatchObject({ jugador: A, carta: 'lider_la_flecha_divina' });
    expect(a.celebracion).toBeNull();
    reloj.avanzar(PRESENTACION);
    expect(a.presentacionLider).toBeNull();
    expect(a.celebracion).toMatchObject({ jugador: A, carta: 'monstruo_aries_artico' });
    expect(a.enviar(A, { tipo: 'FIN_TURNO' })).toBe('CELEBRACION');
    reloj.avanzar(4000);
    expect(a.celebracion).toBeNull();
    expect(a.pausaResultado).toBeNull();
    expect(a.enviar(A, { tipo: 'FIN_TURNO' })).toBeNull();
  });

  it('el límite por decisión se congela durante la presentación y la pausa encadenadas', () => {
    // A (El Puño de la Razón) juega un Héroe, B lo desafía y A gana: le queda la tirada inmediata.
    const s = mesa({ [A]: 'lider_el_puno_de_la_razon' });
    const [h] = mano(s, A, 'heroe_peanut');
    const [d] = mano(s, B, 'desafio');
    const { a, reloj } = anfitrion(
      forzarDados(s, 4, 4, 3, 3),
      { pausaResultadoMs: 3000 },
      { limiteDecisionS: 30 },
    );
    expect(a.enviar(A, { tipo: 'JUGAR_CARTA', uid: h ?? '' })).toBeNull();
    expect(a.enviar(B, { tipo: 'DESAFIAR', uid: d ?? '' })).toBeNull();
    // La ventana de Modificadores del desafío cuenta con normalidad hasta que se cierra.
    expect(a.restanteMs()).not.toBeNull();
    cerrarVentana(a);
    expect(a.eventos.some((e) => e.tipo === 'desafioResuelto')).toBe(true);
    expect(a.estado.pila.at(-1)?.tipo).toBe('tiradaInmediata');
    expect(a.presentacionLider).toMatchObject({ jugador: A, carta: 'lider_el_puno_de_la_razon' });
    expect(a.plazoDecision?.jugador).toBe(A);
    expect(a.restanteDecisionMs()).toBe(30_000);
    reloj.avanzar(PRESENTACION);
    expect(a.pausaResultado).not.toBeNull();
    expect(a.restanteDecisionMs()).toBe(30_000);
    reloj.avanzar(3000);
    expect(a.pausaResultado).toBeNull();
    expect(a.restanteDecisionMs()).toBe(30_000);
    const eventos = a.eventos.length;
    reloj.avanzar(29_999);
    expect(a.eventos).toHaveLength(eventos);
    reloj.avanzar(1);
    expect(a.eventos.length).toBeGreaterThan(eventos);
  });

  it('la ventana no corre durante la presentación y después cuenta entera', () => {
    // El Cuerno Protector: A juega un Modificador sobre su tirada; la decisión del Cuerno queda
    // encima de la ventana y, al responder tras la presentación, la ventana se reinicia.
    const s = mesa({ [A]: 'lider_el_cuerno_protector' });
    const [mod] = mano(s, A, 'modificador_mas2_menos2');
    const x = heroe(s, A, 'heroe_peanut');
    const { a, reloj } = anfitrion(forzarDados(s, 2, 2));
    expect(a.enviar(A, { tipo: 'TIRAR_HEROE', uid: x })).toBeNull();
    reloj.avanzar(1000);
    expect(
      a.enviar(A, { tipo: 'JUGAR_MODIFICADOR', uid: mod ?? '', valor: 2, tirada: 0 }),
    ).toBeNull();
    expect(a.presentacionLider).toMatchObject({ jugador: A, carta: 'lider_el_cuerno_protector' });
    expect(a.estado.pila.at(-1)?.tipo).toBe('decision');
    expect(a.restanteMs()).toBeNull();
    const eventos = a.eventos.length;
    reloj.avanzar(PRESENTACION - 1);
    expect(a.eventos).toHaveLength(eventos);
    reloj.avanzar(1);
    expect(a.presentacionLider).toBeNull();
    expect(a.enviar(A, { tipo: 'RESPONDER', respuesta: { valor: 1 } })).toBeNull();
    expect(a.estado.pila.at(-1)?.tipo).toBe('ventanaModificadores');
    expect(a.restanteMs()).toBe(a.plazo?.duracionMs);
  });

  it('con presentacionLiderMs: 0 no hay presentación (el evento sigue llegando)', () => {
    const { s, heroes } = cancion();
    const { a, reloj } = anfitrion(s, { presentacionLiderMs: 0 });
    tirarHeroe(a, heroes[0]);
    expect(activaciones(a)).toHaveLength(1);
    expect(a.presentacionLider).toBeNull();
    expect(a.legalesDe(A)).toContainEqual({ tipo: 'FIN_TURNO' });
    expect(reloj.pendientes).toBe(0);
  });

  it('R-090: en la jugada ganadora no hay presentación; la celebración sigue y no quedan temporizadores', () => {
    const { s, objetivo } = flecha(['monstruo_caldero_anuro', 'monstruo_alasangre']);
    const { a, reloj } = anfitrion(s, { celebracionMs: 4000, pausaResultadoMs: 3000 });
    expect(a.enviar(A, { tipo: 'ATACAR', uid: objetivo })).toBeNull();
    cerrarVentana(a);
    expect(a.estado.ganador).toMatchObject({ jugador: A });
    expect(activaciones(a)).toHaveLength(1);
    expect(a.presentacionLider).toBeNull();
    expect(a.celebracion).not.toBeNull();
    reloj.avanzar(4000);
    expect(a.celebracion).toBeNull();
    expect(a.presentacionLider).toBeNull();
    expect(reloj.pendientes).toBe(0);
  });

  it('destruir durante la presentación no deja temporizadores', () => {
    const { s, heroes } = cancion();
    const { a, reloj } = anfitrion(s, { pausaResultadoMs: 3000 });
    tirarHeroe(a, heroes[0]);
    expect(a.presentacionLider).not.toBeNull();
    a.destruir();
    expect(reloj.pendientes).toBe(0);
  });

  it('una partida cargada no presenta las activaciones del historial; las nuevas, sí', () => {
    const { s, heroes } = cancion();
    const previos: Evento[] = [
      { tipo: 'liderActivado', jugador: B, carta: 'lider_la_flecha_divina' },
      { tipo: 'turnoIniciado', jugador: A, numero: s.turno.numero },
      { tipo: 'liderActivado', jugador: A, carta: 'lider_la_cancion_carismatica' },
    ];
    const { a, reloj } = anfitrion(s, {}, {}, previos);
    expect(a.presentacionLider).toBeNull();
    expect(reloj.pendientes).toBe(0);
    tirarHeroe(a, heroes[0]);
    expect(activaciones(a)).toHaveLength(3);
    expect(a.presentacionLider).toEqual({
      id: 1,
      jugador: A,
      carta: 'lider_la_cancion_carismatica',
      duracionMs: PRESENTACION,
    });
  });
});
