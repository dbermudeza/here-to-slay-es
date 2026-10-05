/**
 * Icono del ejecutable a partir del logo: el logo es texto claro sobre fondo transparente y con
 * mucho margen, así que como icono apenas se vería (blanco sobre blanco en el Explorador, y diminuto).
 * Se recorta el margen y se coloca sobre un cuadrado oscuro redondeado, como en la web
 * (bg-stone-900). La imagen original no se modifica.
 */
import { PNG } from 'pngjs';

/** Lado del icono generado (png-to-ico deriva de él los de 48, 32 y 16 px). */
export const LADO_ICONO = 256;
/** stone-900 de Tailwind. */
const FONDO = [0x1c, 0x19, 0x17] as const;
const RADIO = 0.18;
const MARGEN = 0.08;

interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Rectángulo mínimo que contiene los píxeles no transparentes. */
export function cajaVisible(img: PNG): Caja {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) > 8) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, ancho: img.width, alto: img.height };
  return { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 };
}

/** Cobertura (0..1) del cuadrado redondeado en el píxel (x, y), con el borde suavizado. */
function cobertura(x: number, y: number, lado: number): number {
  const r = lado * RADIO;
  const cx = Math.min(Math.max(x + 0.5, r), lado - r);
  const cy = Math.min(Math.max(y + 0.5, r), lado - r);
  const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  return Math.min(Math.max(r - d + 0.5, 0), 1);
}

/** Muestra del logo con interpolación bilineal (RGBA premultiplicado por alfa). */
function muestra(img: PNG, fx: number, fy: number): [number, number, number, number] {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const res: [number, number, number, number] = [0, 0, 0, 0];
  for (const [dx, dy, peso] of [
    [0, 0, (1 - tx) * (1 - ty)],
    [1, 0, tx * (1 - ty)],
    [0, 1, (1 - tx) * ty],
    [1, 1, tx * ty],
  ] as const) {
    const x = x0 + dx;
    const y = y0 + dy;
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    const i = (y * img.width + x) * 4;
    const a = (img.data[i + 3] ?? 0) / 255;
    for (let c = 0; c < 3; c++) res[c] = (res[c] ?? 0) + (img.data[i + c] ?? 0) * a * peso;
    res[3] += a * peso;
  }
  return res;
}

/** PNG cuadrado de LADO_ICONO px: el logo recortado sobre un cuadrado oscuro redondeado. */
export function iconoDesdeLogo(logoPng: Buffer): Buffer {
  const logo = PNG.sync.read(logoPng);
  const caja = cajaVisible(logo);
  const lado = LADO_ICONO;
  const util = lado * (1 - 2 * MARGEN);
  // Supermuestreo 3×3 por píxel: al reducir el logo, evita bordes dentados.
  const escala = Math.min(util / caja.ancho, util / caja.alto);
  const offX = (lado - caja.ancho * escala) / 2;
  const offY = (lado - caja.alto * escala) / 2;
  const salida = new PNG({ width: lado, height: lado });
  const N = 3;
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const px = x + (sx + 0.5) / N;
          const py = y + (sy + 0.5) / N;
          const [mr, mg, mb, ma] = muestra(
            logo,
            caja.x + (px - offX) / escala - 0.5,
            caja.y + (py - offY) / escala - 0.5,
          );
          r += mr + FONDO[0] * (1 - ma);
          g += mg + FONDO[1] * (1 - ma);
          b += mb + FONDO[2] * (1 - ma);
          a += 1;
        }
      }
      const i = (y * lado + x) * 4;
      salida.data[i] = Math.round(r / a);
      salida.data[i + 1] = Math.round(g / a);
      salida.data[i + 2] = Math.round(b / a);
      salida.data[i + 3] = Math.round(255 * cobertura(x, y, lado));
    }
  }
  return PNG.sync.write(salida);
}
