/** Sesión en línea guardada en el navegador (para volver a la sala tras recargar). */
import type { Sesion } from '@hts/anfitrion';

const CLAVE_SESION = 'hts:sesion';

export function leerSesion(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE_SESION);
    const s: unknown = crudo === null ? null : JSON.parse(crudo);
    if (typeof s === 'object' && s !== null && 'codigo' in s && 'token' in s && 'jugador' in s)
      return s as Sesion;
  } catch {
    // Sin almacenamiento o dato corrupto: no hay sesión.
  }
  return null;
}

export function guardarSesion(s: Sesion | null): void {
  try {
    if (s === null) localStorage.removeItem(CLAVE_SESION);
    else localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
  } catch {
    // Sin almacenamiento: no se podrá reanudar tras recargar la página.
  }
}
