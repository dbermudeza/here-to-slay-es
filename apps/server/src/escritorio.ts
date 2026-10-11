/**
 * Lanzador de escritorio (HereToSlay.exe, generado con `pnpm empaquetar`): abre en el navegador el
 * juego desplegado en internet (`URL_EN_LINEA`, que pide contraseña) y termina. Se empaqueta como
 * aplicación gráfica de Windows, así que no muestra ninguna ventana de consola. Para jugar con un
 * servidor en este equipo (misma Wi-Fi o sin internet) está `pnpm servidor`.
 */
import { spawn } from 'node:child_process';

/** Dirección del juego desplegado en Render (docs/DESPLIEGUE.md); pide contraseña al entrar. */
export const URL_EN_LINEA = 'https://here-to-slay-13l0.onrender.com';

/** Orden del sistema que abre una dirección en el navegador predeterminado. */
export function ordenNavegador(
  url: string,
  plataforma: NodeJS.Platform = process.platform,
): [string, string[]] {
  if (plataforma === 'win32') return ['rundll32', ['url.dll,FileProtocolHandler', url]];
  if (plataforma === 'darwin') return ['open', [url]];
  return ['xdg-open', [url]];
}

/** Abre una dirección en el navegador predeterminado; se resuelve cuando la orden ya se lanzó. */
export function abrirNavegador(url: string): Promise<void> {
  const [orden, args] = ordenNavegador(url);
  return new Promise((fin) => {
    const hijo = spawn(orden, args, { detached: true, stdio: 'ignore', windowsHide: true });
    hijo.on('spawn', () => {
      hijo.unref();
      fin();
    });
    // Sin consola no hay a quién avisar: si falla, el lanzador simplemente termina.
    hijo.on('error', () => fin());
  });
}

/** Abre el juego en línea. */
export async function principal(): Promise<void> {
  await abrirNavegador(URL_EN_LINEA);
}
