/**
 * Arranque del servidor: `pnpm servidor` (compila la web y la sirve) o `pnpm --filter @hts/server start`.
 * Variables: PUERTO (por defecto 3000); DIR_WEB (carpeta de la web compilada, por defecto
 * apps/web/dist) y RETARDO_BOT_MS (pausa antes de que actúe un bot), que usan las pruebas e2e.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArchivoCartasSchema } from '@hts/cards';
import { crearMotor } from '@hts/engine';
import { RAIZ, RUTA_CARTAS_JSON } from '../../../packages/cards/src/rutas';
import { ipRedLocal } from './red';
import { crearServidor } from './servidor';

const puerto = Number(process.env['PUERTO'] ?? 3000);
const retardoBot = process.env['RETARDO_BOT_MS'];

const { cartas } = ArchivoCartasSchema.parse(JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8')));
const servidor = crearServidor({
  motor: crearMotor(cartas),
  dirWeb: resolve(RAIZ, process.env['DIR_WEB'] ?? 'apps/web/dist'),
  ...(retardoBot === undefined ? {} : { opcionesAnfitrion: { retardoBotMs: Number(retardoBot) } }),
});

const real = await servidor.escuchar(puerto);
const ip = ipRedLocal();

console.log('\nHere to Slay — servidor en línea\n');
console.log(`  En este equipo:     http://localhost:${real}`);
if (ip !== null) console.log(`  En la red local:    http://${ip}:${real}`);
console.log('\nComparte la dirección de la red local con quienes estén en tu misma Wi-Fi.');
console.log('Para jugar por internet: crea la sala desde este equipo y pulsa «Abrir acceso por');
console.log('internet» (necesita cloudflared; ver docs/EN_LINEA.md). Ctrl+C para detener.\n');

const apagar = async (): Promise<void> => {
  await servidor.cerrar();
  process.exit(0);
};
process.on('SIGINT', () => void apagar());
process.on('SIGTERM', () => void apagar());
