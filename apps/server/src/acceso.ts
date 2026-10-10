/**
 * Acceso con contraseña (variable CLAVE_ACCESO) para un servidor desplegado en internet: la web
 * lleva el arte y los textos de las cartas, que no deben quedar a la vista de cualquiera. Quien
 * entra por /acceso con la contraseña recibe una cookie firmada (HttpOnly, 30 días) que abre la web,
 * la API, las imágenes y la conexión de Socket.IO. /salud queda libre para el chequeo del alojamiento.
 * Sin contraseña configurada, nada de esto se activa.
 *
 * La cookie es `caducidad.firma`: la firma usa una clave derivada de la contraseña con scrypt (lenta
 * a propósito), así que una cookie filtrada no sirve para adivinar la contraseña sin conexión, y
 * caduca sola aunque el navegador la conserve.
 */
import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export const COOKIE_ACCESO = 'hts_acceso';
const DURACION_S = 30 * 24 * 60 * 60;
/** Intentos fallidos permitidos por IP en cada ventana antes de bloquear un rato. */
const MAX_FALLOS = 10;
/**
 * Tope de intentos fallidos en total por ventana, sea cual sea la IP: detrás de un proxy la IP sale
 * de X-Forwarded-For, que el cliente puede inventar para saltarse el límite por IP.
 */
const MAX_FALLOS_TOTAL = 50;
const VENTANA_FALLOS_MS = 10 * 60_000;
/** IPs recordadas como mucho (con IPs inventadas, la lista no puede crecer sin fin). */
const MAX_IPS = 1000;

function iguales(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Firma y comprobación de la cookie de acceso de una contraseña. */
export interface Acceso {
  /** Valor de una cookie nueva, válida hasta `ahora` + 30 días. */
  cookie(ahora?: number): string;
  /** ¿Es una cookie de esta contraseña y sin caducar? */
  valida(valor: string | null, ahora?: number): boolean;
  /** ¿Es la contraseña? */
  esClave(intento: string): boolean;
}

export function crearAcceso(clave: string): Acceso {
  // Cambiar la contraseña cambia la clave de firma: las sesiones abiertas dejan de valer.
  const llave = scryptSync(clave, 'hts-acceso-v2', 32);
  const firma = (caduca: string): string =>
    createHmac('sha256', llave).update(caduca).digest('base64url');
  return {
    cookie: (ahora = Date.now()) => {
      const caduca = String(Math.floor(ahora / 1000) + DURACION_S);
      return `${caduca}.${firma(caduca)}`;
    },
    valida: (valor, ahora = Date.now()) => {
      const [caduca, f, sobra] = (valor ?? '').split('.');
      if (caduca === undefined || f === undefined || sobra !== undefined) return false;
      if (!/^\d+$/.test(caduca)) return false;
      return iguales(f, firma(caduca)) && Number(caduca) * 1000 > ahora;
    },
    esClave: (intento) => iguales(intento, clave),
  };
}

/** Lee una cookie de la cabecera Cookie. */
export function leerCookie(cabecera: string | undefined, nombre: string): string | null {
  for (const parte of (cabecera ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}

/** ¿La petición (HTTP o el arranque de Socket.IO) trae una cookie de acceso válida? */
export function tieneAcceso(req: Pick<IncomingMessage, 'headers'>, acceso: Acceso): boolean {
  return acceso.valida(leerCookie(req.headers.cookie, COOKIE_ACCESO));
}

/**
 * Solo rutas internas: evita que /acceso?volver= sirva para redirigir a otra web. Los navegadores
 * ignoran tabuladores y saltos de línea en una dirección («/<tab>/otra.web» sería «//otra.web»),
 * así que se rechaza cualquier carácter de control y se comprueba el origen al interpretarla.
 */
export function rutaSegura(volver: unknown): string {
  if (typeof volver !== 'string' || !volver.startsWith('/')) return '/';
  // eslint-disable-next-line no-control-regex -- justo lo que se busca: caracteres de control.
  if (/[\u0000-\u001f\u007f\\]/.test(volver)) return '/';
  let url: URL;
  try {
    url = new URL(volver, 'http://interno');
  } catch {
    return '/';
  }
  if (url.origin !== 'http://interno' || url.pathname.startsWith('/acceso')) return '/';
  return url.pathname + url.search;
}

const escapar = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Página de acceso (HTML mínimo, sin dependencias: se sirve antes de tener acceso a la web). */
function pagina(volver: string, error: string | null): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Here to Slay — acceso</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
    font-family: system-ui, sans-serif; background: #f5f5f4; color: #1c1917; }
  main { width: 100%; max-width: 22rem; background: #fff; border-radius: 1rem; padding: 1.5rem;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.12); }
  h1 { margin: 0 0 0.25rem; font-size: 1.5rem; color: #b45309; }
  p { margin: 0 0 1rem; color: #57534e; }
  label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
  input { box-sizing: border-box; width: 100%; padding: 0.6rem 0.75rem; font-size: 1rem;
    border: 1px solid #a8a29e; border-radius: 0.5rem; }
  button { margin-top: 1rem; width: 100%; padding: 0.65rem; font-size: 1rem; font-weight: 700;
    border: 0; border-radius: 0.5rem; background: #b45309; color: #fff; cursor: pointer; }
  button:hover { background: #92400e; }
  .error { color: #b91c1c; font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    body { background: #0c0a09; color: #f5f5f4; }
    main { background: #1c1917; }
    h1 { color: #fbbf24; }
    p { color: #a8a29e; }
    input { background: #0c0a09; color: #f5f5f4; border-color: #57534e; }
    .error { color: #f87171; }
  }
</style>
</head>
<body>
<main>
  <h1>Here to Slay</h1>
  <p>Esta partida es privada. Escribe la contraseña que te ha pasado quien la organiza.</p>
  ${error === null ? '' : `<p class="error" role="alert">${escapar(error)}</p>`}
  <form method="post" action="/acceso">
    <input type="hidden" name="volver" value="${escapar(volver)}">
    <label for="clave">Contraseña</label>
    <input id="clave" name="clave" type="password" autocomplete="current-password" required autofocus>
    <button type="submit">Entrar</button>
  </form>
</main>
</body>
</html>`;
}

/** Recuento de intentos fallidos (por IP y en total) con ventana deslizante sencilla. */
class Fallos {
  private readonly porIp = new Map<string, { n: number; desde: number }>();
  private total = { n: 0, desde: 0 };

  bloqueado(ip: string, ahora: number): boolean {
    if (ahora - this.total.desde > VENTANA_FALLOS_MS) this.total = { n: 0, desde: ahora };
    const f = this.porIp.get(ip);
    if (f !== undefined && ahora - f.desde > VENTANA_FALLOS_MS) this.porIp.delete(ip);
    return this.total.n >= MAX_FALLOS_TOTAL || (this.porIp.get(ip)?.n ?? 0) >= MAX_FALLOS;
  }

  anotar(ip: string, ahora: number): void {
    this.total.n += 1;
    if (this.porIp.size >= MAX_IPS && !this.porIp.has(ip)) {
      for (const [otra, f] of this.porIp)
        if (ahora - f.desde > VENTANA_FALLOS_MS) this.porIp.delete(otra);
      // Si siguen todas vigentes, se olvida la más antigua (el tope total sigue protegiendo).
      if (this.porIp.size >= MAX_IPS) {
        const primera = this.porIp.keys().next().value;
        if (primera !== undefined) this.porIp.delete(primera);
      }
    }
    const actual = this.porIp.get(ip) ?? { n: 0, desde: ahora };
    this.porIp.set(ip, { n: actual.n + 1, desde: actual.desde });
  }

  olvidar(ip: string): void {
    this.porIp.delete(ip);
  }
}

/**
 * Activa la protección en Fastify: rutas públicas /acceso y /salud; el resto pide la cookie (las
 * páginas redirigen a /acceso, lo demás responde 401). Socket.IO se protege aparte con
 * `tieneAcceso` en su `allowRequest`, porque no pasa por las rutas de Fastify.
 */
export function protegerConClave(app: FastifyInstance, acceso: Acceso): void {
  const fallos = new Fallos();

  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, cuerpo, hecho) => hecho(null, new URLSearchParams(String(cuerpo))),
  );

  app.addHook('onRequest', async (req: FastifyRequest, res: FastifyReply) => {
    const ruta = req.url.split('?')[0] ?? '/';
    if (ruta === '/salud' || ruta === '/acceso' || tieneAcceso(req.raw, acceso)) return;
    const quierePagina = req.method === 'GET' && (req.headers.accept ?? '').includes('text/html');
    if (quierePagina) {
      await res.redirect(`/acceso?volver=${encodeURIComponent(req.url)}`, 302);
      return;
    }
    await res.code(401).send({ ok: false, error: 'SIN_ACCESO' });
  });

  // Nada de lo protegido debe quedar en cachés compartidas (proxy o CDN del alojamiento).
  app.addHook('onSend', async (_req, res) => {
    const actual = res.getHeader('cache-control');
    if (actual === undefined) res.header('Cache-Control', 'private, no-store');
    else if (!String(actual).includes('private')) res.header('Cache-Control', `private, ${actual}`);
  });

  const enviarPagina = (res: FastifyReply, codigo: number, volver: string, error: string | null) =>
    res
      .code(codigo)
      .header('X-Frame-Options', 'DENY')
      .header('Content-Security-Policy', "frame-ancestors 'none'")
      .type('text/html; charset=utf-8')
      .send(pagina(volver, error));

  app.get('/acceso', async (req, res) => {
    const { volver } = req.query as { volver?: unknown };
    if (tieneAcceso(req.raw, acceso)) return res.redirect(rutaSegura(volver), 302);
    return enviarPagina(res, 200, rutaSegura(volver), null);
  });

  app.post('/acceso', async (req, res) => {
    const datos = req.body instanceof URLSearchParams ? req.body : new URLSearchParams();
    const volver = rutaSegura(datos.get('volver'));
    const ip = req.ip;
    const ahora = Date.now();
    if (fallos.bloqueado(ip, ahora)) {
      return enviarPagina(
        res,
        429,
        volver,
        'Demasiados intentos. Espera unos minutos y vuelve a probar.',
      );
    }
    if (!acceso.esClave(datos.get('clave') ?? '')) {
      fallos.anotar(ip, ahora);
      return enviarPagina(res, 401, volver, 'Contraseña incorrecta.');
    }
    fallos.olvidar(ip);
    const segura =
      req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    res.header(
      'Set-Cookie',
      `${COOKIE_ACCESO}=${acceso.cookie(ahora)}; Path=/; Max-Age=${DURACION_S}; HttpOnly; SameSite=Lax${segura}`,
    );
    return res.redirect(volver, 303);
  });
}
