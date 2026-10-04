import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RUTA_ASSETS_CARTAS, RUTA_CARTAS_JSON } from '../rutas';
import { validarCartas, type Problema } from '../validacion';

if (!existsSync(RUTA_CARTAS_JSON)) {
  console.error(`✖ No se encuentra ${RUTA_CARTAS_JSON}`);
  process.exit(1);
}

let crudo: unknown;
try {
  crudo = JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8'));
} catch (e) {
  console.error(`✖ cartas.es.json no es JSON válido: ${(e as Error).message}`);
  process.exit(1);
}

const { datos, problemas } = validarCartas(crudo, {
  existeImagen: (archivo) => existsSync(resolve(RUTA_ASSETS_CARTAS, archivo)),
  // Los efectos se registran en la Fase 2; hasta entonces solo se avisan.
  efectosRegistrados: new Set(),
  efectosObligatorios: false,
});

const errores = problemas.filter((p) => p.severidad === 'error');
const avisos = problemas.filter((p) => p.severidad === 'aviso');

const agrupar = (lista: Problema[]): Map<string, string[]> => {
  const m = new Map<string, string[]>();
  for (const p of lista) m.set(p.mensaje, [...(m.get(p.mensaje) ?? []), p.donde]);
  return m;
};

const imprimir = (titulo: string, lista: Problema[]): void => {
  if (lista.length === 0) return;
  console.log(`\n${titulo} (${lista.length})`);
  for (const [mensaje, donde] of agrupar(lista)) {
    console.log(`  • ${mensaje}${donde.length > 1 ? ` — ${donde.length} cartas` : ''}`);
    for (const d of donde) console.log(`      ${d}`);
  }
};

if (datos) {
  console.log(`✔ ${datos.cartas.length} cartas distintas leídas y conformes al esquema.`);
}
imprimir('✖ Errores', errores);
imprimir('⚠ Avisos', avisos);

if (errores.length > 0) {
  console.log(`\nResultado: ${errores.length} error(es).`);
  process.exit(1);
}
console.log(`\nResultado: sin errores (${avisos.length} aviso(s)).`);
