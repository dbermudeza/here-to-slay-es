import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Raíz del monorepo: el primer directorio, subiendo desde el actual, que contiene
 * pnpm-workspace.yaml. (No se usa import.meta.url para que funcione también en entornos de test
 * como jsdom, donde no es una URL de archivo.)
 */
function buscarRaiz(desde: string): string {
  let dir = resolve(desde);
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const padre = dirname(dir);
    if (padre === dir) return resolve(desde);
    dir = padre;
  }
}

export const RAIZ = buscarRaiz(process.cwd());
export const RUTA_CARTAS_JSON = resolve(RAIZ, 'Referencias/cartas.es.json');
export const RUTA_IMAGENES_ORIGEN = resolve(RAIZ, 'Referencias/Imagenes/Cartas');
export const RUTA_ASSETS_CARTAS = resolve(RAIZ, 'assets/cartas');

/** Origen del reverso de las cartas (se copia a assets/cartas/reverso.png). */
export const RUTA_REVERSO_ORIGEN = resolve(RUTA_IMAGENES_ORIGEN, 'Reverso_carta.png');
/** Origen del logo del juego. Se llama .jpg pero su contenido es PNG: se copia a assets/cartas/logo.png. */
export const RUTA_LOGO_ORIGEN = resolve(RAIZ, 'Referencias/Imagenes/here_to_slay_logo.jpg');
