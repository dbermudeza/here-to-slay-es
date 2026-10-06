/**
 * Arranque del servidor: `pnpm servidor` (compila la web y la sirve) o `pnpm --filter @hts/server start`.
 * Variables: PUERTO (por defecto 3000); DIR_WEB (carpeta de la web compilada, por defecto
 * apps/web/dist) y, para las pruebas e2e, RETARDO_BOT_MS (pausa antes de que actúe un bot),
 * CELEBRACION_MS (pausa al matar un Monstruo), PAUSA_RESULTADO_MS (pausa de la partida tras un
 * resultado, para que se pueda leer) y PRESENTACION_LIDER_MS (pausa al activarse un Líder).
 */
import { resolve } from 'node:path';
import type { OpcionesAnfitrion } from '@hts/anfitrion';
import { RAIZ, RUTA_CARTAS_JSON } from '../../../packages/cards/src/rutas';
import { apagarAlSalir, arrancar, mostrarDirecciones } from './arranque';

/** Opciones del anfitrión que se pueden fijar por variable de entorno (milisegundos). */
const VARIABLES = {
  retardoBotMs: 'RETARDO_BOT_MS',
  celebracionMs: 'CELEBRACION_MS',
  pausaResultadoMs: 'PAUSA_RESULTADO_MS',
  presentacionLiderMs: 'PRESENTACION_LIDER_MS',
} as const satisfies Partial<Record<keyof OpcionesAnfitrion, string>>;

const opcionesAnfitrion: OpcionesAnfitrion = {};
for (const [opcion, variable] of Object.entries(VARIABLES)) {
  const valor = process.env[variable];
  if (valor !== undefined) opcionesAnfitrion[opcion as keyof typeof VARIABLES] = Number(valor);
}

const { servidor, puerto } = await arrancar({
  rutaCartas: RUTA_CARTAS_JSON,
  dirWeb: resolve(RAIZ, process.env['DIR_WEB'] ?? 'apps/web/dist'),
  puerto: Number(process.env['PUERTO'] ?? 3000),
  opcionesAnfitrion,
});
mostrarDirecciones(puerto, 'Ctrl+C para detener.');
apagarAlSalir(servidor);
