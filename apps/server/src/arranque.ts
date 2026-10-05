/** Arranque común de `pnpm servidor` (principal.ts) y del ejecutable de escritorio (escritorio.ts). */
import { readFileSync } from 'node:fs';
import { ArchivoCartasSchema } from '@hts/cards';
import { crearMotor } from '@hts/engine';
import { ipRedLocal } from './red';
import { crearServidor, type ServidorHts } from './servidor';

export interface OpcionesArranque {
  rutaCartas: string;
  dirWeb: string;
  puerto: number;
  retardoBotMs?: number;
}

export interface ServidorArrancado {
  servidor: ServidorHts;
  puerto: number;
}

/** Lee las cartas, crea el servidor y lo pone a escuchar. */
export async function arrancar(o: OpcionesArranque): Promise<ServidorArrancado> {
  const { cartas } = ArchivoCartasSchema.parse(JSON.parse(readFileSync(o.rutaCartas, 'utf8')));
  const servidor = crearServidor({
    motor: crearMotor(cartas),
    dirWeb: o.dirWeb,
    ...(o.retardoBotMs === undefined
      ? {}
      : { opcionesAnfitrion: { retardoBotMs: o.retardoBotMs } }),
  });
  try {
    return { servidor, puerto: await servidor.escuchar(o.puerto) };
  } catch (e) {
    await servidor.cerrar().catch(() => undefined);
    throw e;
  }
}

/** Muestra en la consola las direcciones del servidor y cómo compartirlas. */
export function mostrarDirecciones(puerto: number, alCerrar: string): void {
  const ip = ipRedLocal();
  console.log('\nHere to Slay — servidor en línea\n');
  console.log(`  En este equipo:     http://localhost:${puerto}`);
  if (ip !== null) console.log(`  En la red local:    http://${ip}:${puerto}`);
  console.log('\nComparte la dirección de la red local con quienes estén en tu misma Wi-Fi.');
  console.log('Para jugar por internet: crea la sala desde este equipo y pulsa «Abrir acceso por');
  console.log(`internet» (necesita cloudflared; ver docs/EN_LINEA.md). ${alCerrar}\n`);
}

/** Cierra el servidor y termina el proceso con Ctrl+C o al pedir que se detenga. */
export function apagarAlSalir(servidor: ServidorHts): void {
  const apagar = async (): Promise<void> => {
    await servidor.cerrar();
    process.exit(0);
  };
  process.on('SIGINT', () => void apagar());
  process.on('SIGTERM', () => void apagar());
}
