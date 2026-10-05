/**
 * Rendimiento de la mesa en el peor caso habitual: 6 jugadores (1 persona y 5 bots). Mide los
 * tirones (fotogramas que tardan más de 50 ms en llegar) durante la partida y el tiempo hasta ver
 * la portada.
 */
import { expect, test, type Page } from '@playwright/test';
import { jugarHastaElFinal } from '../src/piloto';
import { empezarLocal } from '../src/preparar';

interface Medidas {
  /** Huecos entre fotogramas de más de 50 ms. */
  tirones: number[];
  fotogramas: number;
}

const medidas = (page: Page): Promise<Medidas> =>
  page.evaluate(() => (window as unknown as { __medidas: Medidas }).__medidas);

test('mesa de 6 jugadores sin tirones', async ({ page }) => {
  await page.addInitScript(() => {
    const m: Medidas = { tirones: [], fotogramas: 0 };
    (window as unknown as { __medidas: Medidas }).__medidas = m;
    let previo = performance.now();
    const fotograma = (ahora: number): void => {
      m.fotogramas += 1;
      if (ahora - previo > 50) m.tirones.push(ahora - previo);
      previo = ahora;
      requestAnimationFrame(fotograma);
    };
    requestAnimationFrame(fotograma);
  });

  const inicio = Date.now();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Jugar contra bots/ })).toBeVisible();
  const portadaMs = Date.now() - inicio;

  await empezarLocal(page, { modo: 'bots', nombres: ['Ana'], bots: 5, semilla: 'rendimiento' });
  const r = await jugarHastaElFinal([page], { maxPasos: 60 });

  const { tirones, fotogramas } = await medidas(page);
  const ordenados = [...tirones].sort((a, b) => a - b);
  const maximo = ordenados[ordenados.length - 1] ?? 0;
  const resumen = {
    portadaMs,
    pasos: r.pasos,
    turnos: r.turnos,
    fotogramas,
    tirones: tirones.length,
    porcentajeTirones: Number(((100 * tirones.length) / Math.max(1, fotogramas)).toFixed(2)),
    maximoMs: Math.round(maximo),
  };
  test.info().annotations.push({ type: 'rendimiento', description: JSON.stringify(resumen) });
  console.log('Rendimiento:', resumen);

  // Comprobación del medidor: un bloqueo de 150 ms provocado a propósito se registra.
  const antes = tirones.length;
  await page.evaluate(() => {
    setTimeout(() => {
      const fin = performance.now() + 150;
      while (performance.now() < fin);
    }, 0);
  });
  await expect.poll(async () => (await medidas(page)).tirones.length).toBeGreaterThan(antes);

  // Umbrales generosos: detectan regresiones graves, no variaciones de la máquina.
  expect(portadaMs).toBeLessThan(5000);
  expect(maximo).toBeLessThan(500);
  expect(resumen.porcentajeTirones).toBeLessThan(5);
});
