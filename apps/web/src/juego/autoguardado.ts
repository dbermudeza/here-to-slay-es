/** Guardado automático en el navegador: lectura y borrado (sin cargar el motor de la partida). */
export const CLAVE_AUTO = 'hts:partida';

export function leerAuto(): string | null {
  try {
    return localStorage.getItem(CLAVE_AUTO);
  } catch {
    return null;
  }
}

export function borrarAuto(): void {
  try {
    localStorage.removeItem(CLAVE_AUTO);
  } catch {
    // Nada que borrar.
  }
}
