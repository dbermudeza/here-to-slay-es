import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUTA_CARTAS_JSON } from '../../../packages/cards/src/rutas';
import { arrancar } from '../src/arranque';
import { estaEnMarcha, rutasEscritorio } from '../src/escritorio';

describe('Ejecutable de escritorio', () => {
  it('busca la web y las cartas junto al ejecutable', () => {
    const base = join('C:', 'Juegos', 'HereToSlay');
    expect(rutasEscritorio(base)).toEqual({
      rutaCartas: join(base, 'cartas.es.json'),
      dirWeb: join(base, 'web'),
    });
  });

  it('no detecta servidor en un puerto libre', async () => {
    const libre = createServer();
    await new Promise<void>((fin) => libre.listen(0, '127.0.0.1', fin));
    const { port } = libre.address() as AddressInfo;
    await new Promise<void>((fin) => libre.close(() => fin()));
    expect(await estaEnMarcha(port, 500)).toBe(false);
  });

  it('no confunde otro programa con Here to Slay', async () => {
    const otro = createServer((_, res) => res.end('<html>otra cosa</html>'));
    await new Promise<void>((fin) => otro.listen(0, '127.0.0.1', fin));
    const { port } = otro.address() as AddressInfo;
    try {
      expect(await estaEnMarcha(port, 500)).toBe(false);
    } finally {
      await new Promise<void>((fin) => otro.close(() => fin()));
    }
  });

  describe.skipIf(!existsSync(RUTA_CARTAS_JSON))('con las cartas', () => {
    it('arranca el servidor y lo detecta ya en marcha', async () => {
      const dirWeb = mkdtempSync(join(tmpdir(), 'hts-web-'));
      const { servidor, puerto } = await arrancar({
        rutaCartas: RUTA_CARTAS_JSON,
        dirWeb,
        puerto: 0,
      });
      try {
        expect(await estaEnMarcha(puerto)).toBe(true);
      } finally {
        await servidor.cerrar();
        rmSync(dirWeb, { recursive: true, force: true });
      }
    });
  });
});
