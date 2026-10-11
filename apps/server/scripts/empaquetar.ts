/**
 * `pnpm empaquetar`: genera dist-app/HereToSlay/HereToSlay.exe, el lanzador de escritorio. Al
 * abrirlo, abre en el navegador el juego desplegado en internet (src/escritorio.ts) y termina, sin
 * ventana de consola.
 *
 * Es un ejecutable único de Node (SEA) con el logo del juego como icono en Windows y marcado como
 * aplicación gráfica. No lleva la web ni las cartas: el juego se sirve desde el despliegue. Para
 * jugar con un servidor en este equipo, `pnpm servidor`.
 */
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { IMAGEN_LOGO } from '@hts/cards';
import { build } from 'esbuild';
import pngToIco from 'png-to-ico';
import { rcedit } from 'rcedit';
import { RAIZ, RUTA_ASSETS_CARTAS } from '../../../packages/cards/src/rutas';
import { iconoDesdeLogo } from './icono';
import { aSubsistemaGrafico } from './subsistema';

const DESTINO = resolve(RAIZ, 'dist-app/HereToSlay');
const TEMPORAL = resolve(RAIZ, 'dist-app/.temporal');
const NOMBRE = process.platform === 'win32' ? 'HereToSlay.exe' : 'HereToSlay';
/** Marca que Node busca en su binario para saber que lleva una aplicación (documentación de SEA). */
const FUSIBLE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

// Un ejecutable en uso no se puede reemplazar: se avisa antes de tocar nada.
const ejecutable = join(DESTINO, NOMBRE);
try {
  if (existsSync(ejecutable)) closeSync(openSync(ejecutable, 'r+'));
} catch {
  console.error(`${NOMBRE} está en uso: espera a que termine y vuelve a ejecutar pnpm empaquetar.`);
  process.exit(1);
}

// La carpeta se recrea entera (también borra web/ y cartas.es.json de versiones anteriores).
rmSync(DESTINO, { recursive: true, force: true });
rmSync(TEMPORAL, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
mkdirSync(TEMPORAL, { recursive: true });

// 1. El lanzador en un único archivo CommonJS (lo que admite SEA).
console.log('Empaquetando el lanzador…');
const codigo = join(TEMPORAL, 'lanzador.cjs');
await build({
  entryPoints: [resolve(import.meta.dirname, '../src/principal-escritorio.ts')],
  outfile: codigo,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: `node${process.versions.node.split('.')[0] ?? '20'}`,
  minify: true,
  logLevel: 'warning',
});

// 2. El código como recurso del ejecutable de Node.
console.log('Creando el ejecutable…');
const blob = join(TEMPORAL, 'lanzador.blob');
const config = join(TEMPORAL, 'sea-config.json');
writeFileSync(
  config,
  JSON.stringify({ main: codigo, output: blob, disableExperimentalSEAWarning: true }),
);
execFileSync(process.execPath, ['--experimental-sea-config', config], { stdio: 'inherit' });

copyFileSync(process.execPath, ejecutable);
// Icono y datos del ejecutable, antes de inyectar el código (rcedit reescribe los recursos).
if (process.platform === 'win32') {
  const logo = join(RUTA_ASSETS_CARTAS, IMAGEN_LOGO);
  const datos = {
    'version-string': { ProductName: 'Here to Slay', FileDescription: 'Here to Slay' },
  };
  if (existsSync(logo)) {
    const icono = join(TEMPORAL, 'logo.ico');
    writeFileSync(icono, await pngToIco(iconoDesdeLogo(readFileSync(logo))));
    await rcedit(ejecutable, { ...datos, icon: icono });
  } else {
    console.warn(`Sin ${logo}: el ejecutable llevará el icono de Node (instala los recursos).`);
    await rcedit(ejecutable, datos);
  }
}
const postject = createRequire(import.meta.url).resolve('postject/dist/cli.js');
execFileSync(
  process.execPath,
  [
    postject,
    ejecutable,
    'NODE_SEA_BLOB',
    blob,
    '--sentinel-fuse',
    FUSIBLE,
    ...(process.platform === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : []),
  ],
  { stdio: 'inherit' },
);

// 3. Aplicación gráfica: al abrirlo no aparece ninguna ventana de consola.
if (process.platform === 'win32') {
  writeFileSync(ejecutable, aSubsistemaGrafico(readFileSync(ejecutable)));
}
rmSync(TEMPORAL, { recursive: true, force: true });

// El Explorador guarda los iconos en caché: sin esto seguiría mostrando el icono anterior.
if (process.platform === 'win32') {
  try {
    execFileSync(join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'ie4uinit.exe'), [
      '-show',
    ]);
  } catch {
    console.warn('No se pudo refrescar la caché de iconos: el icono nuevo puede tardar en verse.');
  }
}

console.log(`\nListo: ${ejecutable}`);
console.log('Ábrelo con doble clic: abre el juego en el navegador.');
