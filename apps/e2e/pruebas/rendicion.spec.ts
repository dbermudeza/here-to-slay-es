/** Rendirse (D-43): contra bots se puede ver la partida hasta el final; en línea gana el otro humano. */
import { expect, test } from '@playwright/test';
import { jugarHastaElFinal } from '../src/piloto';
import {
  crearSala,
  empezarLocal,
  empezarSala,
  nuevaPagina,
  rendirse,
  unirseASala,
} from '../src/preparar';

test('contra bots: te rindes a mitad de partida y ves cómo terminan los bots', async ({ page }) => {
  await empezarLocal(page, { modo: 'bots', nombres: ['Ana'], bots: 2, semilla: 'rendicion' });
  await jugarHastaElFinal([page], { maxPasos: 10 });
  await rendirse(page);
  await expect(page.getByRole('heading', { name: 'Te has rendido' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver la partida' }).click();
  await expect(page.getByText(/estás viendo la partida/)).toBeVisible();
  await expect(page.getByText('Se ha rendido')).toBeVisible();

  const r = await jugarHastaElFinal([page]);
  expect(r.ganador).not.toBe('j1');
  await expect(page.getByRole('heading', { name: /Bot .* gana la partida/ })).toBeVisible();
});

test('en línea: si Ana se rinde, gana Beto aunque quede un bot', async ({ browser }) => {
  const ana = await nuevaPagina(browser);
  const beto = await nuevaPagina(browser);
  const codigo = await crearSala(ana, 'Ana');
  await unirseASala(beto, codigo, 'Beto');
  await empezarSala(ana, 1);
  await expect(ana.getByRole('region', { name: 'Tu mano' })).toBeVisible();

  await rendirse(ana);
  for (const p of [ana, beto]) {
    await expect(p.getByRole('heading', { name: '¡Beto gana la partida!' })).toBeVisible();
    await expect(
      p.getByRole('dialog').getByText('Todos los demás jugadores se han rendido.'),
    ).toBeVisible();
  }
});
