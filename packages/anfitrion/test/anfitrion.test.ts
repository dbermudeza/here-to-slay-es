import { describe, expect, it } from 'vitest';
import { escenario, nuevoMotor } from '../../engine/test/fixtures';
import {
  aConfigPartida,
  Anfitrion,
  leerAccion,
  RelojManual,
  SEGUNDOS_POR_DEFECTO,
  type ConfigAnfitrion,
  type Control,
} from '../src';

const motor = nuevoMotor();

function config(controles: Control[], extra: Partial<ConfigAnfitrion> = {}): ConfigAnfitrion {
  return {
    modo: 'enLinea',
    reglas: 'normal',
    semilla: 'anfitrion',
    segundos: SEGUNDOS_POR_DEFECTO,
    jugadores: controles.map((control, i) => ({ id: `j${i + 1}`, nombre: `J${i + 1}`, control })),
    ...extra,
  };
}

function anfitrionEn(c: ConfigAnfitrion) {
  const reloj = new RelojManual();
  const s = escenario(motor.crearPartida(aConfigPartida(c)).state, { turnoDe: 'j1' });
  return {
    a: new Anfitrion(motor, c, s, reloj, { retardoBotMs: 100, pausaResultadoMs: 0 }),
    reloj,
  };
}

describe('Anfitrión en línea: desconexiones', () => {
  it('un jugador desconectado sigue siendo humano durante la espera de 60 s', () => {
    const { a, reloj } = anfitrionEn(config(['humano', 'humano']));
    a.desconectar('j1');
    expect(a.conexion('j1')).toBe('desconectado');
    reloj.avanzar(59_000);
    expect(a.esBot('j1')).toBe(false);
    expect(a.estado.turno.jugador).toBe('j1');
  });

  it('pasados 60 s, un bot normal juega por él', () => {
    const { a, reloj } = anfitrionEn(config(['humano', 'humano']));
    a.desconectar('j1');
    reloj.avanzar(60_000);
    expect(a.conexion('j1')).toBe('sustituido');
    expect(a.esBot('j1')).toBe(true);
    for (let i = 0; i < 100 && a.estado.turno.jugador === 'j1'; i++) reloj.avanzar(1000);
    expect(a.estado.turno.jugador).toBe('j2');
  });

  it('al reconectar recupera el control de su asiento', () => {
    const { a, reloj } = anfitrionEn(config(['humano', 'humano']));
    a.desconectar('j1');
    reloj.avanzar(60_000);
    a.reconectar('j1');
    expect(a.conexion('j1')).toBe('conectado');
    expect(a.esBot('j1')).toBe(false);
    const turno = a.estado.turno.numero;
    reloj.avanzar(30_000);
    expect(a.estado.turno.numero).toBe(turno);
  });

  it('reconectar durante la espera cancela la sustitución', () => {
    const { a, reloj } = anfitrionEn(config(['humano', 'humano']));
    a.desconectar('j1');
    reloj.avanzar(30_000);
    a.reconectar('j1');
    reloj.avanzar(60_000);
    expect(a.conexion('j1')).toBe('conectado');
  });
});

describe('Anfitrión: límite de tiempo por decisión', () => {
  it('sin límite, un humano puede tardar lo que quiera', () => {
    const { a, reloj } = anfitrionEn(config(['humano', 'humano']));
    reloj.avanzar(600_000);
    expect(a.plazoDecision).toBeNull();
    expect(a.estado.turno).toMatchObject({ jugador: 'j1', pa: 3 });
  });

  it('con límite, si se agota decide el bot por él (una acción)', () => {
    const { a, reloj } = anfitrionEn(config(['humano', 'humano'], { limiteDecisionS: 30 }));
    expect(a.plazoDecision).toEqual({ jugador: 'j1', fin: 30_000 });
    reloj.avanzar(29_999);
    expect(a.eventos).toHaveLength(0);
    reloj.avanzar(1);
    expect(a.eventos.length).toBeGreaterThan(0);
    // Tras la acción del bot, el humano vuelve a tener su propio plazo.
    expect(a.esBot('j1')).toBe(false);
  });

  it('actuar a tiempo reinicia el plazo', () => {
    const { a, reloj } = anfitrionEn(config(['humano', 'humano'], { limiteDecisionS: 30 }));
    reloj.avanzar(20_000);
    a.enviar('j1', { tipo: 'ROBAR' });
    expect(a.restanteDecisionMs()).toBe(30_000);
  });
});

describe('Anfitrión: consultas por jugador', () => {
  it('vista, acciones legales y motivos de cada jugador', () => {
    const { a } = anfitrionEn(config(['humano', 'humano']));
    expect(a.vistaDe('j2').yo).toBe('j2');
    expect(a.legalesDe('j2')).toEqual([]);
    expect(a.motivosDe('j2')).toContainEqual({
      accion: { tipo: 'ROBAR' },
      codigo: 'NO_ES_TU_TURNO',
    });
    expect(a.motivosDe('j1').find((m) => m.accion.tipo === 'ROBAR')).toBeUndefined();
  });
});

describe('Protocolo: validación de acciones recibidas por red', () => {
  it('acepta acciones bien formadas', () => {
    expect(leerAccion({ tipo: 'ROBAR' })).toEqual({ tipo: 'ROBAR' });
    expect(leerAccion({ tipo: 'JUGAR_CARTA', uid: 'x#1' })).toEqual({
      tipo: 'JUGAR_CARTA',
      uid: 'x#1',
    });
    expect(leerAccion({ tipo: 'RESPONDER', respuesta: { cartas: ['a#1'] } })).toEqual({
      tipo: 'RESPONDER',
      respuesta: { cartas: ['a#1'] },
    });
  });

  it('rechaza acciones del sistema, campos extra y tipos incorrectos', () => {
    expect(leerAccion({ tipo: 'CERRAR_VENTANA', secuencia: 1 })).toBeNull();
    expect(leerAccion({ tipo: 'ROBAR', actor: 'j2' })).toBeNull();
    expect(leerAccion({ tipo: 'TIRAR_HEROE', uid: 5 })).toBeNull();
    expect(leerAccion({ tipo: 'RESPONDER', respuesta: { cartas: 'a' } })).toBeNull();
    expect(leerAccion('ROBAR')).toBeNull();
  });
});

describe('Rendirse (D-43)', () => {
  it('en línea, si un humano se rinde y queda otro humano, este gana aunque haya bots', () => {
    const { a } = anfitrionEn(config(['humano', 'humano', 'normal']));
    expect(a.enviar('j2', { tipo: 'RENDIRSE' })).toBeNull();
    expect(a.estado.ganador).toEqual({ jugador: 'j1', motivo: 'rendicion' });
  });

  it('contra bots, si el humano se rinde los bots juegan hasta que uno gana', () => {
    const { a, reloj } = anfitrionEn(config(['humano', 'normal', 'normal'], { modo: 'bots' }));
    expect(a.actuar({ tipo: 'RENDIRSE' })).toBeNull();
    expect(a.estado.ganador).toBeNull();
    expect(a.legales()).toEqual([]);
    for (let i = 0; i < 20_000 && a.estado.ganador === null; i++) reloj.avanzar(1000);
    expect(a.estado.ganador).not.toBeNull();
    expect(a.estado.ganador?.jugador).not.toBe('j1');
    expect(a.estado.ganador?.motivo).not.toBe('rendicion');
  });

  it('en este dispositivo, quien se ha rendido ya no puede responder en las ventanas', () => {
    const { a } = anfitrionEn(config(['humano', 'humano', 'humano'], { modo: 'local' }));
    a.enviar('j3', { tipo: 'RENDIRSE' });
    const heroe = a.estado.mazo.find((u) => a.estado.instancias[u]?.startsWith('heroe_'));
    if (heroe === undefined) throw new Error('Sin Héroes en el mazo');
    const j1 = a.estado.jugadores[0];
    if (j1 === undefined) throw new Error('Sin j1');
    // Le damos un Héroe a j1 y lo juega: se abre la ventana de desafío.
    a.estado.mazo.splice(a.estado.mazo.indexOf(heroe), 1);
    j1.mano.push(heroe);
    expect(a.enviar('j1', { tipo: 'JUGAR_CARTA', uid: heroe })).toBeNull();
    expect(a.respondedoresPosibles()).toEqual(['j2']);
  });

  it('la acción RENDIRSE llega por red', () => {
    expect(leerAccion({ tipo: 'RENDIRSE' })).toEqual({ tipo: 'RENDIRSE' });
    expect(leerAccion({ tipo: 'RENDIRSE', extra: 1 })).toBeNull();
  });
});
