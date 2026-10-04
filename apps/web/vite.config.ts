import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const RUTA_CARTAS = resolve(RAIZ, 'Referencias/cartas.es.json');

/**
 * Módulo virtual `virtual:cartas`: el contenido de Referencias/cartas.es.json (recurso personal,
 * no versionado), o null si no existe. La app lo valida con el esquema Zod al arrancar.
 */
function cartasPlugin(): Plugin {
  const id = 'virtual:cartas';
  const resuelto = `\0${id}`;
  return {
    name: 'hts-cartas',
    resolveId: (fuente) => (fuente === id ? resuelto : null),
    load(modulo) {
      if (modulo !== resuelto) return null;
      if (!existsSync(RUTA_CARTAS)) return 'export default null;';
      this.addWatchFile(RUTA_CARTAS);
      return `export default ${readFileSync(RUTA_CARTAS, 'utf8')};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cartasPlugin()],
  // Las imágenes de las cartas (assets/cartas/<id>.png) se sirven en /cartas/<id>.png.
  publicDir: resolve(RAIZ, 'assets'),
  server: { port: 5173 },
});
