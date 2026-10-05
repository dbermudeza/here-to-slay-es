import { defineConfig, devices } from '@playwright/test';

/** Puerto propio para no chocar con un `pnpm servidor` abierto. */
export const PUERTO = 3100;

/**
 * Pruebas e2e: un servidor sirve la compilación de pruebas (`vite build --mode e2e`, que incluye el
 * piloto) y atiende las partidas en línea. Se lanza con `pnpm e2e` desde la raíz.
 */
export default defineConfig({
  testDir: './pruebas',
  // Cada partida completa dura unos minutos.
  timeout: 15 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'informe' }]],
  outputDir: 'resultados',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PUERTO}`,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'funcional', testIgnore: /rendimiento/ },
    // El rendimiento se mide al final, sin otras pruebas en paralelo que lo falseen.
    { name: 'rendimiento', testMatch: /rendimiento/, dependencies: ['funcional'] },
  ],
  webServer: {
    command: 'pnpm --filter @hts/server start',
    cwd: '../..',
    url: `http://localhost:${PUERTO}/api/estado`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PUERTO: String(PUERTO),
      DIR_WEB: 'apps/web/dist-e2e',
      RETARDO_BOT_MS: '40',
    },
  },
});
