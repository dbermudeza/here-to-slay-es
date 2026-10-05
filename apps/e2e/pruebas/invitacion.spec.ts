/**
 * Enlace de invitación (…/?sala=CÓDIGO). El túnel de Cloudflare no se abre aquí (sería un acceso
 * real a internet): sus casos están en los tests del servidor con un cloudflared falso.
 */
import { expect, test } from '@playwright/test';
import { crearSala, nuevaPagina } from '../src/preparar';

test('el enlace de invitación lleva directo a unirse con el código puesto', async ({ browser }) => {
  const ana = await nuevaPagina(browser);
  const codigo = await crearSala(ana, 'Ana');
  // Ana está en el equipo del servidor: puede abrir el acceso por internet.
  await expect(ana.getByRole('button', { name: 'Abrir acceso por internet' })).toBeVisible();

  const beto = await nuevaPagina(browser);
  await beto.goto(`/?sala=${codigo}`);
  await expect(beto.getByText(`Te han invitado a la sala ${codigo}`)).toBeVisible();
  await expect(beto.getByLabel('Código de la sala')).toHaveValue(codigo);
  await expect(beto.getByRole('button', { name: 'Crear sala' })).toBeHidden();
  // El código se quita de la dirección para no reutilizarlo sin querer.
  expect(new URL(beto.url()).search).toBe('');

  await beto.getByLabel('Tu nombre').fill('Beto');
  await beto.getByRole('button', { name: 'Unirse' }).click();
  await expect(beto.getByRole('heading', { name: `Sala ${codigo}` })).toBeVisible();
  await expect(ana.getByText('Beto', { exact: true })).toBeVisible();
});
