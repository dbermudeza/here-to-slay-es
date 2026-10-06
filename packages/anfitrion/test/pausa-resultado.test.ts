import { describe, expect, it } from 'vitest';
import type { Evento } from '@hts/engine';
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
  type Control,
  type OpcionesAnfitrion,
} from '../src';

/**
 * Pausa de resultado: tras un evento que la interfaz enseña como resultado (tirada, duelo, ataque,
 * jugada resuelta o anulada), la partida se detiene `pausaResultadoMs` para todos, como en la
 * celebración de un Monstruo. No es una regla del juego (no cita ninguna regla): es ritmo del
 * anfitrión.
 */
const motor = nuevoMotor();
const RETARDO = 100;
const PAUSA = PAUSA_RESULTADO_POR_DEFECTO_MS;

function config(controles: Control[], extra: Partial<ConfigAnfitrion> = {}): ConfigAnfitrion {
  return {
    modo: 'enLinea',
    reglas: 'normal',
    semilla: 'pausa-resultado',
    segundos: SEGUNDOS_POR_DEFECTO,
    jugadores: controles.map((control, i) => ({ id: `j${i + 1}`, nombre: `J${i + 1}`, control })),
    ...extra,
  };
}

/**
 * Turno de `turnoDe`, con Líder Bardo para j1, Monstruos "h", "hh" y "mago_h" en el centro, los
 * Héroes de `heroes` en el Grupo de j1 y los dados forzados a `dados`.
 */
function preparado(
  c: ConfigAnfitrion,
  {
    opciones = {},
    turnoDe = 'j1',
    heroes = ['bardo'],
    dados = [1, 1],
  }: {
    opciones?: OpcionesAnfitrion;
    turnoDe?: string;
    heroes?: ('bardo' | 'mago')[];
    dados?: number[];
  } = {},
) {
  const reloj = new RelojManual();
  const s = escenario(motor.crearPartida(aConfigPartida(c)).state, {
    turnoDe,
    lideres: { j1: 'bardo' },
    centro: ['h', 'hh', 'mago_h'],
  });
  const uids = heroes.map((clase) => ponerHeroe(s, 'j1', clase));
  const monstruo = s.monstruosCentro.find((u) => s.instancias[u] === 'monstruo_h');
  if (monstruo === undefined) throw new Error('Falta el Monstruo h');
  const a = new Anfitrion(motor, c, forzarDados(s, ...dados), reloj, {
    retardoBotMs: RETARDO,
    celebracionMs: 0,
    ...opciones,
  });
  return { a, reloj, heroe: uids[0] ?? '', monstruo };
}

/** j1 tira por su Héroe y se deja vencer la ventana de Modificadores: la tirada falla. */
function tirarHeroe(a: Anfitrion, reloj: RelojManual, heroe: string): void {
  expect(a.enviar('j1', { tipo: 'TIRAR_HEROE', uid: heroe })).toBeNull();
  expect(a.estado.pila.at(-1)?.tipo).toBe('ventanaModificadores');
  reloj.avanzar(a.restanteMs() ?? 0);
  expect(a.eventos.at(-1)).toMatchObject({ tipo: 'tiradaHeroe', jugador: 'j1', exito: false });
}

/** j1 juega un Mago desde la mano: se abre la ventana de desafío. */
function jugarMago(a: Anfitrion): void {
  const mago = darCarta(a.estado, 'j1', 'heroe_mago');
  expect(a.enviar('j1', { tipo: 'JUGAR_CARTA', uid: mago })).toBeNull();
  expect(a.estado.pila.at(-1)?.tipo).toBe('ventanaDesafio');
}

/**
 * Simula un resultado llegado con el estado actual (p. ej. por un efecto) y fuerza la
 * actualización del anfitrión con una desconexión breve de `quien`.
 */
function inyectar(a: Anfitrion, evento: Evento, quien = 'j1'): void {
  a.eventos.push(evento);
  a.desconectar(quien);
  a.reconectar(quien);
}

const TIRADA: Evento = {
  tipo: 'tiradaHeroe',
  jugador: 'j1',
  heroe: 'heroe_bardo',
  total: 2,
  exito: false,
};

/** Eventos emitidos por `jugador` desde el índice `desde`. */
function de(a: Anfitrion, jugador: string, desde: number): number {
  return a.eventos.slice(desde).filter((e) => 'jugador' in e && e.jugador === jugador).length;
}

describe('Anfitrión: pausa de resultado para todos', () => {
  it('el valor por defecto es 3000 ms (la escena del duelo)', () => {
    expect(PAUSA_RESULTADO_POR_DEFECTO_MS).toBe(3000);
  });

  it('tras una tirada de Héroe nadie puede jugar hasta que termina la pausa', () => {
    const { a, reloj, heroe } = preparado(config(['humano', 'humano']));
    const versiones: number[] = [];
    a.suscribir(() => versiones.push(a.version));
    tirarHeroe(a, reloj, heroe);
    expect(a.pausaResultado).toEqual({ id: 1, duracionMs: PAUSA });
    expect(a.restantePausaResultadoMs()).toBe(PAUSA);
    expect(a.celebracion).toBeNull();
    expect(a.legales()).toEqual([]);
    expect(a.legalesDe('j1')).toEqual([]);
    expect(a.legalesDe('j2')).toEqual([]);
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBe('PAUSA_RESULTADO');
    expect(a.enviar('j2', { tipo: 'ROBAR' })).toBe('PAUSA_RESULTADO');
    expect(a.validar({ tipo: 'FIN_TURNO' })).toBe('PAUSA_RESULTADO');
    expect(a.motivo({ tipo: 'FIN_TURNO' })).toBe('PAUSA_RESULTADO');
    const motivos = a.motivosDe('j1');
    expect(motivos).toContainEqual({ accion: { tipo: 'ROBAR' }, codigo: 'PAUSA_RESULTADO' });
    expect(motivos.every((m) => m.codigo === 'PAUSA_RESULTADO')).toBe(true);

    reloj.avanzar(PAUSA - 1);
    expect(a.restantePausaResultadoMs()).toBe(1);
    const antes = versiones.length;
    reloj.avanzar(1);
    expect(a.pausaResultado).toBeNull();
    expect(a.restantePausaResultadoMs()).toBeNull();
    expect(versiones.length).toBeGreaterThan(antes);
    expect(a.legalesDe('j1')).toContainEqual({ tipo: 'FIN_TURNO' });
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
  });

  it('al empezar la pausa se notifica a los suscriptores', () => {
    const { a, reloj, heroe } = preparado(config(['humano', 'humano']));
    let conPausa = 0;
    a.suscribir(() => {
      if (a.pausaResultado !== null) conPausa += 1;
    });
    tirarHeroe(a, reloj, heroe);
    expect(conPausa).toBeGreaterThan(0);
  });

  it('los bots no actúan durante la pausa y sí al terminar', () => {
    // Turno del bot j2: su primer paso estaba programado y la pausa lo detiene.
    const { a, reloj } = preparado(config(['humano', 'normal']), { turnoDe: 'j2' });
    inyectar(a, TIRADA);
    expect(a.pausaResultado).not.toBeNull();
    reloj.avanzar(PAUSA - 1);
    expect(de(a, 'j2', 0)).toBe(0);
    reloj.avanzar(1);
    expect(a.pausaResultado).toBeNull();
    reloj.avanzar(RETARDO - 1);
    expect(de(a, 'j2', 0)).toBe(0);
    reloj.avanzar(1);
    expect(de(a, 'j2', 0)).toBeGreaterThan(0);
  });

  it('un Héroe jugado que entra en el Grupo también abre la pausa', () => {
    const { a, reloj } = preparado(config(['humano', 'normal']));
    jugarMago(a);
    // El bot pasa en la ventana de desafío (sin cartas de Desafío) y el Héroe entra.
    reloj.avanzar(RETARDO);
    expect(a.eventos.at(-1)).toMatchObject({ tipo: 'heroeEntra', jugador: 'j1' });
    expect(a.pausaResultado).not.toBeNull();
    expect(a.estado.pila.at(-1)?.tipo).toBe('tiradaInmediata');
    expect(a.enviar('j1', { tipo: 'TIRADA_INMEDIATA', tirar: false })).toBe('PAUSA_RESULTADO');
    reloj.avanzar(PAUSA);
    expect(a.enviar('j1', { tipo: 'TIRADA_INMEDIATA', tirar: false })).toBeNull();
  });

  it('fracaso de un ataque: primero el resultado y, tras la pausa, la pregunta de sacrificar', () => {
    const { a, reloj, monstruo } = preparado(config(['humano', 'humano']), {
      heroes: ['bardo', 'mago'],
    });
    expect(a.enviar('j1', { tipo: 'ATACAR', uid: monstruo })).toBeNull();
    reloj.avanzar(a.restanteMs() ?? 0);
    expect(a.eventos).toContainEqual(
      expect.objectContaining({ tipo: 'ataqueResuelto', jugador: 'j1', resultado: 'fracaso' }),
    );
    const cima = a.estado.pila.at(-1);
    expect(cima).toMatchObject({ tipo: 'elegir', jugador: 'j1', accion: 'sacrificar' });
    expect(a.actorRequerido()).toBe('j1');
    expect(a.pausaResultado).not.toBeNull();
    // Quien debe sacrificar todavía no puede responder.
    const sacrificado = a.estado.jugadores[0]?.grupo[1]?.heroe ?? '';
    expect(a.legalesDe('j1')).toEqual([]);
    expect(a.enviar('j1', { tipo: 'ELEGIR', uids: [sacrificado] })).toBe('PAUSA_RESULTADO');
    reloj.avanzar(PAUSA);
    expect(a.pausaResultado).toBeNull();
    expect(a.enviar('j1', { tipo: 'ELEGIR', uids: [sacrificado] })).toBeNull();
  });

  it('el límite por decisión se congela durante la pausa y conserva su tiempo', () => {
    const { a, reloj, monstruo } = preparado(
      config(['humano', 'humano'], { limiteDecisionS: 30 }),
      {
        heroes: ['bardo', 'mago'],
      },
    );
    expect(a.enviar('j1', { tipo: 'ATACAR', uid: monstruo })).toBeNull();
    reloj.avanzar(a.restanteMs() ?? 0);
    expect(a.pausaResultado).not.toBeNull();
    expect(a.plazoDecision?.jugador).toBe('j1');
    expect(a.restanteDecisionMs()).toBe(30_000);
    reloj.avanzar(PAUSA - 1);
    expect(a.restanteDecisionMs()).toBe(30_000);
    reloj.avanzar(1);
    expect(a.pausaResultado).toBeNull();
    expect(a.restanteDecisionMs()).toBe(30_000);
    const eventos = a.eventos.length;
    reloj.avanzar(29_999);
    expect(a.eventos).toHaveLength(eventos);
    // Al agotarse, decide el bot por él, como siempre.
    reloj.avanzar(1);
    expect(a.eventos.length).toBeGreaterThan(eventos);
  });

  it('una ventana abierta conserva su tiempo restante', () => {
    const { a, reloj } = preparado(config(['humano', 'humano']));
    jugarMago(a);
    const total = a.restanteMs() ?? 0;
    reloj.avanzar(1000);
    inyectar(a, TIRADA, 'j2');
    expect(a.pausaResultado).not.toBeNull();
    expect(a.restanteMs()).toBeNull();
    expect(a.enviar('j2', { tipo: 'PASAR' })).toBe('PAUSA_RESULTADO');
    reloj.avanzar(PAUSA);
    expect(a.pausaResultado).toBeNull();
    expect(a.restanteMs()).toBe(total - 1000);
    expect(a.estado.pila.at(-1)?.tipo).toBe('ventanaDesafio');
    reloj.avanzar(total - 1000);
    expect(a.estado.pila.at(-1)?.tipo).not.toBe('ventanaDesafio');
  });

  it('otro resultado durante la pausa la alarga desde ese resultado con el mismo id', () => {
    const { a, reloj, heroe } = preparado(config(['humano', 'humano']));
    tirarHeroe(a, reloj, heroe);
    const id = a.pausaResultado?.id;
    reloj.avanzar(2000);
    inyectar(a, TIRADA, 'j2');
    expect(a.pausaResultado).toEqual({ id, duracionMs: PAUSA });
    expect(a.restantePausaResultadoMs()).toBe(PAUSA);
    reloj.avanzar(PAUSA - 1);
    expect(a.pausaResultado).not.toBeNull();
    reloj.avanzar(1);
    expect(a.pausaResultado).toBeNull();
    // La siguiente pausa, ya separada, lleva un id nuevo.
    inyectar(a, TIRADA, 'j2');
    expect(a.pausaResultado?.id).not.toBe(id);
  });

  it('con pausaResultadoMs: 0 no hay pausa', () => {
    const { a, reloj, heroe } = preparado(config(['humano', 'humano']), {
      opciones: { pausaResultadoMs: 0 },
    });
    tirarHeroe(a, reloj, heroe);
    expect(a.pausaResultado).toBeNull();
    expect(a.restantePausaResultadoMs()).toBeNull();
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
  });

  it('sin evento de resultado no hay pausa: el bot actúa a los retardoBotMs de siempre', () => {
    const { a, reloj } = preparado(config(['humano', 'normal']), { turnoDe: 'j2' });
    expect(a.pausaResultado).toBeNull();
    reloj.avanzar(RETARDO - 1);
    expect(de(a, 'j2', 0)).toBe(0);
    reloj.avanzar(1);
    expect(de(a, 'j2', 0)).toBeGreaterThan(0);
  });

  describe('la celebración tiene prioridad', () => {
    it('al matar un Monstruo hay celebración y no pausa, ni después con los eventos viejos', () => {
      const { a, reloj, monstruo } = preparado(config(['humano', 'humano']), {
        opciones: { celebracionMs: 4000 },
        dados: [4, 4],
      });
      expect(a.enviar('j1', { tipo: 'ATACAR', uid: monstruo })).toBeNull();
      reloj.avanzar(a.restanteMs() ?? 0);
      expect(a.eventos.some((e) => e.tipo === 'ataqueResuelto')).toBe(true);
      expect(a.celebracion).not.toBeNull();
      expect(a.pausaResultado).toBeNull();
      expect(a.enviar('j1', { tipo: 'ROBAR' })).toBe('CELEBRACION');
      reloj.avanzar(4000);
      expect(a.celebracion).toBeNull();
      expect(a.pausaResultado).toBeNull();
      expect(a.enviar('j1', { tipo: 'ROBAR' })).toBeNull();
    });

    it('un Monstruo matado durante la pausa la sustituye por la celebración', () => {
      const { a, reloj, heroe } = preparado(config(['humano', 'humano']), {
        opciones: { celebracionMs: 4000 },
      });
      tirarHeroe(a, reloj, heroe);
      reloj.avanzar(1000);
      inyectar(a, { tipo: 'monstruoMatado', jugador: 'j1', carta: 'monstruo_h' }, 'j2');
      expect(a.celebracion).not.toBeNull();
      expect(a.pausaResultado).toBeNull();
      expect(a.restantePausaResultadoMs()).toBeNull();
      expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBe('CELEBRACION');
      reloj.avanzar(4000);
      expect(a.celebracion).toBeNull();
      expect(a.pausaResultado).toBeNull();
      expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
    });
  });

  describe('en este dispositivo', () => {
    it('el traspaso espera a que termine la pausa', () => {
      const { a, reloj } = preparado(config(['humano', 'humano'], { modo: 'local' }));
      // Fin de turno de j1 y, a la vez, un resultado: primero la pausa, luego se pasa.
      a.eventos.push(TIRADA);
      expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
      expect(a.pausaResultado).not.toBeNull();
      expect(a.traspaso).toBeNull();
      a.confirmarTraspaso();
      expect(a.alMando).toBe('j1');
      reloj.avanzar(PAUSA);
      expect(a.pausaResultado).toBeNull();
      expect(a.traspaso).toBe('j2');
      a.confirmarTraspaso();
      expect(a.alMando).toBe('j2');
    });

    it('responder y terminarRespuesta no hacen nada durante la pausa', () => {
      const { a, reloj } = preparado(config(['humano', 'humano'], { modo: 'local' }));
      jugarMago(a);
      a.responder('j2');
      expect(a.respondiendo).toBe('j2');
      inyectar(a, TIRADA);
      expect(a.pausaResultado).not.toBeNull();
      expect(a.respondedoresPosibles()).toEqual([]);
      a.terminarRespuesta();
      expect(a.respondiendo).toBe('j2');
      expect(a.restanteMs()).toBeNull();
      reloj.avanzar(PAUSA);
      expect(a.respondiendo).toBe('j2');
      a.confirmarTraspaso();
      a.terminarRespuesta();
      expect(a.respondiendo).toBeNull();
      expect(a.restanteMs()).not.toBeNull();
    });

    it('responder no hace nada durante la pausa', () => {
      const { a, reloj } = preparado(config(['humano', 'humano'], { modo: 'local' }));
      jugarMago(a);
      inyectar(a, TIRADA);
      a.responder('j2');
      expect(a.respondiendo).toBeNull();
      expect(a.traspaso).toBeNull();
      reloj.avanzar(PAUSA);
      expect(a.respondedoresPosibles()).toEqual(['j2']);
      a.responder('j2');
      expect(a.respondiendo).toBe('j2');
    });
  });

  describe('al terminar la partida no queda ningún temporizador', () => {
    it('el resultado que da la victoria no abre pausa', () => {
      const { a, reloj, monstruo } = preparado(config(['humano', 'humano']), { dados: [4, 4] });
      const j1 = a.estado.jugadores[0];
      if (j1 === undefined) throw new Error('Sin j1');
      j1.monstruos.push(...a.estado.mazoMonstruos.splice(0, 2));
      expect(a.enviar('j1', { tipo: 'ATACAR', uid: monstruo })).toBeNull();
      reloj.avanzar(a.restanteMs() ?? 0);
      expect(a.eventos.some((e) => e.tipo === 'ataqueResuelto')).toBe(true);
      expect(a.estado.ganador?.jugador).toBe('j1');
      expect(a.pausaResultado).toBeNull();
      expect(reloj.pendientes).toBe(0);
    });

    it('una pausa en curso se cancela si la partida termina', () => {
      const { a, reloj, heroe } = preparado(config(['humano', 'humano']));
      tirarHeroe(a, reloj, heroe);
      expect(a.pausaResultado).not.toBeNull();
      a.estado = { ...a.estado, ganador: { jugador: 'j1', motivo: 'tresMonstruos' } };
      inyectar(a, TIRADA, 'j2');
      expect(a.pausaResultado).toBeNull();
      expect(a.restantePausaResultadoMs()).toBeNull();
      expect(reloj.pendientes).toBe(0);
    });
  });

  it('destruir cancela la pausa', () => {
    const { a, reloj, heroe } = preparado(config(['humano', 'humano']));
    tirarHeroe(a, reloj, heroe);
    expect(a.pausaResultado).not.toBeNull();
    a.destruir();
    expect(reloj.pendientes).toBe(0);
  });
});
