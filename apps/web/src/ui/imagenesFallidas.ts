/**
 * Registro compartido de intentos de carga de imágenes. Cuando una imagen falla se muestra la carta
 * genérica; al recuperar el foco o la conexión se sube el "intento" y las cartas vuelven a pedir su
 * imagen (con un parámetro distinto, para no reutilizar el error en caché).
 */
let intento = 0;
const fallidas = new Set<string>();
const oyentes = new Set<() => void>();

/** Anota una imagen que no cargó (pendiente de reintento). */
export const marcarFallida = (imagen: string): void => {
  fallidas.add(imagen);
};

/** Quita una imagen del registro (cargó bien). */
export const marcarCargada = (imagen: string): void => {
  fallidas.delete(imagen);
};

/** Solo de pruebas: vacía el registro y el contador. */
export function reiniciarImagenesFallidas(): void {
  fallidas.clear();
  intento = 0;
}

function reintentar(): void {
  if (fallidas.size === 0) return;
  fallidas.clear();
  intento += 1;
  oyentes.forEach((fn) => fn());
}

export function suscribirIntentos(fn: () => void): () => void {
  if (oyentes.size === 0) {
    window.addEventListener('focus', reintentar);
    window.addEventListener('online', reintentar);
  }
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
    if (oyentes.size === 0) {
      window.removeEventListener('focus', reintentar);
      window.removeEventListener('online', reintentar);
    }
  };
}

export const intentoActual = (): number => intento;
