import { describe, expect, it } from 'vitest';
import { contenidoAccesoDirecto, URL_EN_LINEA } from '../src/escritorio';

describe('Acceso directo de escritorio', () => {
  it('abre la dirección del juego en línea (https)', () => {
    expect(new URL(URL_EN_LINEA).protocol).toBe('https:');
  });

  it('genera un acceso directo de internet de Windows con icono', () => {
    const contenido = contenidoAccesoDirecto('https://ejemplo.test/', 'C:\\juego\\logo.ico');
    expect(contenido).toBe(
      '[InternetShortcut]\r\nURL=https://ejemplo.test/\r\nIconFile=C:\\juego\\logo.ico\r\nIconIndex=0\r\n',
    );
  });

  it('sin icono solo lleva la dirección', () => {
    expect(contenidoAccesoDirecto('https://ejemplo.test/')).toBe(
      '[InternetShortcut]\r\nURL=https://ejemplo.test/\r\n',
    );
  });
});
