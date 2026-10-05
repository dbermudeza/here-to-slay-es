import type { OpcionesAnfitrion } from '@hts/anfitrion';

/** Opciones del director local. En las pruebas e2e los bots responden sin pausa. */
export const OPCIONES_DIRECTOR: OpcionesAnfitrion =
  import.meta.env.MODE === 'e2e' ? { retardoBotMs: 40, celebracionMs: 300 } : {};
