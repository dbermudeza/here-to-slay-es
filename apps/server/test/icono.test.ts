import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { cajaVisible, iconoDesdeLogo, LADO_ICONO } from '../scripts/icono';

/** Logo de prueba: 100×100 transparente con un bloque blanco opaco en (20..79, 40..59). */
function logoDePrueba(): PNG {
  const img = new PNG({ width: 100, height: 100 });
  for (let y = 40; y < 60; y++) {
    for (let x = 20; x < 80; x++) {
      const i = (y * 100 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = img.data[i + 3] = 255;
    }
  }
  return img;
}

const pixel = (img: PNG, x: number, y: number): number[] =>
  Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('Icono del ejecutable', () => {
  it('encuentra la parte visible del logo (sin el margen transparente)', () => {
    expect(cajaVisible(logoDePrueba())).toEqual({ x: 20, y: 40, ancho: 60, alto: 20 });
  });

  it('pone el logo recortado sobre un cuadrado oscuro con esquinas redondeadas', () => {
    const icono = PNG.sync.read(iconoDesdeLogo(PNG.sync.write(logoDePrueba())));
    expect([icono.width, icono.height]).toEqual([LADO_ICONO, LADO_ICONO]);
    // Esquina: fuera del redondeo, transparente.
    expect(pixel(icono, 0, 0)[3]).toBe(0);
    // Centro: el bloque blanco, ampliado hasta casi el ancho del icono.
    expect(pixel(icono, 128, 128)).toEqual([255, 255, 255, 255]);
    expect(pixel(icono, 30, 128)).toEqual([255, 255, 255, 255]);
    // Encima del bloque: el fondo oscuro y opaco.
    expect(pixel(icono, 128, 40)).toEqual([0x1c, 0x19, 0x17, 255]);
  });
});
