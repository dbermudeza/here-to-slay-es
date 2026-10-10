import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { nuevoMotor } from '../../../packages/engine/test/fixtures';
import { COOKIE_ACCESO, crearAcceso, rutaSegura } from '../src/acceso';
import { crearServidor, type ServidorHts } from '../src/servidor';

const CLAVE = 'clave-de-prueba';

let servidor: ServidorHts | null = null;
let dir = '';

afterEach(async () => {
  await servidor?.cerrar();
  servidor = null;
  if (dir !== '') rmSync(dir, { recursive: true, force: true });
});

function webFalsa(): string {
  dir = mkdtempSync(join(tmpdir(), 'hts-web-'));
  mkdirSync(join(dir, 'cartas'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>x</title><p>mesa</p>');
  writeFileSync(join(dir, 'cartas', 'heroe.png'), Buffer.alloc(64));
  return dir;
}

const ACCESO = crearAcceso(CLAVE);
const conCookie = { cookie: `${COOKIE_ACCESO}=${ACCESO.cookie()}` };

/** ¿Se puede abrir una conexión de Socket.IO (con o sin cabeceras)? */
function conecta(puerto: number, cabeceras: Record<string, string> = {}): Promise<boolean> {
  return new Promise((fin) => {
    const s = io(`http://127.0.0.1:${puerto}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: cabeceras,
    });
    s.on('connect', () => {
      s.disconnect();
      fin(true);
    });
    s.on('connect_error', () => {
      s.disconnect();
      fin(false);
    });
  });
}

describe('Acceso con contraseña (CLAVE_ACCESO)', () => {
  it('sin cookie: las páginas llevan a /acceso, el resto da 401 y /salud sigue libre', async () => {
    servidor = crearServidor({ motor: nuevoMotor(), dirWeb: webFalsa(), claveAcceso: CLAVE });
    const { app } = servidor;

    const pagina = await app.inject({ url: '/?sala=ABCDE', headers: { accept: 'text/html' } });
    expect(pagina.statusCode).toBe(302);
    expect(pagina.headers.location).toBe(`/acceso?volver=${encodeURIComponent('/?sala=ABCDE')}`);

    for (const url of ['/cartas/heroe.png', '/api/estado']) {
      expect((await app.inject({ url })).statusCode).toBe(401);
    }
    expect((await app.inject({ url: '/salud' })).json()).toEqual({ ok: true });

    const acceso = await app.inject({ url: '/acceso?volver=/%3Fsala%3DABCDE' });
    expect(acceso.statusCode).toBe(200);
    expect(acceso.body).toContain('name="volver" value="/?sala=ABCDE"');
  });

  it('con la contraseña correcta da una cookie que abre todo y vuelve a la sala', async () => {
    servidor = crearServidor({ motor: nuevoMotor(), dirWeb: webFalsa(), claveAcceso: CLAVE });
    const { app } = servidor;

    const mal = await app.inject({
      method: 'POST',
      url: '/acceso',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'clave=otra&volver=%2F',
    });
    expect(mal.statusCode).toBe(401);
    expect(mal.headers['set-cookie']).toBeUndefined();
    expect(mal.body).toContain('Contraseña incorrecta');

    const bien = await app.inject({
      method: 'POST',
      url: '/acceso',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-proto': 'https',
      },
      payload: `clave=${CLAVE}&volver=${encodeURIComponent('/?sala=ABCDE')}`,
    });
    expect(bien.statusCode).toBe(303);
    expect(bien.headers.location).toBe('/?sala=ABCDE');
    const cookie = String(bien.headers['set-cookie']);
    const valor = /hts_acceso=([^;]+)/.exec(cookie)?.[1] ?? null;
    expect(ACCESO.valida(valor)).toBe(true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).not.toContain(CLAVE);

    const img = await app.inject({ url: '/cartas/heroe.png', headers: conCookie });
    expect(img.statusCode).toBe(200);
    expect(img.headers['cache-control']).toBe('private, max-age=86400');
    expect((await app.inject({ url: '/api/estado', headers: conCookie })).statusCode).toBe(200);
    const indice = await app.inject({ url: '/', headers: { ...conCookie, accept: 'text/html' } });
    expect(indice.statusCode).toBe(200);
    expect(indice.headers['cache-control']).toBe('private, no-cache');
  });

  it('la cookie caduca, no se puede manipular y no vale con otra contraseña', () => {
    const ahora = Date.now();
    const valor = ACCESO.cookie(ahora);
    expect(ACCESO.valida(valor, ahora)).toBe(true);
    expect(ACCESO.valida(valor, ahora + 31 * 24 * 3600 * 1000)).toBe(false);
    const [caduca, firma] = valor.split('.');
    expect(ACCESO.valida(`${Number(caduca) + 999999}.${firma}`, ahora)).toBe(false);
    expect(ACCESO.valida(valor.replace(/.$/, 'x'), ahora)).toBe(false);
    expect(crearAcceso('otra-clave').valida(valor, ahora)).toBe(false);
    expect(valor).not.toContain(CLAVE);
    for (const malo of [null, '', 'abc', '1.2.3', 'x.y']) expect(ACCESO.valida(malo)).toBe(false);
  });

  it('Socket.IO solo acepta conexiones con la cookie', async () => {
    servidor = crearServidor({ motor: nuevoMotor(), claveAcceso: CLAVE });
    const puerto = await servidor.escuchar(0, '127.0.0.1');
    expect(await conecta(puerto)).toBe(false);
    expect(await conecta(puerto, { cookie: `${COOKIE_ACCESO}=falsa` })).toBe(false);
    expect(await conecta(puerto, conCookie)).toBe(true);
  });

  it('frena los intentos repetidos desde la misma IP', async () => {
    servidor = crearServidor({ motor: nuevoMotor(), claveAcceso: CLAVE });
    const { app } = servidor;
    const intento = (clave: string) =>
      app.inject({
        method: 'POST',
        url: '/acceso',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: `clave=${clave}`,
      });
    for (let i = 0; i < 10; i++) expect((await intento('mal')).statusCode).toBe(401);
    // Bloqueado: ni siquiera la buena entra hasta que pase la ventana.
    expect((await intento(CLAVE)).statusCode).toBe(429);
  });

  it('inventar X-Forwarded-For en cada intento no salta el límite (tope total)', async () => {
    servidor = crearServidor({ motor: nuevoMotor(), claveAcceso: CLAVE });
    const { app } = servidor;
    const codigos: number[] = [];
    for (let i = 0; i < 55; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/acceso',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-forwarded-for': `10.0.0.${i}`,
        },
        payload: 'clave=mal',
      });
      codigos.push(r.statusCode);
    }
    expect(codigos.slice(0, 50).every((c) => c === 401)).toBe(true);
    expect(codigos.slice(50).every((c) => c === 429)).toBe(true);
  });

  it('sin contraseña configurada, todo queda abierto como siempre', async () => {
    servidor = crearServidor({ motor: nuevoMotor(), dirWeb: webFalsa() });
    const { app } = servidor;
    expect((await app.inject({ url: '/', headers: { accept: 'text/html' } })).statusCode).toBe(200);
    const img = await app.inject({ url: '/cartas/heroe.png' });
    expect(img.headers['cache-control']).toBe('public, max-age=86400');
    const puerto = await servidor.escuchar(0, '127.0.0.1');
    expect(await conecta(puerto)).toBe(true);
  });

  it('solo redirige a rutas internas', () => {
    expect(rutaSegura('/?sala=ABCDE')).toBe('/?sala=ABCDE');
    const malas = [
      'https://otra.web',
      '//otra.web',
      '/\\otra.web',
      // Los navegadores quitan tabuladores y saltos de línea: «/<tab>/otra.web» sería «//otra.web».
      '/\t/otra.web',
      '/\n/otra.web',
      '/\r/otra.web',
      '/acceso',
      '/acceso?volver=/x',
      7,
      undefined,
    ];
    for (const mala of malas) expect(rutaSegura(mala)).toBe('/');
    // Una barra codificada se queda como texto de la ruta: no cambia de web.
    expect(rutaSegura('/%2f%2fotra.web')).toBe('/%2f%2fotra.web');
  });
});
