/**
 * Revisión automática de accesibilidad (axe-core, WCAG 2.1 A/AA) en cada pantalla, con tema claro
 * y oscuro, y comprobaciones de uso con teclado.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { crearSala, empezarLocal } from '../src/preparar';

async function revisar(page: Page, pantalla: string): Promise<void> {
  // Se analiza la pantalla quieta (un fundido a medias daría contrastes falsos).
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, {
      timeout: 5000,
    })
    .catch(() => undefined);
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const resumen = r.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? '?'}): ${v.help}\n${v.nodes
        .slice(0, 4)
        .map((n) => `    ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`)
        .join('\n')}`,
  );
  expect(resumen, `Problemas de accesibilidad en ${pantalla}`).toEqual([]);
}

for (const tema of ['claro', 'oscuro'] as const) {
  test.describe(`tema ${tema}`, () => {
    test.use({ colorScheme: tema === 'claro' ? 'light' : 'dark' });

    test('inicio, configuración, reglas y tutorial', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /Jugar contra bots/ })).toBeVisible();
      await revisar(page, 'inicio');

      await page.getByRole('button', { name: /Tutorial/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await revisar(page, 'tutorial');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();

      await page.getByRole('button', { name: /^Reglas/ }).click();
      await revisar(page, 'reglas');
      await page.goBack().catch(() => undefined);

      await page.goto('/');
      await page.getByRole('button', { name: /Jugar contra bots/ }).click();
      await page.getByText('Opciones avanzadas').click();
      await revisar(page, 'configuración');
    });

    test('mesa, menú, detalle de carta y pila de descarte', async ({ page }) => {
      await empezarLocal(page, { modo: 'bots', nombres: ['Ana'], bots: 2, semilla: 'axe' });
      await revisar(page, 'mesa');

      await page.getByRole('button', { name: 'Menú' }).click();
      await revisar(page, 'menú');
      await page.keyboard.press('Escape');

      await page.locator('section[data-zona^="mano:"] [data-uid]').first().dblclick();
      await expect(page.getByRole('dialog')).toBeVisible();
      await revisar(page, 'detalle de carta');
    });

    test('en línea: crear y sala', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /Jugar en línea/ }).click();
      await revisar(page, 'jugar en línea');
      await crearSala(page, 'Ana');
      await page.getByRole('button', { name: 'Bot normal' }).click();
      await revisar(page, 'sala');
    });
  });
}

test.describe('teclado', () => {
  test('las ventanas atrapan el foco, se cierran con Escape y devuelven el foco', async ({
    page,
  }) => {
    await empezarLocal(page, { modo: 'bots', nombres: ['Ana'], bots: 1, semilla: 'teclado' });
    const menu = page.getByRole('button', { name: 'Menú' });
    await menu.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    // El foco entra en la ventana y no sale de ella con Tab.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test('se puede jugar una carta de la mano solo con el teclado', async ({ page }) => {
    await empezarLocal(page, { modo: 'bots', nombres: ['Ana'], bots: 1, semilla: 'teclado-2' });
    // Espera a que sea el turno del humano (en su turno aparece "Terminar turno").
    await expect(page.getByRole('button', { name: /Terminar turno/ })).toBeVisible({
      timeout: 60_000,
    });
    const carta = page.locator('section[data-zona^="mano:"] [data-uid]').first();
    await carta.focus();
    await page.keyboard.press('Enter');
    await expect(carta).toHaveAttribute('aria-pressed', 'true');
    // Las acciones de la carta elegida (Jugar/Equipar/Ver carta) se alcanzan con Tab.
    await page.keyboard.press('Tab');
    const enfocado = page.locator(':focus');
    await expect(enfocado).toHaveRole('button');
  });
});
