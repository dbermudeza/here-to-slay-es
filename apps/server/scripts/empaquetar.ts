/**
 * `pnpm empaquetar`: genera dist-app/HereToSlay/«Here to Slay.url», el acceso directo de escritorio.
 * Al abrirlo, Windows abre en el navegador el juego desplegado en internet (src/escritorio.ts).
 *
 * Lleva el logo del juego como icono (logo.ico, en la misma carpeta). El acceso directo guarda la
 * ruta absoluta del icono: si mueves el proyecto, vuelve a ejecutar `pnpm empaquetar`. Puedes copiar
 * el .url al escritorio. Para jugar con un servidor en este equipo, `pnpm servidor`.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IMAGEN_LOGO } from '@hts/cards';
import pngToIco from 'png-to-ico';
import { RAIZ, RUTA_ASSETS_CARTAS } from '../../../packages/cards/src/rutas';
import { contenidoAccesoDirecto, URL_EN_LINEA } from '../src/escritorio';
import { iconoDesdeLogo } from './icono';

const DESTINO = resolve(RAIZ, 'dist-app/HereToSlay');
const ACCESO = join(DESTINO, 'Here to Slay.url');

// La carpeta se recrea entera (también borra el HereToSlay.exe de versiones anteriores).
try {
  rmSync(DESTINO, { recursive: true, force: true });
} catch {
  console.error('No se pudo vaciar dist-app/HereToSlay: cierra HereToSlay.exe si está abierto.');
  process.exit(1);
}
mkdirSync(DESTINO, { recursive: true });

const logo = join(RUTA_ASSETS_CARTAS, IMAGEN_LOGO);
let icono: string | undefined;
if (existsSync(logo)) {
  icono = join(DESTINO, 'logo.ico');
  writeFileSync(icono, await pngToIco(iconoDesdeLogo(readFileSync(logo))));
} else {
  console.warn(
    `Sin ${logo}: el acceso directo llevará el icono del navegador (instala los recursos).`,
  );
}
writeFileSync(ACCESO, contenidoAccesoDirecto(URL_EN_LINEA, icono));

console.log(`\nListo: ${ACCESO}`);
console.log('Ábrelo con doble clic (o cópialo al escritorio): abre el juego en el navegador.');
