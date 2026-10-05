// Hook PostToolUse (Edit|Write): formatea con Prettier el archivo que acaba de editar un agente.
// Lee el JSON del hook por stdin. Respeta .prettierignore y la configuración del proyecto; ignora
// los archivos que Prettier no sabe formatear. Nunca falla: un error de formato no debe bloquear.
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

const raiz = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

try {
  const entrada = JSON.parse(readFileSync(0, 'utf8'));
  const archivo = entrada.tool_response?.filePath ?? entrada.tool_input?.file_path;
  // Solo archivos del proyecto (no los del scratchpad, la memoria ni otros directorios).
  const ruta = typeof archivo === 'string' && archivo !== '' ? relative(raiz, archivo) : '..';
  if (!ruta.startsWith('..') && !isAbsolute(ruta)) {
    const prettier = await import('prettier');
    const info = await prettier.getFileInfo(archivo, {
      ignorePath: resolve(raiz, '.prettierignore'),
    });
    if (!info.ignored && info.inferredParser !== null) {
      const original = readFileSync(archivo, 'utf8');
      const opciones = (await prettier.resolveConfig(archivo)) ?? {};
      const formateado = await prettier.format(original, { ...opciones, filepath: archivo });
      if (formateado !== original) writeFileSync(archivo, formateado);
    }
  }
} catch {
  // Sin formato esta vez: el lint/format del proyecto lo detectará igualmente.
}
