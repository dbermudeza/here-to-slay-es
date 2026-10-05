/**
 * Arranque del servidor: `pnpm servidor` (compila la web y la sirve) o `pnpm --filter @hts/server start`.
 * Variables: PUERTO (por defecto 3000); DIR_WEB (carpeta de la web compilada, por defecto
 * apps/web/dist), RETARDO_BOT_MS (pausa antes de que actúe un bot) y CELEBRACION_MS (pausa al matar
 * un Monstruo), que usan las pruebas e2e.
 */
import { resolve } from 'node:path';
import { RAIZ, RUTA_CARTAS_JSON } from '../../../packages/cards/src/rutas';
import { apagarAlSalir, arrancar, mostrarDirecciones } from './arranque';

const retardoBot = process.env['RETARDO_BOT_MS'];
const celebracion = process.env['CELEBRACION_MS'];

const { servidor, puerto } = await arrancar({
  rutaCartas: RUTA_CARTAS_JSON,
  dirWeb: resolve(RAIZ, process.env['DIR_WEB'] ?? 'apps/web/dist'),
  puerto: Number(process.env['PUERTO'] ?? 3000),
  ...(retardoBot === undefined ? {} : { retardoBotMs: Number(retardoBot) }),
  ...(celebracion === undefined ? {} : { celebracionMs: Number(celebracion) }),
});
mostrarDirecciones(puerto, 'Ctrl+C para detener.');
apagarAlSalir(servidor);
