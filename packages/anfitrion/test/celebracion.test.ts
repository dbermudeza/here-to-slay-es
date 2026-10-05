import { describe, expect, it } from 'vitest';
import { escenario, forzarDados, nuevoMotor, ponerHeroe } from '../../engine/test/fixtures';
import {
  aConfigPartida,
  Anfitrion,
  RelojManual,
  SEGUNDOS_POR_DEFECTO,
  type ConfigAnfitrion,
  type Control,
  type OpcionesAnfitrion,
} from '../src';

const motor = nuevoMotor();

function config(controles: Control[], extra: Partial<ConfigAnfitrion> = {}): ConfigAnfitrion {
  return {
    modo: 'enLinea',
    reglas: 'normal',
    semilla: 'celebracion',
    segundos: SEGUNDOS_POR_DEFECTO,
    jugadores: controles.map((control, i) => ({ id: `j${i + 1}`, nombre: `J${i + 1}`, control })),
    ...extra,
  };
}

/** Turno de j1, con un Héroe en el Grupo y los dados preparados para matar al Monstruo "h". */
function preparado(c: ConfigAnfitrion, opciones: OpcionesAnfitrion = {}) {
  const reloj = new RelojManual();
  const s = escenario(motor.crearPartida(aConfigPartida(c)).state, {
    turnoDe: 'j1',
    lideres: { j1: 'bardo' },
    centro: ['h', 'hh', 'mago_h'],
  });
  ponerHeroe(s, 'j1', 'bardo');
  const monstruo = s.monstruosCentro.find((u) => s.instancias[u] === 'monstruo_h');
  if (monstruo === undefined) throw new Error('Falta el Monstruo h');
  const a = new Anfitrion(motor, c, forzarDados(s, 4, 4), reloj, {
    retardoBotMs: 100,
    ...opciones,
  });
  return { a, reloj, monstruo };
}

/** j1 ataca y se deja vencer la ventana de Modificadores: el Monstruo muere. */
function matar(a: Anfitrion, reloj: RelojManual, monstruo: string): void {
  expect(a.enviar('j1', { tipo: 'ATACAR', uid: monstruo })).toBeNull();
  for (let i = 0; i < 1000 && !a.eventos.some((e) => e.tipo === 'monstruoMatado'); i++) {
    reloj.avanzar(100);
  }
  expect(a.eventos.some((e) => e.tipo === 'monstruoMatado')).toBe(true);
}

describe('Anfitrión: celebración de un Monstruo derrotado', () => {
  it('tras matar un Monstruo nadie puede jugar durante 4 s', () => {
    const { a, reloj, monstruo } = preparado(config(['humano', 'humano']));
    const versiones: number[] = [];
    a.suscribir(() => versiones.push(a.version));
    matar(a, reloj, monstruo);
    expect(a.celebracion).toEqual({
      id: 1,
      jugador: 'j1',
      carta: 'monstruo_h',
      duracionMs: 4000,
    });
    const restante = a.restanteCelebracionMs();
    expect(restante).not.toBeNull();
    expect(restante).toBeLessThanOrEqual(4000);
    expect(a.legales()).toEqual([]);
    expect(a.legalesDe('j1')).toEqual([]);
    expect(a.legalesDe('j2')).toEqual([]);
    expect(a.enviar('j1', { tipo: 'ROBAR' })).toBe('CELEBRACION');
    expect(a.validar({ tipo: 'ROBAR' })).toBe('CELEBRACION');
    expect(a.motivosDe('j1')).toContainEqual({ accion: { tipo: 'ROBAR' }, codigo: 'CELEBRACION' });
    expect(a.motivosDe('j1').every((m) => m.codigo === 'CELEBRACION')).toBe(true);

    const antes = versiones.length;
    reloj.avanzar(restante ?? 0);
    expect(a.celebracion).toBeNull();
    expect(a.restanteCelebracionMs()).toBeNull();
    expect(versiones.length).toBeGreaterThan(antes);
    // Al terminar, la partida se reanuda: j1 sigue con su turno.
    expect(a.legalesDe('j1')).toContainEqual({ tipo: 'ROBAR' });
    expect(a.enviar('j1', { tipo: 'ROBAR' })).toBeNull();
  });

  it('los bots no actúan hasta que termina', () => {
    // j1 es un bot; el test le hace atacar antes de que le toque pensar.
    const { a, reloj, monstruo } = preparado(config(['normal', 'humano']));
    matar(a, reloj, monstruo);
    expect(a.celebracion).not.toBeNull();
    const eventos = a.eventos.length;
    const pa = a.estado.turno.pa;
    reloj.avanzar((a.restanteCelebracionMs() ?? 0) - 1);
    expect(a.eventos).toHaveLength(eventos);
    expect(a.estado.turno).toMatchObject({ jugador: 'j1', pa });
    reloj.avanzar(1);
    expect(a.celebracion).toBeNull();
    reloj.avanzar(100);
    expect(a.eventos.length).toBeGreaterThan(eventos);
  });

  it('el límite por decisión se congela y conserva su tiempo', () => {
    const { a, reloj, monstruo } = preparado(config(['humano', 'humano'], { limiteDecisionS: 30 }));
    matar(a, reloj, monstruo);
    expect(a.plazoDecision?.jugador).toBe('j1');
    expect(a.restanteDecisionMs()).toBe(30_000);
    reloj.avanzar(3000);
    expect(a.restanteDecisionMs()).toBe(30_000);
    reloj.avanzar(1000);
    expect(a.celebracion).toBeNull();
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
    const heroe = a.estado.mazo.find((u) => a.estado.instancias[u] === 'heroe_mago');
    if (heroe === undefined) throw new Error('Sin Héroe');
    a.estado.mazo.splice(a.estado.mazo.indexOf(heroe), 1);
    a.estado.jugadores[0]?.mano.push(heroe);
    expect(a.enviar('j1', { tipo: 'JUGAR_CARTA', uid: heroe })).toBeNull();
    expect(a.estado.pila.at(-1)?.tipo).toBe('ventanaDesafio');
    const total = a.restanteMs() ?? 0;
    reloj.avanzar(1000);
    // Un Monstruo matado con la ventana abierta (p. ej. por un efecto): se simula el evento y se
    // fuerza la actualización del anfitrión con una desconexión breve.
    a.eventos.push({ tipo: 'monstruoMatado', jugador: 'j1', carta: 'monstruo_h' });
    a.desconectar('j2');
    a.reconectar('j2');
    expect(a.celebracion).not.toBeNull();
    expect(a.restanteMs()).toBeNull();
    expect(a.enviar('j2', { tipo: 'PASAR' })).toBe('CELEBRACION');
    reloj.avanzar(4000);
    expect(a.celebracion).toBeNull();
    expect(a.restanteMs()).toBe(total - 1000);
    expect(a.estado.pila.at(-1)?.tipo).toBe('ventanaDesafio');
    reloj.avanzar(total - 1000);
    expect(a.estado.pila.at(-1)?.tipo).not.toBe('ventanaDesafio');
  });

  it('varios Monstruos seguidos se celebran uno tras otro', () => {
    const { a, reloj, monstruo } = preparado(config(['humano', 'humano']));
    matar(a, reloj, monstruo);
    a.eventos.push({ tipo: 'monstruoMatado', jugador: 'j2', carta: 'monstruo_hh' });
    a.desconectar('j2');
    a.reconectar('j2');
    expect(a.celebracion).toMatchObject({ id: 1, carta: 'monstruo_h' });
    reloj.avanzar(a.restanteCelebracionMs() ?? 0);
    expect(a.celebracion).toEqual({
      id: 2,
      jugador: 'j2',
      carta: 'monstruo_hh',
      duracionMs: 4000,
    });
    expect(a.legales()).toEqual([]);
    reloj.avanzar(4000);
    expect(a.celebracion).toBeNull();
  });

  it('en este dispositivo, el traspaso espera a que termine la celebración', () => {
    const { a, reloj } = preparado(config(['humano', 'humano'], { modo: 'local' }));
    // Fin de turno de j1 y, a la vez, un Monstruo matado: primero se celebra, luego se pasa.
    a.eventos.push({ tipo: 'monstruoMatado', jugador: 'j1', carta: 'monstruo_h' });
    expect(a.enviar('j1', { tipo: 'FIN_TURNO' })).toBeNull();
    expect(a.celebracion).not.toBeNull();
    expect(a.traspaso).toBeNull();
    reloj.avanzar(4000);
    expect(a.celebracion).toBeNull();
    expect(a.traspaso).toBe('j2');
  });

  it('la misma carta celebrada dos veces seguidas lleva ids distintos', () => {
    const { a, reloj, monstruo } = preparado(config(['humano', 'humano']));
    matar(a, reloj, monstruo);
    a.eventos.push({ tipo: 'monstruoMatado', jugador: 'j1', carta: 'monstruo_h' });
    a.desconectar('j2');
    a.reconectar('j2');
    const primera = a.celebracion;
    reloj.avanzar(a.restanteCelebracionMs() ?? 0);
    expect(a.celebracion).toMatchObject({ jugador: 'j1', carta: 'monstruo_h' });
    expect(a.celebracion?.id).not.toBe(primera?.id);
  });

  describe('en este dispositivo, nada avanza durante la celebración', () => {
    /** j1 juega un Héroe (ventana de desafío) y se celebra un Monstruo con la ventana abierta. */
    function ventanaYCelebracion(responde: boolean) {
      const { a, reloj } = preparado(config(['humano', 'humano'], { modo: 'local' }));
      const heroe = a.estado.mazo.find((u) => a.estado.instancias[u] === 'heroe_mago');
      if (heroe === undefined) throw new Error('Sin Héroe');
      a.estado.mazo.splice(a.estado.mazo.indexOf(heroe), 1);
      a.estado.jugadores[0]?.mano.push(heroe);
      expect(a.enviar('j1', { tipo: 'JUGAR_CARTA', uid: heroe })).toBeNull();
      expect(a.alMando).toBe('j1');
      if (responde) a.responder('j2');
      a.eventos.push({ tipo: 'monstruoMatado', jugador: 'j1', carta: 'monstruo_h' });
      a.desconectar('j1');
      a.reconectar('j1');
      expect(a.celebracion).not.toBeNull();
      return { a, reloj };
    }

    it('responder no hace nada', () => {
      const { a, reloj } = ventanaYCelebracion(false);
      a.responder('j2');
      expect(a.respondiendo).toBeNull();
      expect(a.traspaso).toBeNull();
      expect(a.restanteMs()).toBeNull();
      reloj.avanzar(4000);
      expect(a.respondedoresPosibles()).toEqual(['j2']);
      a.responder('j2');
      expect(a.respondiendo).toBe('j2');
    });

    it('confirmarTraspaso no hace nada (el traspaso está diferido)', () => {
      const { a, reloj } = ventanaYCelebracion(true);
      expect(a.traspaso).toBeNull();
      a.confirmarTraspaso();
      expect(a.alMando).toBe('j1');
      reloj.avanzar(4000);
      expect(a.traspaso).toBe('j2');
      a.confirmarTraspaso();
      expect(a.alMando).toBe('j2');
    });

    it('terminarRespuesta no hace nada: ni reanuda la cuenta ni pasa el dispositivo', () => {
      const { a, reloj } = ventanaYCelebracion(true);
      a.terminarRespuesta();
      expect(a.respondiendo).toBe('j2');
      expect(a.restanteMs()).toBeNull();
      expect(a.traspaso).toBeNull();
      reloj.avanzar(4000);
      // Sigue respondiendo (cuenta en pausa) y puede terminar ahora.
      expect(a.respondiendo).toBe('j2');
      expect(a.restanteMs()).toBeNull();
      a.confirmarTraspaso();
      a.terminarRespuesta();
      expect(a.respondiendo).toBeNull();
      expect(a.restanteMs()).not.toBeNull();
    });
  });

  it('el Monstruo que da la victoria también se celebra (la victoria va después)', () => {
    const { a, reloj, monstruo } = preparado(config(['humano', 'humano']));
    const j1 = a.estado.jugadores[0];
    if (j1 === undefined) throw new Error('Sin j1');
    j1.monstruos.push(...a.estado.mazoMonstruos.splice(0, 2));
    matar(a, reloj, monstruo);
    expect(a.estado.ganador?.jugador).toBe('j1');
    expect(a.celebracion?.carta).toBe('monstruo_h');
    reloj.avanzar(4000);
    expect(a.celebracion).toBeNull();
    expect(a.estado.ganador?.jugador).toBe('j1');
  });

  it('destruir cancela la celebración', () => {
    const { a, reloj, monstruo } = preparado(config(['humano', 'humano']));
    matar(a, reloj, monstruo);
    a.destruir();
    expect(reloj.pendientes).toBe(0);
  });

  it('celebracionMs: 0 la desactiva', () => {
    const { a, reloj, monstruo } = preparado(config(['humano', 'humano']), { celebracionMs: 0 });
    matar(a, reloj, monstruo);
    expect(a.celebracion).toBeNull();
    expect(a.restanteCelebracionMs()).toBeNull();
    expect(a.enviar('j1', { tipo: 'ROBAR' })).toBeNull();
  });
});
