/**
 * Partidas completas en cada modo, jugadas pulsando la interfaz (el piloto decide como el bot
 * normal). Cada prueba termina en la pantalla de victoria.
 */
import { expect, test, type Page } from '@playwright/test';
import { jugarHastaElFinal } from '../src/piloto';
import { crearSala, empezarLocal, empezarSala, nuevaPagina, unirseASala } from '../src/preparar';

/** Recoge los errores de la página: una partida e2e no debe producir ninguno. */
function vigilarErrores(page: Page, errores: string[]): void {
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
}

test('contra bots: 1 persona y 2 bots, reglas normales', async ({ page }) => {
  const errores: string[] = [];
  vigilarErrores(page, errores);
  await empezarLocal(page, { modo: 'bots', nombres: ['Ana'], bots: 2, semilla: 'e2e-bots' });
  const r = await jugarHastaElFinal([page]);
  test.info().annotations.push({ type: 'partida', description: JSON.stringify(r) });
  expect(errores).toEqual([]);
});

test('en este dispositivo: 3 personas pasándose el dispositivo', async ({ page }) => {
  const errores: string[] = [];
  vigilarErrores(page, errores);
  await empezarLocal(page, {
    modo: 'local',
    nombres: ['Ana', 'Beto', 'Caro'],
    semilla: 'e2e-local',
  });
  const r = await jugarHastaElFinal([page]);
  test.info().annotations.push({ type: 'partida', description: JSON.stringify(r) });
  expect(errores).toEqual([]);
});

test('contra bots: reglas difíciles, guardar y continuar, y revancha', async ({ page }) => {
  const errores: string[] = [];
  vigilarErrores(page, errores);
  await empezarLocal(page, {
    modo: 'bots',
    reglas: 'dificil',
    nombres: ['Ana'],
    bots: 1,
    semilla: 'e2e-dificil',
  });
  await expect(page.getByText('Reglas difíciles', { exact: true })).toBeVisible();
  let recargada = false;
  const r = await jugarHastaElFinal([page], {
    // A mitad de la partida se recarga la página y se continúa desde el guardado automático.
    alPaso: async (pasos) => {
      if (recargada || pasos < 25) return;
      recargada = true;
      await page.reload();
      await page.getByRole('button', { name: /Continuar partida/ }).click();
      await expect(page.getByRole('region', { name: 'Tu mano' })).toBeVisible();
    },
  });
  expect(recargada).toBe(true);
  test.info().annotations.push({ type: 'partida', description: JSON.stringify(r) });
  await page.getByRole('button', { name: 'Revancha' }).click();
  await expect(page.getByRole('heading', { name: /gana/i })).toBeHidden();
  await expect(page.getByRole('banner').getByText('Turno 1', { exact: true })).toBeVisible();
  expect(errores).toEqual([]);
});

test('en línea: 2 navegadores y 1 bot, con una recarga a mitad de partida', async ({ browser }) => {
  const errores: string[] = [];
  const ana = await nuevaPagina(browser);
  const beto = await nuevaPagina(browser);
  vigilarErrores(ana, errores);
  vigilarErrores(beto, errores);

  const codigo = await crearSala(ana, 'Ana');
  await unirseASala(beto, codigo, 'Beto');
  await empezarSala(ana, 1);
  for (const p of [ana, beto])
    await expect(p.getByRole('region', { name: 'Tu mano' })).toBeVisible();

  let recargada = false;
  const r = await jugarHastaElFinal([ana, beto], {
    alPaso: async (pasos) => {
      if (recargada || pasos < 20) return;
      recargada = true;
      await beto.reload();
      await beto.getByRole('button', { name: /Volver a tu sala en línea/ }).click();
      await expect(beto.getByRole('region', { name: 'Tu mano' })).toBeVisible();
    },
  });
  expect(recargada).toBe(true);
  test.info().annotations.push({ type: 'partida', description: JSON.stringify(r) });

  // Tras la victoria, el anfitrión puede volver a la sala con los mismos jugadores.
  await ana.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(ana.getByRole('heading', { name: `Sala ${codigo}` })).toBeVisible();
  // Los avisos de reconexión de socket.io no son errores de la aplicación.
  expect(errores.filter((e) => !/WebSocket|socket\.io/i.test(e))).toEqual([]);
});
