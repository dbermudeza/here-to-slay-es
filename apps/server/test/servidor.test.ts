import { BOTS } from '@hts/bots';
import { crearRng, siguienteRng } from '@hts/engine';
import { MENSAJES, type Sesion } from '@hts/anfitrion';
import { afterEach, describe, expect, it } from 'vitest';
import { nuevoMotor } from '../../../packages/engine/test/fixtures';
import {
  arrancar,
  conectar,
  esperar,
  parar,
  pausa,
  pedir,
  salaCon,
  type Cliente,
  type Entorno,
} from './utilidades';

const motor = nuevoMotor();
let e: Entorno | null = null;

afterEach(async () => {
  if (e !== null) await parar(e);
  e = null;
});

async function entorno(): Promise<Entorno> {
  e = await arrancar(motor);
  return e;
}

describe('Salas y lobby', () => {
  it('crear una sala devuelve un código de 5 caracteres y la sesión del creador', async () => {
    const x = await entorno();
    const c = conectar(x);
    const r = await pedir<Sesion>(c, MENSAJES.crear, { nombre: 'Ana' });
    expect(r).toMatchObject({ ok: true, jugador: 'j1' });
    if (!r.ok) return;
    expect(r.codigo).toMatch(/^[A-Z0-9]{5}$/);
    expect(r.token).toMatch(/^[a-f0-9]{32}$/);
    await esperar(() => c.sala !== null);
    expect(c.sala).toMatchObject({ codigo: r.codigo, creador: 'j1', fase: 'lobby' });
  });

  it('unirse: código inexistente, nombre repetido y sala llena', async () => {
    const x = await entorno();
    const [creador] = await salaCon(x, ['Ana']);
    const codigo = creador?.sala?.codigo ?? '';
    const otro = conectar(x);
    expect(await pedir(otro, MENSAJES.unirse, { codigo: 'ZZZZZ', nombre: 'Beto' })).toEqual({
      ok: false,
      error: 'SALA_NO_EXISTE',
    });
    expect(await pedir(otro, MENSAJES.unirse, { codigo, nombre: 'ana' })).toEqual({
      ok: false,
      error: 'NOMBRE_REPETIDO',
    });
    expect(await pedir(otro, MENSAJES.unirse, { codigo: 'mal', nombre: 'Beto' })).toEqual({
      ok: false,
      error: 'DATOS_INVALIDOS',
    });
    for (const n of ['B', 'C', 'D', 'E', 'F'])
      expect((await pedir(conectar(x), MENSAJES.unirse, { codigo, nombre: n })).ok).toBe(true);
    expect(await pedir(otro, MENSAJES.unirse, { codigo, nombre: 'G' })).toEqual({
      ok: false,
      error: 'SALA_LLENA',
    });
  });

  it('solo el creador cambia opciones, añade bots y empieza; hace falta que todos estén listos', async () => {
    const x = await entorno();
    const [ana, beto] = await salaCon(x, ['Ana', 'Beto']);
    if (ana === undefined || beto === undefined) return;
    await pedir(beto, MENSAJES.listo, { listo: false });
    expect(await pedir(beto, MENSAJES.empezar)).toEqual({ ok: false, error: 'SOLO_CREADOR' });
    expect(await pedir(beto, MENSAJES.anadirBot, { nivel: 'facil' })).toEqual({
      ok: false,
      error: 'SOLO_CREADOR',
    });
    expect(await pedir(ana, MENSAJES.empezar)).toEqual({ ok: false, error: 'NO_ESTAN_LISTOS' });
    const opciones = {
      reglas: 'dificil',
      segundos: { desafio: 8, modificadores: 4, modificadoresDesafio: 8 },
      limiteDecisionS: 60,
    };
    expect(await pedir(ana, MENSAJES.opciones, opciones)).toEqual({ ok: true });
    expect(await pedir(ana, MENSAJES.anadirBot, { nivel: 'normal' })).toEqual({ ok: true });
    await pedir(beto, MENSAJES.listo, { listo: true });
    await esperar(
      () =>
        beto.sala?.asientos.length === 3 &&
        beto.sala.asientos.every((a) => a.listo || a.id === 'j1'),
    );
    expect(beto.sala?.opciones).toEqual(opciones);
    expect(beto.sala?.asientos.map((a) => a.control)).toEqual(['humano', 'humano', 'normal']);
    expect(await pedir(ana, MENSAJES.empezar)).toEqual({ ok: true });
    await esperar(() => ana.partida !== null && beto.partida !== null);
    expect(ana.partida?.yo).toBe('j1');
    expect(beto.partida?.yo).toBe('j2');
    expect(beto.partida?.modo).toBe('dificil');
    expect(beto.sala?.fase).toBe('partida');
  });

  it('salir del lobby libera el asiento; si sale el creador, pasa a otro humano', async () => {
    const x = await entorno();
    const [ana, beto] = await salaCon(x, ['Ana', 'Beto']);
    if (ana === undefined || beto === undefined) return;
    await pedir(ana, MENSAJES.salir);
    await esperar(() => beto.sala?.asientos.length === 1);
    expect(beto.sala?.creador).toBe('j2');
  });
});

describe('Partida en línea', () => {
  async function partidaDeDos(): Promise<{ x: Entorno; ana: Cliente; beto: Cliente }> {
    const x = await entorno();
    const [ana, beto] = await salaCon(x, ['Ana', 'Beto']);
    if (ana === undefined || beto === undefined) throw new Error('sin clientes');
    await pedir(ana, MENSAJES.empezar);
    await esperar(() => ana.partida !== null && beto.partida !== null);
    return { x, ana, beto };
  }

  it('cada jugador ve su mano y no la del rival', async () => {
    const { ana } = await partidaDeDos();
    const v = ana.partida?.vista;
    expect(v?.jugadores.find((j) => j.id === 'j1')?.mano?.length).toBeGreaterThan(0);
    expect(v?.jugadores.find((j) => j.id === 'j2')?.mano).toBeNull();
  });

  it('las acciones se aplican como el jugador de la conexión; las ilegales y malformadas se rechazan', async () => {
    const { ana, beto } = await partidaDeDos();
    const activo = ana.partida?.vista.turno.jugador === 'j1' ? ana : beto;
    const otro = activo === ana ? beto : ana;
    expect(await pedir(otro, MENSAJES.accion, { accion: { tipo: 'ROBAR' } })).toEqual({
      ok: false,
      error: 'NO_ES_TU_TURNO',
    });
    expect(await pedir(otro, MENSAJES.accion, { accion: { tipo: 'ROBAR' }, actor: 'j1' })).toEqual({
      ok: false,
      error: 'DATOS_INVALIDOS',
    });
    expect(
      await pedir(otro, MENSAJES.accion, { accion: { tipo: 'CERRAR_VENTANA', secuencia: 1 } }),
    ).toEqual({ ok: false, error: 'DATOS_INVALIDOS' });
    const antes = otro.version;
    expect(await pedir(activo, MENSAJES.accion, { accion: { tipo: 'ROBAR' } })).toEqual({
      ok: true,
    });
    await esperar(() => otro.version > antes);
    expect(otro.partida?.vista.turno.pa).toBe(2);
    // El otro jugador ve que el rival roba, pero no qué carta.
    expect(otro.partida?.eventos).toContainEqual(
      expect.objectContaining({ tipo: 'cartaRobada', uid: null, carta: null }),
    );
  });

  it('rendirse (D-43): por red y en cualquier momento; si queda un solo humano, gana', async () => {
    const { ana, beto } = await partidaDeDos();
    const otro = ana.partida?.vista.turno.jugador === 'j1' ? beto : ana;
    const queda = otro === ana ? beto : ana;
    expect(await pedir(otro, MENSAJES.accion, { accion: { tipo: 'RENDIRSE' } })).toEqual({
      ok: true,
    });
    await esperar(() => queda.partida?.vista.ganador !== null);
    expect(queda.partida?.vista.ganador).toEqual({
      jugador: queda.partida?.yo,
      motivo: 'rendicion',
    });
    await esperar(() => queda.sala?.fase === 'terminada');
  });

  it('los motivos explican las acciones no disponibles', async () => {
    const { ana, beto } = await partidaDeDos();
    const otro = ana.partida?.vista.turno.jugador === 'j1' ? beto : ana;
    expect(otro.partida?.motivos).toContainEqual({
      accion: { tipo: 'ROBAR' },
      codigo: 'NO_ES_TU_TURNO',
    });
  });

  it('desconexión: espera de 60 s, bot sustituto y reconexión con el token', async () => {
    const x = await entorno();
    const ana = conectar(x);
    const r = await pedir<Sesion>(ana, MENSAJES.crear, { nombre: 'Ana' });
    if (!r.ok) throw new Error('crear');
    const beto = conectar(x);
    await pedir(beto, MENSAJES.unirse, { codigo: r.codigo, nombre: 'Beto' });
    await pedir(beto, MENSAJES.listo, { listo: true });
    await pedir(ana, MENSAJES.empezar);
    await esperar(() => beto.partida !== null);

    ana.socket.disconnect();
    await esperar(() => beto.partida?.conexiones.j1 === 'desconectado');
    expect(beto.sala?.asientos.find((a) => a.id === 'j1')?.conectado).toBe(false);
    x.reloj.avanzar(60_000);
    await esperar(() => beto.partida?.conexiones.j1 === 'sustituido');

    const vuelta = conectar(x);
    const re = await pedir<Sesion>(vuelta, MENSAJES.reanudar, { codigo: r.codigo, token: r.token });
    expect(re).toMatchObject({ ok: true, jugador: 'j1' });
    await esperar(() => vuelta.partida !== null && beto.partida?.conexiones.j1 === 'conectado');
    expect(vuelta.partida?.yo).toBe('j1');
    // El primer estado tras reconectar trae el historial completo.
    expect(vuelta.recibidos[0]?.reinicio).toBe(true);
    expect(vuelta.recibidos[0]?.eventos.length).toBeGreaterThan(0);
    expect(
      await pedir(conectar(x), MENSAJES.reanudar, { codigo: r.codigo, token: 'f'.repeat(32) }),
    ).toEqual({
      ok: false,
      error: 'SESION_INVALIDA',
    });
  });

  it('con un bot en la sala, el bot juega sus turnos', async () => {
    const x = await entorno();
    const ana = conectar(x);
    await pedir(ana, MENSAJES.crear, { nombre: 'Ana' });
    await pedir(ana, MENSAJES.anadirBot, { nivel: 'normal' });
    await pedir(ana, MENSAJES.empezar);
    await esperar(() => ana.partida !== null);
    // Ana termina sus turnos en cuanto puede; el resto del tiempo avanza el reloj.
    for (let i = 0; i < 2000 && (ana.partida?.vista.turno.numero ?? 0) < 4; i++) {
      const p = ana.partida;
      const accion = p?.legales.find((a) => a.tipo === 'FIN_TURNO') ?? p?.legales[0];
      if (accion !== undefined && p?.vista.ganador === null) {
        const antes = ana.version;
        await pedir(ana, MENSAJES.accion, { accion });
        await esperar(() => ana.version > antes);
      } else {
        x.reloj.avanzar(1000);
        await pausa(1);
      }
    }
    const turnosBot = ana.recibidos.filter((r) => r.vista.turno.jugador === 'j2').length;
    expect(turnosBot).toBeGreaterThan(0);
    expect(ana.partida?.vista.turno.numero).toBeGreaterThanOrEqual(4);
  }, 30_000);

  it('una partida completa entre 3 clientes (jugando con la lógica del bot) llega a la victoria', async () => {
    const x = await entorno();
    const clientes = await salaCon(x, ['Ana', 'Beto', 'Cata']);
    const [creador] = clientes;
    if (creador === undefined) return;
    await pedir(creador, MENSAJES.empezar);
    await esperar(() => clientes.every((c) => c.partida !== null));
    const azares = clientes.map((_, i) => {
      let rng = crearRng(`cliente${i}`);
      return () => {
        const [v, s] = siguienteRng(rng);
        rng = s;
        return v;
      };
    });
    for (
      let paso = 0;
      paso < 6000 && clientes.some((c) => c.partida?.vista.ganador === null);
      paso++
    ) {
      let actuo = false;
      for (const [i, c] of clientes.entries()) {
        const p = c.partida;
        if (p === null || p.vista.ganador !== null || p.legales.length === 0) continue;
        const accion = BOTS.normal.elegir({
          vista: p.vista,
          legales: p.legales,
          catalogo: motor.catalogo,
          azar: azares[i] ?? Math.random,
        });
        if (accion === null) continue;
        const antes = c.version;
        const r = await pedir(c, MENSAJES.accion, { accion });
        if (r.ok) {
          actuo = true;
          await esperar(() => c.version > antes);
          break;
        }
      }
      if (!actuo) {
        x.reloj.avanzar(1000);
        await pausa(1);
      }
    }
    await esperar(() =>
      clientes.every((c) => c.partida?.vista.ganador !== null && c.sala?.fase === 'terminada'),
    );
    const ganador = clientes[0]?.partida?.vista.ganador?.jugador;
    expect(clientes.every((c) => c.partida?.vista.ganador?.jugador === ganador)).toBe(true);

    // El creador vuelve a la sala para jugar otra.
    expect(await pedir(creador, MENSAJES.volverALaSala)).toEqual({ ok: true });
    await esperar(() => clientes.every((c) => c.sala?.fase === 'lobby'));

    // Información oculta: ningún jugador recibió jamás una carta de una mano ajena.
    for (const { jugador, enviado, real } of x.enviados) {
      const texto = JSON.stringify(enviado);
      for (const j of real.jugadores) {
        if (j.id === jugador) continue;
        for (const uid of j.mano) {
          const visibleAlJugador = enviado.vista.pila.some(
            (d) =>
              d.tipo === 'decision' &&
              d.jugador === jugador &&
              d.pregunta !== null &&
              JSON.stringify(d.pregunta).includes(`"${uid}"`),
          );
          if (!visibleAlJugador)
            expect(texto, `${jugador} recibió ${uid}`).not.toContain(`"${uid}"`);
        }
      }
      for (const uid of real.mazo) expect(texto).not.toContain(`"${uid}"`);
    }
  }, 120_000);
});

describe('Salas abandonadas', () => {
  it('se borran tras el tiempo de inactividad sin nadie conectado', async () => {
    const x = await entorno();
    const [ana] = await salaCon(x, ['Ana']);
    ana?.socket.disconnect();
    await esperar(
      () =>
        x.servidor.salas.total === 1 &&
        (x.servidor.salas.obtener(ana?.sala?.codigo ?? '')?.conectados ?? 1) === 0,
    );
    expect(x.servidor.salas.limpiar(0, 1000)).toEqual([]);
    expect(x.servidor.salas.limpiar(1000, 1000)).toHaveLength(1);
    expect(x.servidor.salas.total).toBe(0);
  });
});
