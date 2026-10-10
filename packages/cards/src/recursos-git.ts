/**
 * Ayudas de `pnpm recursos` para clonar el repositorio privado de recursos sin filtrar
 * credenciales en los registros (p. ej. los de compilación de Render, visibles en su panel).
 *
 * El token (`HTS_RECURSOS_TOKEN`) nunca va en la URL ni en los argumentos de `git` (que cualquier
 * usuario del sistema puede ver en la lista de procesos): se pasa como cabecera HTTP
 * `Authorization` mediante la configuración por variables de entorno del proceso hijo
 * (`GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n`, Git ≥ 2.31).
 * No se importa desde `index.ts`: es solo para el script de Node.
 */

/** Oculta las credenciales de las URL de un texto: `https://usuario:secreto@host/…` → `https://***@host/…`. */
export function ocultarCredenciales(texto: string): string {
  return texto.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1***@');
}

/** Oculta credenciales en URL y, además, cualquier aparición literal de los secretos dados. */
export function limpiarSalida(texto: string, secretos: readonly string[] = []): string {
  let limpio = texto;
  for (const s of secretos) if (s.length > 0) limpio = limpio.split(s).join('***');
  return ocultarCredenciales(limpio);
}

/**
 * Prefijo `http.<url>.extraHeader` acotado al origen del repositorio (esquema y host), para que la
 * cabecera solo se envíe a ese servidor. Si la URL no es HTTP(S), devuelve `null`.
 */
function claveCabecera(repo: string): string | null {
  let url: URL;
  try {
    url = new URL(repo);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return `http.${url.protocol}//${url.host}/.extraHeader`;
}

/** Valor de la cabecera de autenticación de GitHub con un token (clásico o de grano fino). */
export function cabeceraAutorizacion(token: string): string {
  const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
  return `Authorization: Basic ${basic}`;
}

export interface OrdenClon {
  /** Argumentos de `git` (sin credenciales). */
  args: string[];
  /** Entorno del proceso hijo (con la cabecera si hay token). */
  env: NodeJS.ProcessEnv;
}

/**
 * Prepara `git clone` del repositorio en `destino`. Con `token`, añade la cabecera de autenticación
 * por entorno (respetando cualquier `GIT_CONFIG_COUNT` previo). Siempre desactiva las preguntas
 * interactivas de Git para que una compilación sin terminal falle en lugar de quedarse colgada.
 */
export function ordenClon(
  repo: string,
  destino: string,
  token: string | undefined,
  base: NodeJS.ProcessEnv,
): OrdenClon {
  const args = ['clone', '--depth', '1', '--quiet', repo, destino];
  const env: NodeJS.ProcessEnv = { ...base, GIT_TERMINAL_PROMPT: '0' };
  if (token === undefined || token.length === 0) return { args, env };
  const clave = claveCabecera(repo);
  if (clave === null) {
    throw new Error('HTS_RECURSOS_TOKEN solo se puede usar con un repositorio https://.');
  }
  const previas = Number.parseInt(base['GIT_CONFIG_COUNT'] ?? '0', 10);
  const n = Number.isFinite(previas) && previas > 0 ? previas : 0;
  env[`GIT_CONFIG_KEY_${n}`] = clave;
  env[`GIT_CONFIG_VALUE_${n}`] = cabeceraAutorizacion(token);
  env['GIT_CONFIG_COUNT'] = String(n + 1);
  return { args, env };
}
