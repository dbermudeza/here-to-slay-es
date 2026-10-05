import { MENSAJES, type Ack, type EstadoTunel, type InfoServidor } from '@hts/anfitrion';
import { io, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { nuevoMotor } from '../../../packages/engine/test/fixtures';
import { crearServidor, esDelEquipoServidor, type ServidorHts } from '../src/servidor';
import type { OpcionesTunel } from '../src/tunel';
import { esperar } from './utilidades';

/** Un "cloudflared" falso: escribe una dirección como la real y se queda abierto. */
const FALSO: OpcionesTunel = {
  comando: process.execPath,
  argumentos: (puerto) => [
    '-e',
    `console.error('INF |  https://prueba-${puerto}.trycloudflare.com  |'); setInterval(() => {}, 1000);`,
  ],
};

let servidor: ServidorHts | null = null;
const sockets: Socket[] = [];

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await servidor?.cerrar();
  servidor = null;
});

interface Conexion {
  socket: Socket;
  info: InfoServidor | null;
  tunel: EstadoTunel | null;
}

async function arrancar(tunel: OpcionesTunel): Promise<number> {
  servidor = crearServidor({ motor: nuevoMotor(), tunel });
  return servidor.escuchar(0, '127.0.0.1');
}

function conectar(puerto: number, cabeceras: Record<string, string> = {}): Conexion {
  const socket = io(`http://127.0.0.1:${puerto}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: cabeceras,
  });
  sockets.push(socket);
  const c: Conexion = { socket, info: null, tunel: null };
  socket.on(MENSAJES.infoServidor, (i: InfoServidor) => {
    c.info = i;
  });
  socket.on(MENSAJES.estadoTunel, (t: EstadoTunel) => {
    c.tunel = t;
  });
  return c;
}

const pedir = (c: Conexion, mensaje: string): Promise<Ack<object>> =>
  new Promise((ok) => c.socket.emit(mensaje, {}, ok));

describe('Túnel de Cloudflare desde la app', () => {
  it('solo el propio equipo del servidor puede abrirlo; la dirección llega a todos', async () => {
    const puerto = await arrancar(FALSO);
    const anfitrion = conectar(puerto);
    // Una visita por el túnel también llega desde localhost, pero con las cabeceras de Cloudflare.
    const invitado = conectar(puerto, { 'cf-connecting-ip': '203.0.113.7' });
    await esperar(() => anfitrion.info !== null && invitado.info !== null);
    expect(anfitrion.info?.esEquipoServidor).toBe(true);
    expect(invitado.info).toEqual({ esEquipoServidor: false, redLocal: null });
    expect(anfitrion.tunel).toEqual({ fase: 'apagado', url: null, error: null });

    expect(await pedir(invitado, MENSAJES.abrirTunel)).toEqual({
      ok: false,
      error: 'SOLO_EQUIPO_SERVIDOR',
    });
    expect(await pedir(anfitrion, MENSAJES.abrirTunel)).toEqual({ ok: true });
    await esperar(() => invitado.tunel?.fase === 'activo', 10_000);
    expect(invitado.tunel?.url).toBe(`https://prueba-${puerto}.trycloudflare.com`);
    expect(anfitrion.tunel?.url).toBe(invitado.tunel?.url);

    expect(await pedir(invitado, MENSAJES.cerrarTunel)).toMatchObject({ ok: false });
    expect(await pedir(anfitrion, MENSAJES.cerrarTunel)).toEqual({ ok: true });
    await esperar(() => invitado.tunel?.fase === 'apagado');
  });

  it('si cloudflared no está instalado, lo dice', async () => {
    const puerto = await arrancar({ comando: 'cloudflared-que-no-existe-hts' });
    const c = conectar(puerto);
    await esperar(() => c.info !== null);
    await pedir(c, MENSAJES.abrirTunel);
    await esperar(() => c.tunel?.fase === 'error', 10_000);
    expect(c.tunel?.error).toBe('NO_INSTALADO');
  });

  it('si cloudflared se cierra sin dar la dirección, es un fallo', async () => {
    const puerto = await arrancar({
      comando: process.execPath,
      argumentos: () => ['-e', 'process.exit(1)'],
    });
    const c = conectar(puerto);
    await esperar(() => c.info !== null);
    await pedir(c, MENSAJES.abrirTunel);
    await esperar(() => c.tunel?.fase === 'error', 10_000);
    expect(c.tunel?.error).toBe('FALLO');
  });

  it('reconoce las conexiones del propio equipo', () => {
    expect(esDelEquipoServidor('127.0.0.1', {})).toBe(true);
    expect(esDelEquipoServidor('::ffff:127.0.0.1', {})).toBe(true);
    expect(esDelEquipoServidor('192.168.1.40', {})).toBe(false);
    expect(esDelEquipoServidor('127.0.0.1', { 'cf-ray': 'abc' })).toBe(false);
    expect(esDelEquipoServidor('::1', { 'x-forwarded-for': '1.2.3.4' })).toBe(false);
  });
});
