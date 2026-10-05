import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import {
  RAIZ,
  RUTA_ASSETS_CARTAS,
  RUTA_CARTAS_JSON,
  RUTA_IMAGENES_ORIGEN,
  RUTA_LOGO_ORIGEN,
  RUTA_REVERSO_ORIGEN,
} from './rutas';
import { ArchivoCartasSchema, IMAGEN_LOGO, IMAGEN_REVERSO } from './schema';

/** Rutas que usa `copiarImagenes` (configurables para los tests). */
export interface RutasImagenes {
  cartasJson: string;
  origenCartas: string;
  reverso: string;
  logo: string;
  destino: string;
}

export const RUTAS_IMAGENES: RutasImagenes = {
  cartasJson: RUTA_CARTAS_JSON,
  origenCartas: RUTA_IMAGENES_ORIGEN,
  reverso: RUTA_REVERSO_ORIGEN,
  logo: RUTA_LOGO_ORIGEN,
  destino: RUTA_ASSETS_CARTAS,
};

/**
 * Copia cada imagen de Referencias/Imagenes/Cartas/<origenImagen> a assets/cartas/<imagen>, y además
 * el reverso (assets/cartas/reverso.png) y el logo (assets/cartas/logo.png). No modifica ni borra
 * las originales. Es idempotente. Lo que no encuentra lo devuelve en `faltan`.
 */
export function copiarImagenes(rutas: RutasImagenes = RUTAS_IMAGENES): {
  copiadas: number;
  faltan: string[];
} {
  const { cartas } = ArchivoCartasSchema.parse(JSON.parse(readFileSync(rutas.cartasJson, 'utf8')));
  mkdirSync(rutas.destino, { recursive: true });
  let copiadas = 0;
  const faltan: string[] = [];
  for (const carta of cartas) {
    if (carta.imagen === undefined || carta.origenImagen === undefined) continue;
    const origen = resolve(rutas.origenCartas, carta.origenImagen);
    if (!existsSync(origen)) {
      faltan.push(`${carta.id} ← ${carta.origenImagen}`);
      continue;
    }
    copyFileSync(origen, resolve(rutas.destino, carta.imagen));
    copiadas++;
  }
  const fijas: [string, string, string][] = [
    ['reverso de las cartas', rutas.reverso, IMAGEN_REVERSO],
    ['logo del juego', rutas.logo, IMAGEN_LOGO],
  ];
  for (const [descripcion, origen, imagen] of fijas) {
    if (!existsSync(origen)) {
      const ruta = relative(RAIZ, origen);
      faltan.push(`${descripcion} ← ${ruta.startsWith('..') ? origen : ruta.split(sep).join('/')}`);
      continue;
    }
    copyFileSync(origen, resolve(rutas.destino, imagen));
    copiadas++;
  }
  return { copiadas, faltan };
}
