/**
 * `pnpm recursos [--desde <carpeta>] [--repo <url>] [--forzar]`
 *
 * Instala los recursos de las cartas (Referencias/ y assets/cartas/), que no están en este
 * repositorio porque son ilustraciones y textos de Unstable Games:
 * - Por defecto los descarga del repositorio privado de recursos (hace falta acceso a él y tener la
 *   sesión de Git iniciada). Otro repositorio: `--repo <url>` o la variable HTS_RECURSOS_REPO.
 * - Con `--desde <carpeta>` los copia de una carpeta: la que contiene `Referencias/` (y, si la tiene,
 *   `assets/cartas/`) o la propia carpeta `Referencias`.
 * Después prepara las imágenes en assets/cartas/ y valida cartas.es.json.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copiarImagenes } from '../imagenes';
import { RAIZ, RUTA_ASSETS_CARTAS, RUTA_CARTAS_JSON } from '../rutas';
import { ArchivoCartasSchema, IMAGENES_RESERVADAS } from '../schema';

const REPO_POR_DEFECTO = 'https://github.com/dbermudeza/here-to-slay-recursos.git';
const REFERENCIAS = resolve(RAIZ, 'Referencias');

function argumento(nombre: string): string | undefined {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const i = args.indexOf(nombre);
  return i === -1 ? undefined : args[i + 1];
}
const bandera = (nombre: string): boolean => process.argv.includes(nombre);

function fallar(mensaje: string): never {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

/** Carpeta con `Referencias/` (y quizá `assets/cartas/`) de donde copiar. */
function origenDesdeCarpeta(carpeta: string): { referencias: string; assets: string | null } {
  // Rutas relativas: respecto a donde se lanzó el comando, no a packages/cards.
  const base = resolve(process.env['INIT_CWD'] ?? process.cwd(), carpeta);
  if (existsSync(join(base, 'Referencias', 'cartas.es.json'))) {
    const assets = join(base, 'assets', 'cartas');
    return { referencias: join(base, 'Referencias'), assets: existsSync(assets) ? assets : null };
  }
  if (existsSync(join(base, 'cartas.es.json'))) return { referencias: base, assets: null };
  return fallar(
    `En ${base} no hay ni Referencias/cartas.es.json ni cartas.es.json. Indica la carpeta que contiene Referencias/.`,
  );
}

function descargar(repo: string): { referencias: string; assets: string | null; temporal: string } {
  const temporal = mkdtempSync(join(tmpdir(), 'hts-recursos-'));
  console.log(`Descargando los recursos de ${repo}…`);
  try {
    execFileSync('git', ['clone', '--depth', '1', '--quiet', repo, temporal], { stdio: 'inherit' });
  } catch {
    rmSync(temporal, { recursive: true, force: true });
    return fallar(
      [
        'No se pudieron descargar los recursos. Comprueba que:',
        '  - tienes acceso al repositorio privado de recursos (pide al propietario que te invite), y',
        '  - Git tiene tu sesión de GitHub iniciada (por ejemplo, con `gh auth login`).',
        'Si tienes los archivos en otra carpeta: pnpm recursos --desde <carpeta>',
      ].join('\n'),
    );
  }
  const { referencias, assets } = origenDesdeCarpeta(temporal);
  return { referencias, assets, temporal };
}

// ------------------------------------------------------------------ instalar

if (existsSync(RUTA_CARTAS_JSON) && !bandera('--forzar')) {
  console.log('Los recursos ya están instalados (Referencias/cartas.es.json existe).');
  console.log('Para reemplazarlos: pnpm recursos --forzar');
} else {
  const desde = argumento('--desde');
  const origen =
    desde !== undefined
      ? { ...origenDesdeCarpeta(desde), temporal: null }
      : descargar(argumento('--repo') ?? process.env['HTS_RECURSOS_REPO'] ?? REPO_POR_DEFECTO);
  try {
    cpSync(origen.referencias, REFERENCIAS, { recursive: true, force: true });
    if (origen.assets !== null) cpSync(origen.assets, RUTA_ASSETS_CARTAS, { recursive: true });
  } finally {
    if (origen.temporal !== null) rmSync(origen.temporal, { recursive: true, force: true });
  }
  console.log('✔ Recursos copiados en Referencias/.');
}

// ------------------------------------------------------------------ preparar y comprobar

const datos: unknown = JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8'));
const r = ArchivoCartasSchema.safeParse(datos);
if (!r.success) {
  fallar('Referencias/cartas.es.json no cumple el esquema. Detalle: pnpm validate:cards');
}
console.log(`✔ ${r.data.cartas.length} cartas distintas en cartas.es.json.`);

const hayImagenes = existsSync(RUTA_ASSETS_CARTAS) && readdirSync(RUTA_ASSETS_CARTAS).length > 0;
// Una instalación anterior puede tener las cartas pero no el reverso ni el logo.
const faltaReservada = IMAGENES_RESERVADAS.some((f) => !existsSync(join(RUTA_ASSETS_CARTAS, f)));
if (!hayImagenes || faltaReservada || bandera('--forzar')) {
  const { copiadas, faltan } = copiarImagenes();
  console.log(`✔ ${copiadas} imágenes preparadas en assets/cartas/.`);
  if (faltan.length > 0) {
    console.warn(
      `  No se encontró el origen de ${faltan.length} imagen(es); las cartas sin imagen se dibujarán con su texto:`,
    );
    for (const f of faltan) console.warn(`    ${f}`);
  }
} else {
  console.log('✔ Imágenes ya preparadas en assets/cartas/.');
}
console.log('\nListo. Arranca el juego con: pnpm dev   (o pnpm servidor para jugar en línea)');
