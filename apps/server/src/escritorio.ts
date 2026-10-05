/**
 * Arranque del ejecutable de escritorio (HereToSlay.exe, generado con `pnpm empaquetar`): sirve la
 * web y abre el navegador. Si el servidor ya está en marcha, solo abre el navegador; si el puerto lo
 * ocupa otro programa, usa uno libre. Cerrar la ventana de la consola detiene el servidor.
 *
 * Junto al ejecutable deben estar `web/` (la aplicación compilada, con las imágenes en web/cartas)
 * y `cartas.es.json`. Fuera del ejecutable (con tsx) se usan los del repositorio.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { apagarAlSalir, arrancar, mostrarDirecciones } from './arranque';

const PUERTO = 3000;

export interface RutasEscritorio {
  rutaCartas: string;
  dirWeb: string;
}

/** Dónde están las cartas y la web dentro de la carpeta del ejecutable. */
export function rutasEscritorio(base: string): RutasEscritorio {
  return { rutaCartas: join(base, 'cartas.es.json'), dirWeb: join(base, 'web') };
}

/** ¿Responde ya un servidor de Here to Slay en este puerto? */
export async function estaEnMarcha(puerto: number, esperaMs = 1500): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${puerto}/api/estado`, {
      signal: AbortSignal.timeout(esperaMs),
    });
    if (!r.ok) return false;
    const cuerpo: unknown = await r.json();
    return typeof cuerpo === 'object' && cuerpo !== null && 'salas' in cuerpo;
  } catch {
    return false;
  }
}

/** Abre una dirección en el navegador predeterminado. */
export function abrirNavegador(url: string): void {
  const [orden, args]: [string, string[]] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  const hijo = spawn(orden, args, { detached: true, stdio: 'ignore' });
  hijo.on('error', () => console.log(`No se pudo abrir el navegador: entra en ${url}`));
  hijo.unref();
}

/** Deja el mensaje en pantalla hasta pulsar Intro (la consola se cerraría al terminar). */
export async function esperarIntro(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((fin) => rl.question('\nPulsa Intro para cerrar.', () => fin()));
  rl.close();
}

/** Arranca el servidor (o reutiliza el que ya está en marcha) y abre el navegador. */
export async function principal(rutas: RutasEscritorio): Promise<void> {
  for (const ruta of [rutas.rutaCartas, rutas.dirWeb]) {
    if (!existsSync(ruta))
      throw new Error(`Falta ${ruta}. Vuelve a generarlo con pnpm empaquetar.`);
  }

  if (await estaEnMarcha(PUERTO)) {
    console.log('Here to Slay ya está en marcha: abriendo el navegador…');
    abrirNavegador(`http://localhost:${PUERTO}`);
    return;
  }

  let arrancado;
  try {
    arrancado = await arrancar({ ...rutas, puerto: PUERTO });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e;
    // El puerto lo ocupa otro programa: cualquier puerto libre.
    arrancado = await arrancar({ ...rutas, puerto: 0 });
  }
  mostrarDirecciones(arrancado.puerto, 'Cierra esta ventana para detener el servidor.');
  apagarAlSalir(arrancado.servidor);
  abrirNavegador(`http://localhost:${arrancado.puerto}`);
}
