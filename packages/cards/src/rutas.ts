import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Raíz del monorepo (packages/cards/src → ../../..). */
export const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
export const RUTA_CARTAS_JSON = resolve(RAIZ, 'Referencias/cartas.es.json');
export const RUTA_IMAGENES_ORIGEN = resolve(RAIZ, 'Referencias/Imagenes/Cartas');
export const RUTA_ASSETS_CARTAS = resolve(RAIZ, 'assets/cartas');
