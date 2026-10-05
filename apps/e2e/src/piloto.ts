/**
 * Ejecutor del piloto: pide a la página lo que haría el bot normal (`window.__hts.sugerencia()`,
 * ver apps/web/src/e2e/piloto.ts) y lo hace pulsando la interfaz, como lo haría una persona.
 */
import { expect, type Locator, type Page } from '@playwright/test';

type Respuesta =
  | { jugador: string }
  | { cartas: string[] }
  | { indice: number }
  | { si: boolean }
  | { valor: number }
  | { ok: true };

type Accion =
  | { tipo: 'JUGAR_CARTA'; uid: string; objetivo?: string }
  | { tipo: 'DESAFIAR'; uid: string }
  | { tipo: 'ELEGIR'; uids: string[] }
  | { tipo: 'RESPONDER'; respuesta: Respuesta }
  | { tipo: string };

export type Paso =
  | { tipo: 'accion'; accion: Accion; clave: string }
  | { tipo: 'traspaso'; jugador: string }
  | { tipo: 'responder'; jugador: string }
  | { tipo: 'terminarRespuesta' }
  | { tipo: 'esperar' }
  | { tipo: 'fin'; ganador: string };

interface EstadoPiloto {
  version: number;
  observador: string;
  turno: number;
  ganador: string | null;
}

interface Hts {
  estado: () => EstadoPiloto | null;
  sugerencia: () => Paso | null;
}

/** Mismo criterio que `clave` en la web: JSON con las claves ordenadas. */
export function clave(valor: unknown): string {
  return JSON.stringify(valor, (_k, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

/** Selector de atributo con el valor escapado como cadena CSS. */
const attr = (nombre: string, valor: string, op = '='): string =>
  `[${nombre}${op}${JSON.stringify(valor)}]`;

const hts = (page: Page): Promise<{ estado: EstadoPiloto | null; paso: Paso | null }> =>
  page.evaluate(() => {
    const h = (window as unknown as { __hts?: Hts }).__hts;
    return { estado: h?.estado() ?? null, paso: h?.sugerencia() ?? null };
  });

/** El diálogo más reciente (el anterior puede seguir en el DOM mientras se cierra). */
const dialogo = (page: Page): Locator => page.locator('[role="dialog"]').last();

async function elegirCartas(page: Page, uids: readonly string[]): Promise<void> {
  const d = dialogo(page);
  for (const uid of uids) {
    const carta = d.locator(attr('data-uid', uid));
    // En un reintento la carta puede estar ya elegida: pulsarla otra vez la quitaría.
    if ((await carta.getAttribute('aria-pressed')) !== 'true') await carta.click();
  }
  await d.locator('[data-confirmar]').click();
}

async function ejecutarAccion(page: Page, accion: Accion, claveAccion: string): Promise<void> {
  if (accion.tipo === 'JUGAR_CARTA' && 'uid' in accion) {
    const carta = page.locator('section[data-zona^="mano:"]').locator(attr('data-uid', accion.uid));
    if ((await carta.getAttribute('aria-pressed')) !== 'true') await carta.click();
    if ('objetivo' in accion && accion.objetivo !== undefined) {
      await page.locator(attr('data-equipar', accion.uid)).click();
      await page
        .locator(`[data-zona^="grupo:"] ${attr('data-uid', accion.objetivo)}`)
        .first()
        .click();
    } else {
      await page.locator(attr('data-accion', claveAccion)).click();
    }
    return;
  }
  if (accion.tipo === 'DESAFIAR') {
    // La interfaz ofrece una carta de Desafío cualquiera (todas hacen lo mismo).
    await page
      .locator(attr('data-accion', '{"tipo":"DESAFIAR"', '^='))
      .first()
      .click();
    return;
  }
  if (accion.tipo === 'ELEGIR' && 'uids' in accion) {
    await elegirCartas(page, accion.uids);
    return;
  }
  if (accion.tipo === 'RESPONDER' && 'respuesta' in accion) {
    const r = accion.respuesta;
    if ('cartas' in r) await elegirCartas(page, r.cartas);
    else if ('indice' in r)
      await dialogo(page)
        .locator(attr('data-indice', String(r.indice)))
        .click();
    else
      await dialogo(page)
        .locator(attr('data-respuesta', clave(r)))
        .click();
    return;
  }
  await page.locator(attr('data-accion', claveAccion)).click();
}

/** Ejecuta un paso del piloto pulsando la interfaz. */
export async function ejecutar(page: Page, paso: Paso): Promise<void> {
  switch (paso.tipo) {
    case 'accion':
      return ejecutarAccion(page, paso.accion, paso.clave);
    case 'traspaso':
      return page.locator(attr('data-traspaso', paso.jugador)).click();
    case 'responder':
      return page.locator(attr('data-responde', paso.jugador)).click();
    case 'terminarRespuesta':
      return page.locator('[data-terminar-respuesta]').click();
    case 'esperar':
    case 'fin':
      return undefined;
  }
}

/** Espera (como mucho 3 s) a que la mesa de la página cambie de versión. */
async function esperarCambio(page: Page, version: number): Promise<void> {
  await page
    .waitForFunction(
      (v) => (window as unknown as { __hts?: Hts }).__hts?.estado()?.version !== v,
      version,
      { timeout: 3000 },
    )
    .catch(() => undefined);
}

export interface OpcionesPartida {
  /** Se llama tras cada acción, con el número de pasos dados (p. ej. para recargar a mitad). */
  alPaso?: (pasos: number) => Promise<void>;
  /** Tiempo máximo sin ningún cambio en la partida antes de dar la prueba por atascada. */
  maxQuietoMs?: number;
  /** Parar tras este número de pasos aunque nadie haya ganado (ganador null). */
  maxPasos?: number;
}

/**
 * Juega hasta que alguien gana: en cada vuelta, cada página ejecuta lo que propone su piloto.
 * Devuelve el ganador y el número de pasos ejecutados en la interfaz.
 */
export async function jugarHastaElFinal(
  paginas: readonly Page[],
  opciones: OpcionesPartida = {},
): Promise<{ ganador: string | null; pasos: number; turnos: number }> {
  const maxQuieto = opciones.maxQuietoMs ?? 45_000;
  let pasos = 0;
  const inicio = Date.now();
  let ultimoCambio = inicio;
  let firma = '';

  for (;;) {
    let actuo = false;
    let ganador: string | null = null;
    let turnos = 0;
    const firmas: string[] = [];
    for (const page of paginas) {
      const { estado, paso } = await hts(page);
      firmas.push(`${estado?.version ?? '-'}:${JSON.stringify(paso)}`);
      if (estado !== null) turnos = Math.max(turnos, estado.turno);
      if (paso?.tipo === 'fin') {
        ganador = paso.ganador;
        continue;
      }
      if (paso === null || paso.tipo === 'esperar') continue;
      try {
        await ejecutar(page, paso);
        // En línea el estado cambia cuando responde el servidor: hasta entonces la sugerencia
        // seguiría siendo la misma y se pulsaría un botón que está a punto de desaparecer.
        await esperarCambio(page, estado?.version ?? -1);
      } catch (error) {
        if (process.env['HTS_TRAZA'] !== undefined)
          console.log(`  ✗ ${String(error).split('\n').slice(0, 8).join(' / ')}`);
        // El estado puede haber cambiado entre la sugerencia y el clic (p. ej. venció una ventana):
        // se vuelve a preguntar; si se repite sin cambios, salta el control de atasco.
        const ahora = await hts(page);
        if (JSON.stringify(ahora.paso) === JSON.stringify(paso)) {
          if (Date.now() - ultimoCambio > maxQuieto) throw error;
        }
        continue;
      }
      actuo = true;
      pasos += 1;
      await opciones.alPaso?.(pasos);
    }
    if (opciones.maxPasos !== undefined && pasos >= opciones.maxPasos && ganador === null)
      return { ganador: null, pasos, turnos };
    if (ganador !== null) {
      for (const page of paginas)
        await expect(page.getByRole('heading', { name: /gana/i })).toBeVisible();
      return { ganador, pasos, turnos };
    }

    const nueva = firmas.join('|');
    if (nueva !== firma) {
      if (process.env['HTS_TRAZA'] !== undefined)
        console.log(`${((Date.now() - inicio) / 1000).toFixed(1)}s ${nueva.slice(0, 300)}`);
      firma = nueva;
      ultimoCambio = Date.now();
    } else if (Date.now() - ultimoCambio > maxQuieto) {
      throw new Error(`La partida no avanza desde hace ${maxQuieto} ms: ${nueva}`);
    }
    if (!actuo) await paginas[0]?.waitForTimeout(100);
  }
}
