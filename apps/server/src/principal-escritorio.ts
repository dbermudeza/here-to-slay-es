/**
 * Punto de entrada de HereToSlay.exe (ver escritorio.ts y apps/server/scripts/empaquetar.ts).
 * Empaquetado, la web y las cartas están junto al ejecutable; con tsx, en el repositorio.
 */
import { dirname, join } from 'node:path';
import { isSea } from 'node:sea';
import { RAIZ, RUTA_CARTAS_JSON } from '../../../packages/cards/src/rutas';
import { esperarIntro, principal, rutasEscritorio } from './escritorio';

const rutas = isSea()
  ? rutasEscritorio(dirname(process.execPath))
  : { rutaCartas: RUTA_CARTAS_JSON, dirWeb: join(RAIZ, 'apps/web/dist') };

// argv[2]: `web` o `local` (con el ejecutable empaquetado, argv[0] y argv[1] son el propio .exe).
principal(rutas, process.argv[2]).catch(async (e: unknown) => {
  console.error(
    `\nNo se pudo arrancar Here to Slay: ${e instanceof Error ? e.message : String(e)}`,
  );
  await esperarIntro();
  process.exit(1);
});
