import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RUTA_ASSETS_CARTAS, RUTA_CARTAS_JSON, RUTA_IMAGENES_ORIGEN } from '../rutas';
import { ArchivoCartasSchema } from '../schema';

/**
 * Copia cada imagen de Referencias/Imagenes/Cartas/<origenImagen> a assets/cartas/<imagen>.
 * No modifica ni borra las originales. Es idempotente.
 */
const { cartas } = ArchivoCartasSchema.parse(JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8')));
mkdirSync(RUTA_ASSETS_CARTAS, { recursive: true });

let copiadas = 0;
const faltan: string[] = [];
for (const carta of cartas) {
  if (carta.imagen === undefined || carta.origenImagen === undefined) continue;
  const origen = resolve(RUTA_IMAGENES_ORIGEN, carta.origenImagen);
  if (!existsSync(origen)) {
    faltan.push(`${carta.id} ← ${carta.origenImagen}`);
    continue;
  }
  copyFileSync(origen, resolve(RUTA_ASSETS_CARTAS, carta.imagen));
  copiadas++;
}

console.log(`✔ ${copiadas} imágenes copiadas a assets/cartas/.`);
if (faltan.length > 0) {
  console.error(`✖ No se encontró el origen de ${faltan.length} imagen(es):`);
  for (const f of faltan) console.error(`    ${f}`);
  process.exit(1);
}
