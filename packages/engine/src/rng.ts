/**
 * Generador pseudoaleatorio sfc32 con estado serializable (4 enteros de 32 bits).
 * El estado vive dentro de GameState, así que una partida es reproducible a partir
 * de su semilla y de la secuencia de acciones.
 */
export type EstadoRng = [number, number, number, number];

/** Hash cyrb128: convierte una semilla de texto en el estado inicial del generador. */
function cyrb128(texto: string): EstadoRng {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < texto.length; i++) {
    const k = texto.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Devuelve un número en [0, 1) y el estado siguiente. Función pura. */
export function siguienteRng(estado: EstadoRng): [number, EstadoRng] {
  let [a, b, c, d] = estado;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  return [(t >>> 0) / 4294967296, [a >>> 0, b >>> 0, c >>> 0, d >>> 0]];
}

export function crearRng(semilla: string): EstadoRng {
  let estado = cyrb128(semilla);
  // Se descartan las primeras salidas para mezclar bien semillas parecidas.
  for (let i = 0; i < 15; i++) estado = siguienteRng(estado)[1];
  return estado;
}
