import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { nuevoMotor } from '../../../packages/engine/test/fixtures';
import { crearServidor, type ServidorHts } from '../src/servidor';

let servidor: ServidorHts | null = null;
let dir = '';

afterEach(async () => {
  await servidor?.cerrar();
  servidor = null;
  if (dir !== '') rmSync(dir, { recursive: true, force: true });
});

function webFalsa(): string {
  dir = mkdtempSync(join(tmpdir(), 'hts-web-'));
  mkdirSync(join(dir, 'assets'));
  mkdirSync(join(dir, 'cartas'));
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html><title>x</title>${'<p>hola</p>'.repeat(300)}`,
  );
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), `console.log(1);\n`.repeat(400));
  writeFileSync(join(dir, 'cartas', 'heroe.png'), Buffer.alloc(64));
  return dir;
}

describe('Archivos de la aplicación web', () => {
  it('sirve con caché larga lo que lleva hash, sin caché el HTML y comprimido si se acepta', async () => {
    servidor = crearServidor({ motor: nuevoMotor(), dirWeb: webFalsa() });
    const { app } = servidor;

    const js = await app.inject({
      url: '/assets/index-abc123.js',
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(js.statusCode).toBe(200);
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(js.headers['content-encoding']).toBe('gzip');

    const html = await app.inject({ url: '/', headers: { 'accept-encoding': 'br' } });
    expect(html.statusCode).toBe(200);
    expect(html.headers['cache-control']).toBe('no-cache');
    expect(html.headers['content-encoding']).toBe('br');

    const img = await app.inject({ url: '/cartas/heroe.png' });
    expect(img.headers['cache-control']).toBe('public, max-age=86400');
  });
});
