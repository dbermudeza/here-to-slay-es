import es from './es.json';

type Valores = Record<string, string | number>;

function buscar(clave: string): unknown {
  let actual: unknown = es;
  for (const parte of clave.split('.')) {
    if (typeof actual !== 'object' || actual === null) return undefined;
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
}

/** Texto traducido. Interpola `{nombre}` con `valores`. Si falta la clave, devuelve la propia clave. */
export function t(clave: string, valores: Valores = {}): string {
  const texto = buscar(clave);
  if (typeof texto !== 'string') return clave;
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k] ?? `{${k}}`));
}

/** Lista de textos u objetos (p. ej. las secciones de las reglas). */
export function lista<T>(clave: string): T[] {
  const valor = buscar(clave);
  return Array.isArray(valor) ? (valor as T[]) : [];
}

export const existe = (clave: string): boolean => typeof buscar(clave) === 'string';

/** +2 / −2 con signo tipográfico. */
export const conSigno = (n: number): string => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
