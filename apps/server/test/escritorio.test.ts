import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  posicionSubsistema,
  aSubsistemaGrafico,
  SUBSISTEMA_CONSOLA,
  SUBSISTEMA_GRAFICO,
} from '../scripts/subsistema';
import { ordenNavegador, URL_EN_LINEA } from '../src/escritorio';

describe('Lanzador de escritorio', () => {
  it('abre la dirección del juego en línea (https)', () => {
    expect(new URL(URL_EN_LINEA).protocol).toBe('https:');
  });

  it('usa la orden del sistema para abrir el navegador', () => {
    const url = 'https://ejemplo.test/';
    expect(ordenNavegador(url, 'win32')).toEqual([
      'rundll32',
      ['url.dll,FileProtocolHandler', url],
    ]);
    expect(ordenNavegador(url, 'darwin')).toEqual(['open', [url]]);
    expect(ordenNavegador(url, 'linux')).toEqual(['xdg-open', [url]]);
  });
});

describe.skipIf(process.platform !== 'win32')('Ejecutable sin consola', () => {
  it('marca un ejecutable de Windows (node.exe) como aplicación gráfica', () => {
    const exe = readFileSync(process.execPath);
    const pos = posicionSubsistema(exe);
    expect(exe.readUInt16LE(pos)).toBe(SUBSISTEMA_CONSOLA);
    const grafico = aSubsistemaGrafico(exe);
    expect(grafico.readUInt16LE(pos)).toBe(SUBSISTEMA_GRAFICO);
    // Solo cambia ese campo; el original queda intacto.
    expect(exe.readUInt16LE(pos)).toBe(SUBSISTEMA_CONSOLA);
    let distintos = 0;
    for (let i = 0; i < exe.length; i++) if (exe[i] !== grafico[i]) distintos++;
    expect(distintos).toBe(1);
  });
});

describe('Cabecera de ejecutables', () => {
  it('rechaza lo que no es un ejecutable de Windows', () => {
    expect(() => posicionSubsistema(Buffer.from('no soy un exe'))).toThrow(/MZ/);
    const soloMz = Buffer.alloc(0x80);
    soloMz.write('MZ', 0, 'latin1');
    soloMz.writeUInt32LE(0x40, 0x3c);
    expect(() => posicionSubsistema(soloMz)).toThrow(/PE/);
  });
});
