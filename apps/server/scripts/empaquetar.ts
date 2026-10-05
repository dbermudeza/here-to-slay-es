/**
 * `pnpm empaquetar`: genera dist-app/HereToSlay/, una carpeta para jugar sin Node ni pnpm:
 *
 *   HereToSlay.exe   el servidor (src/principal-escritorio.ts) como ejecutable único de Node (SEA)
 *   web/             la aplicación compilada (apps/web/dist, con las imágenes en web/cartas)
 *   cartas.es.json   copia de Referencias/
 *
 * Contiene arte y textos oficiales: es personal y no se versiona (dist-app/ está en .gitignore).
 * La web ya debe estar compilada (el script raíz ejecuta antes `pnpm build`).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { RAIZ, RUTA_CARTAS_JSON } from '../../../packages/cards/src/rutas';

const DIR_WEB = resolve(RAIZ, 'apps/web/dist');
const DESTINO = resolve(RAIZ, 'dist-app/HereToSlay');
const TEMPORAL = resolve(RAIZ, 'dist-app/.temporal');
const NOMBRE = process.platform === 'win32' ? 'HereToSlay.exe' : 'HereToSlay';
/** Marca que Node busca en su binario para saber que lleva una aplicación (documentación de SEA). */
const FUSIBLE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

for (const [ruta, falta] of [
  [RUTA_CARTAS_JSON, 'instálalo con pnpm recursos'],
  [DIR_WEB, 'compílala con pnpm build'],
] as const) {
  if (!existsSync(ruta)) {
    console.error(`Falta ${ruta}: ${falta}.`);
    process.exit(1);
  }
}

rmSync(DESTINO, { recursive: true, force: true });
rmSync(TEMPORAL, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
mkdirSync(TEMPORAL, { recursive: true });

// 1. El servidor completo en un único archivo CommonJS (lo que admite SEA).
console.log('Empaquetando el servidor…');
const codigo = join(TEMPORAL, 'servidor.cjs');
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
const blob = join(TEMPORAL, 'servidor.blob');
const config = join(TEMPORAL, 'sea-config.json');
writeFileSync(
  config,
  JSON.stringify({ main: codigo, output: blob, disableExperimentalSEAWarning: true }),
);
execFileSync(process.execPath, ['--experimental-sea-config', config], { stdio: 'inherit' });

const ejecutable = join(DESTINO, NOMBRE);
copyFileSync(process.execPath, ejecutable);
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

// 3. La web y las cartas, junto al ejecutable.
console.log('Copiando la web y las cartas…');
cpSync(DIR_WEB, join(DESTINO, 'web'), { recursive: true });
copyFileSync(RUTA_CARTAS_JSON, join(DESTINO, 'cartas.es.json'));
rmSync(TEMPORAL, { recursive: true, force: true });

console.log(`\nListo: ${ejecutable}`);
console.log('Ábrelo con doble clic (puedes crear un acceso directo en el escritorio).');
