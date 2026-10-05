/** Preparación de partidas desde la interfaz: pantalla de inicio, configuración y salas. */
import { expect, test, type Browser, type Page } from '@playwright/test';

export interface ConfigLocal {
  modo: 'local' | 'bots';
  reglas?: 'normal' | 'dificil';
  /** Modo local: nombres de los jugadores. Modo bots: el primero es el humano. */
  nombres: string[];
  bots?: number;
  semilla?: string;
}

/** Ventanas de 1 s: las partidas e2e no esperan las cuentas regresivas reales. */
async function ventanasCortas(page: Page): Promise<void> {
  await page.getByText('Opciones avanzadas').click();
  for (const etiqueta of [
    'Ventana de desafío (segundos)',
    'Ventana de Modificadores (segundos)',
    'Ventana de Modificadores en un desafío (segundos)',
  ]) {
    await page.getByLabel(etiqueta).fill('1');
  }
}

/** Desde la pantalla de inicio, configura y empieza una partida en este dispositivo o contra bots. */
export async function empezarLocal(page: Page, c: ConfigLocal): Promise<void> {
  await page.goto('/');
  await page
    .getByRole('button', {
      name: c.modo === 'bots' ? /Jugar contra bots/ : /Jugar en este dispositivo/,
    })
    .click();
  await expect(page.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  if (c.reglas === 'dificil') await page.getByText('Difíciles', { exact: true }).click();
  if (c.modo === 'local') {
    await page.getByLabel('Número de jugadores').selectOption(String(c.nombres.length));
    for (const [i, nombre] of c.nombres.entries())
      await page.getByLabel(`Jugador ${i + 1}`, { exact: true }).fill(nombre);
  } else {
    await page.getByLabel('Tu nombre').fill(c.nombres[0] ?? 'Ana');
    await page.getByLabel('Número de bots').selectOption(String(c.bots ?? 2));
    await page.getByText('Normal', { exact: true }).click();
  }
  await ventanasCortas(page);
  if (c.semilla !== undefined) await page.getByLabel(/Semilla/).fill(c.semilla);
  await page.getByRole('button', { name: 'Empezar partida' }).click();
  await expect(page.getByRole('region', { name: 'Tu mano' })).toBeVisible();
}

/** Abre una página nueva (contexto aislado: su propio almacenamiento, como otro dispositivo). */
export async function nuevaPagina(browser: Browser): Promise<Page> {
  // Los contextos nuevos no heredan todas las opciones de `use`: se repiten las que importan.
  const base = test.info().project.use.baseURL;
  const contexto = await browser.newContext({
    ...(base === undefined ? {} : { baseURL: base }),
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await contexto.newPage();
  return page;
}

/** Crea una sala en línea y devuelve su código. */
export async function crearSala(page: Page, nombre: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: /Jugar en línea/ }).click();
  await page.getByLabel('Tu nombre').fill(nombre);
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(page.getByText('Código de la sala').first()).toBeVisible();
  const titulo = await page.getByRole('heading', { level: 1 }).textContent();
  const codigo = /Sala ([A-Z0-9]{5})/.exec(titulo ?? '')?.[1];
  if (codigo === undefined) throw new Error(`No se encontró el código de la sala en "${titulo}"`);
  return codigo;
}

export async function unirseASala(page: Page, codigo: string, nombre: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Jugar en línea/ }).click();
  await page.getByLabel('Tu nombre').fill(nombre);
  await page.getByLabel('Código de la sala').fill(codigo);
  await page.getByRole('button', { name: 'Unirse' }).click();
  await page.getByRole('button', { name: 'Estoy listo' }).click();
}

/** El creador ajusta las ventanas a 1 s, añade bots y empieza. */
export async function empezarSala(page: Page, bots: number): Promise<void> {
  for (let i = 0; i < bots; i++) await page.getByRole('button', { name: 'Bot normal' }).click();
  for (const etiqueta of [
    'Ventana de desafío (segundos)',
    'Ventana de Modificadores (segundos)',
    'Ventana de Modificadores en un desafío (segundos)',
  ]) {
    const campo = page.getByLabel(etiqueta);
    await campo.fill('1');
    await campo.blur();
  }
  await expect(page.getByRole('button', { name: 'Empezar partida' })).toBeEnabled();
  await page.getByRole('button', { name: 'Empezar partida' }).click();
}
