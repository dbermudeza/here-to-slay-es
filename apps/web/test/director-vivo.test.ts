// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { darCarta, ponerHeroe } from '../../../packages/engine/test/fixtures';
import { DirectorVivo } from '../src/juego/director-vivo';
import { restaurarGuardado, serializarGuardado } from '../src/juego/guardado';
import { config, directorEn, motor, RelojFalso } from './utilidades';

const cima = (d: DirectorVivo) => d.estado.pila[d.estado.pila.length - 1];

describe('Director en vivo: ventanas y cuenta regresiva', () => {
  it('la ventana de Modificadores se cierra sola al vencer la cuenta (5 s)', () => {
    let heroe = '';
    const { director, reloj } = directorEn(config('local', ['humano', 'humano']), (s) => {
      heroe = ponerHeroe(s, 'j1', 'bardo');
    });
    expect(director.enviar('j1', { tipo: 'TIRAR_HEROE', uid: heroe })).toBeNull();
    expect(cima(director)?.tipo).toBe('ventanaModificadores');
    expect(director.restanteMs()).toBe(5000);
    reloj.avanzar(4999);
    expect(cima(director)?.tipo).toBe('ventanaModificadores');
    reloj.avanzar(1);
    expect(cima(director)).toBeUndefined();
    expect(director.eventos.some((e) => e.tipo === 'tiradaHeroe')).toBe(true);
  });

  it('cada Modificador reinicia la cuenta', () => {
    let heroe = '';
    let mod = '';
    const { director, reloj } = directorEn(config('local', ['humano', 'humano']), (s) => {
      heroe = ponerHeroe(s, 'j1', 'bardo');
      mod = darCarta(s, 'j1', 'modificador_mas4');
    });
    director.enviar('j1', { tipo: 'TIRAR_HEROE', uid: heroe });
    reloj.avanzar(4000);
    expect(
      director.enviar('j1', { tipo: 'JUGAR_MODIFICADOR', uid: mod, valor: 4, tirada: 0 }),
    ).toBeNull();
    expect(director.restanteMs()).toBe(5000);
    reloj.avanzar(4500);
    expect(cima(director)?.tipo).toBe('ventanaModificadores');
    reloj.avanzar(500);
    expect(cima(director)).toBeUndefined();
  });

  it('en modo local, responder pausa la cuenta y pasa el dispositivo; terminar la reanuda', () => {
    let heroe = '';
    const { director, reloj } = directorEn(config('local', ['humano', 'humano']), (s) => {
      heroe = ponerHeroe(s, 'j1', 'bardo');
    });
    director.enviar('j1', { tipo: 'TIRAR_HEROE', uid: heroe });
    expect(director.respondedoresPosibles()).toEqual(['j1', 'j2']);
    director.responder('j2');
    expect(director.traspaso).toBe('j2');
    expect(director.restanteMs()).toBeNull();
    reloj.avanzar(60_000);
    expect(cima(director)?.tipo).toBe('ventanaModificadores');
    director.confirmarTraspaso();
    expect(director.observador).toBe('j2');
    director.terminarRespuesta();
    // El dispositivo vuelve al jugador del turno y la cuenta empieza de nuevo.
    expect(director.traspaso).toBe('j1');
    expect(director.restanteMs()).toBe(5000);
    reloj.avanzar(5000);
    expect(cima(director)).toBeUndefined();
  });

  it('la ventana de desafío se cierra al vencer su cuenta (nadie desafía)', () => {
    let h = '';
    const { director, reloj } = directorEn(config('local', ['humano', 'humano', 'humano']), (s) => {
      h = darCarta(s, 'j1', 'heroe_mago');
    });
    director.enviar('j1', { tipo: 'JUGAR_CARTA', uid: h });
    expect(cima(director)?.tipo).toBe('ventanaDesafio');
    reloj.avanzar(10_000);
    expect(cima(director)?.tipo).toBe('tiradaInmediata');
  });
});

describe('Director en vivo: pasar el dispositivo (modo local)', () => {
  it('al cambiar de turno hay que pasar el dispositivo y no hay acciones hasta confirmarlo', () => {
    const { director } = directorEn(config('local', ['humano', 'humano']));
    expect(director.observador).toBe('j1');
    director.enviar('j1', { tipo: 'FIN_TURNO' });
    expect(director.traspaso).toBe('j2');
    expect(director.legales()).toEqual([]);
    director.confirmarTraspaso();
    expect(director.observador).toBe('j2');
    expect(director.legales().length).toBeGreaterThan(0);
  });

  it('la vista solo muestra la mano de quien tiene el dispositivo', () => {
    const { director } = directorEn(config('local', ['humano', 'humano']), (s) => {
      darCarta(s, 'j1', 'desafio');
      darCarta(s, 'j2', 'desafio');
    });
    const v = director.vista();
    expect(v.jugadores.find((j) => j.id === 'j1')?.mano).toHaveLength(1);
    expect(v.jugadores.find((j) => j.id === 'j2')?.mano).toBeNull();
  });
});

describe('Director en vivo: bots', () => {
  it('el humano ve siempre su propia vista y nunca las manos de los bots', () => {
    const { director, reloj } = directorEn(config('bots', ['humano', 'normal', 'facil']));
    director.enviar('j1', { tipo: 'FIN_TURNO' });
    for (let i = 0; i < 50 && director.estado.turno.jugador !== 'j1'; i++) reloj.avanzar(1000);
    const v = director.vista();
    expect(v.yo).toBe('j1');
    for (const j of v.jugadores) if (j.id !== 'j1') expect(j.mano).toBeNull();
    expect(director.estado.turno.jugador).toBe('j1');
  });

  it('una partida solo entre bots llega hasta el final avanzando el reloj', () => {
    const reloj = new RelojFalso();
    const director = DirectorVivo.nueva(
      motor,
      config('bots', ['normal', 'normal', 'facil'], 'solo-bots'),
      reloj,
      {
        retardoBotMs: 50,
      },
    );
    for (let i = 0; i < 200_000 && director.estado.ganador === null; i++) reloj.avanzar(100);
    expect(director.estado.ganador).not.toBeNull();
    expect(reloj.pendientes).toBe(0);
  });
});

describe('Guardado', () => {
  it('serializar y restaurar recupera la misma partida y el historial', () => {
    const { director } = directorEn(config('bots', ['humano', 'normal']));
    director.enviar('j1', { tipo: 'ROBAR' });
    const texto = serializarGuardado(director);
    const restaurado = restaurarGuardado(motor, texto, new RelojFalso());
    expect(restaurado.estado).toEqual(director.estado);
    expect(restaurado.config).toEqual(director.config);
    expect(restaurado.eventos).toEqual(director.eventos);
  });

  it('rechaza archivos que no son partidas guardadas', () => {
    expect(() => restaurarGuardado(motor, '{"hola":1}')).toThrow(/no es una partida/);
    expect(() => restaurarGuardado(motor, 'no json')).toThrow(/JSON/);
  });
});
