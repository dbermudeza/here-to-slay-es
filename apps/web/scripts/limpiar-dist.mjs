// Borra la carpeta de salida (apps/web/dist, u otra indicada como argumento) antes de compilar. Dentro de una carpeta de OneDrive, las carpetas
// sincronizadas son puntos de reanálisis que fs.rmSync (y el vaciado de Vite) no sabe borrar en
// Windows (EPERM); en ese caso se recurre a `rmdir /s /q`, que sí puede.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const dist = fileURLToPath(new URL(`../${process.argv[2] ?? 'dist'}`, import.meta.url));

if (existsSync(dist)) {
  try {
    rmSync(dist, { recursive: true, force: true });
  } catch (error) {
    if (process.platform !== 'win32') throw error;
    execFileSync('cmd.exe', ['/d', '/c', 'rmdir', '/s', '/q', dist], { stdio: 'inherit' });
  }
}
