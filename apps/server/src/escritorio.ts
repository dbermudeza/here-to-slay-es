/**
 * Acceso directo de escritorio («Here to Slay.url», generado con `pnpm empaquetar`): al abrirlo con
 * doble clic, Windows abre en el navegador el juego desplegado en internet (`URL_EN_LINEA`, que pide
 * contraseña). Es un acceso directo de internet de Windows: ocupa unos bytes, abre al instante y el
 * antivirus no tiene nada que analizar. Para jugar con un servidor en este equipo (misma Wi-Fi o sin
 * internet) está `pnpm servidor`.
 */

/** Dirección del juego desplegado en Render (docs/DESPLIEGUE.md); pide contraseña al entrar. */
export const URL_EN_LINEA = 'https://here-to-slay-13l0.onrender.com';

/**
 * Contenido de un acceso directo de internet de Windows (.url). `icono` es la ruta absoluta del
 * .ico: Windows no resuelve rutas relativas en estos archivos. Usa saltos de línea CRLF.
 */
export function contenidoAccesoDirecto(url: string, icono?: string): string {
  const lineas = ['[InternetShortcut]', `URL=${url}`];
  if (icono) lineas.push(`IconFile=${icono}`, 'IconIndex=0');
  return lineas.join('\r\n') + '\r\n';
}
