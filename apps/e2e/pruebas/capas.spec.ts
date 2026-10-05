/**
 * Jerarquía de capas de la mesa (apps/web/src/ui/capas.ts): el vuelo de una carta queda debajo de los
 * modales y del rótulo de turno. Se comprueba con una partida real contra bots y animaciones activas.
 * Con `HTS_CAPTURAS=<carpeta>` se guardan capturas de cada caso.
 */
import { expect, test, type Page } from '@playwright/test';
import { ejecutar, type Paso } from '../src/piloto';
import { empezarLocal } from '../src/preparar';

const VUELO = '[aria-live="polite"].fixed [role="status"]';
const ROTULO = '[data-rotulo-turno] p';

interface Hts {
  sugerencia: () => Paso | null;
}

async function capturar(page: Page, nombre: string): Promise<void> {
  const carpeta = process.env['HTS_CAPTURAS'];
  if (carpeta !== undefined) await page.screenshot({ path: `${carpeta}/${nombre}.png` });
}

/** Juega con el piloto hasta que se cumpla `condicion` (se evalúa tras cada paso). */
async function jugarHasta(page: Page, condicion: () => Promise<boolean>): Promise<void> {
  const limite = Date.now() + 120_000;
  while (Date.now() < limite) {
    if (await condicion()) return;
    const paso = await page.evaluate(() =>
      (window as unknown as { __hts: Hts }).__hts.sugerencia(),
    );
    if (paso !== null && paso.tipo !== 'esperar' && paso.tipo !== 'fin') {
      await ejecutar(page, paso).catch(() => undefined);
    }
    await page.waitForTimeout(30);
  }
  throw new Error('No se dio la situación buscada');
}

const zIndex = (page: Page, selector: string): Promise<number> =>
  page.evaluate((s) => {
    let el: Element | null = document.querySelector(s);
    while (el !== null && getComputedStyle(el).position !== 'fixed') el = el.parentElement;
    return el === null ? Number.NaN : Number(getComputedStyle(el).zIndex);
  }, selector);

for (const tema of ['claro', 'oscuro'] as const) {
  test.describe(`capas, tema ${tema}`, () => {
    test.use({ colorScheme: tema === 'claro' ? 'light' : 'dark', reducedMotion: 'no-preference' });

    test('la ficha de carta queda encima de un vuelo en curso', async ({ page }) => {
      await empezarLocal(page, { modo: 'bots', nombres: ['Ana'], bots: 2, semilla: 'capas' });
      await jugarHasta(page, async () => (await page.locator(VUELO).count()) > 0);
      const zVuelo = await zIndex(page, VUELO);
      await page.locator('section[data-zona^="mano:"] [data-uid]').first().dblclick();
      const dialogo = page.getByRole('dialog');
      await expect(dialogo).toBeVisible();
      const zModal = await zIndex(page, '[role="dialog"]');
      expect(zModal).toBeGreaterThan(zVuelo);

      // Si el vuelo sigue en pantalla, lo que hay en su posición es el modal, no la carta que vuela.
      const caja = await page.locator(VUELO).first().boundingBox();
      if (caja !== null) {
        const tapado = await page.evaluate(
          ({ x, y }) => {
            const el = document.elementFromPoint(x, y);
            return el !== null && el.closest('[aria-live="polite"].fixed') === null;
          },
          { x: caja.x + 4, y: caja.y + 4 },
        );
        expect(tapado).toBe(true);
      }
      await capturar(page, `ficha-sobre-vuelo-${tema}`);
    });

    test('el rótulo de turno queda encima de un vuelo simultáneo', async ({ page }) => {
      await empezarLocal(page, { modo: 'bots', nombres: ['Ana'], bots: 2, semilla: 'capas' });
      await jugarHasta(
        page,
        async () =>
          (await page.locator(VUELO).count()) > 0 && (await page.locator(ROTULO).count()) > 0,
      );
      expect(await zIndex(page, ROTULO)).toBeGreaterThan(await zIndex(page, VUELO));
      await capturar(page, `rotulo-sobre-vuelo-${tema}`);
    });
  });
}
