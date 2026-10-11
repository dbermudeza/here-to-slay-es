/**
 * Arranque del ejecutable de escritorio (HereToSlay.exe, generado con `pnpm empaquetar`). Al abrirlo
 * pregunta cómo jugar (o lo toma del argumento: `web`, `en-linea` o `1`; `local` o `2`):
 * - **web**: abre en el navegador el juego desplegado en internet (`URL_EN_LINEA`, con contraseña).
 * - **local**: sirve la web desde este equipo y abre el navegador. Si el servidor ya está en marcha,
 *   solo abre el navegador; si el puerto lo ocupa otro programa, usa uno libre. Cerrar la ventana
 *   de la consola detiene el servidor.
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

/** Dirección del juego desplegado en Render (docs/DESPLIEGUE.md); pide contraseña al entrar. */
export const URL_EN_LINEA = 'https://here-to-slay-13l0.onrender.com';

export type Modo = 'web' | 'local';

/** Modo pedido por argumento (`HereToSlay.exe web` o `local`, p. ej. desde un acceso directo). */
export function modoDeArgumento(arg: string | undefined): Modo | null {
  const a = (arg ?? '').trim().toLowerCase();
  if (a === 'web' || a === 'en-linea' || a === '1') return 'web';
  if (a === 'local' || a === '2') return 'local';
  return null;
}

/** Respuesta a la pregunta de la consola: Intro o 1 → web; 2 → local; otra cosa, volver a preguntar. */
export function modoDeRespuesta(respuesta: string): Modo | null {
  const r = respuesta.trim();
  if (r === '' || r === '1') return 'web';
  if (r === '2') return 'local';
  return null;
}

async function preguntarModo(): Promise<Modo> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nHere to Slay\n');
  console.log(`  1) Jugar en internet (${URL_EN_LINEA})`);
  console.log('  2) Servidor en este equipo (misma Wi-Fi o sin internet)\n');
  // El iterador guarda las líneas que lleguen antes de leerlas (no se pierde ninguna respuesta).
  const pedir = (): void => void process.stdout.write('Elige 1 o 2 [1]: ');
  try {
    pedir();
    for await (const linea of rl) {
      const modo = modoDeRespuesta(linea);
      if (modo !== null) return modo;
      pedir();
    }
    return 'web'; // Sin entrada (se cerró): lo más habitual.
  } finally {
    rl.close();
  }
}

/** Abre el juego desplegado y deja el aviso unos segundos antes de cerrar la ventana. */
async function jugarEnInternet(): Promise<void> {
  console.log(`\nAbriendo ${URL_EN_LINEA} …`);
  console.log('Te pedirá la contraseña. Si nadie había jugado en un rato, el servidor estaba');
  console.log('dormido y la primera carga puede tardar hasta un minuto.');
  abrirNavegador(URL_EN_LINEA);
  await new Promise((fin) => setTimeout(fin, 6000));
}

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

/** Pregunta (o lee del argumento) cómo jugar y lo pone en marcha. */
export async function principal(rutas: RutasEscritorio, argumento?: string): Promise<void> {
  const modo = modoDeArgumento(argumento) ?? (await preguntarModo());
  if (modo === 'web') await jugarEnInternet();
  else await servidorLocal(rutas);
}

/** Arranca el servidor (o reutiliza el que ya está en marcha) y abre el navegador. */
async function servidorLocal(rutas: RutasEscritorio): Promise<void> {
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
