import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import {
  A,
  B,
  CARTAS,
  cerrarVentana,
  describeReal,
  evento,
  forzarDados,
  hacer,
  heroe,
  mano,
  mesa,
  motor,
} from './reales';

const MODIFICADORES: [string, number[]][] = [
  ['modificador_mas1_menos3', [1, -3]],
  ['modificador_mas2_menos2', [2, -2]],
  ['modificador_mas3_menos1', [3, -1]],
  ['modificador_mas4', [4]],
  ['modificador_menos4', [-4]],
];

describeReal('Modificadores y Desafío (motor núcleo)', () => {
  it.each(MODIFICADORES)(
    '%s: se juega sobre cualquier tirada con los valores %j',
    (id, valores) => {
      for (const valor of valores) {
        const s = mesa();
        const x = heroe(s, A, 'heroe_peanut');
        const [mod] = mano(s, B, id);
        let r = hacer(motor, forzarDados(s, 3, 4), A, { tipo: 'TIRAR_HEROE', uid: x });
        r = hacer(motor, r.state, B, {
          tipo: 'JUGAR_MODIFICADOR',
          uid: mod ?? '',
          valor,
          tirada: 0,
        });
        r = cerrarVentana(r.state);
        expect(evento(r, 'tiradaFinal')[0]).toMatchObject({
          modificadores: valor,
          total: 7 + valor,
        });
      }
      const s = mesa();
      heroe(s, A, 'heroe_peanut');
      const [mod] = mano(s, B, id);
      const invalido = [1, 2, 3, 4, -1, -2, -3, -4].find((v) => !valores.includes(v)) ?? 0;
      expect(
        motor.validar(s, {
          actor: B,
          accion: { tipo: 'JUGAR_MODIFICADOR', uid: mod ?? '', valor: invalido, tirada: 0 },
        }),
      ).not.toBeNull();
    },
  );

  it('desafio: anula la carta jugada si el desafiante saca igual o más', () => {
    const s = mesa();
    const [h] = mano(s, A, 'heroe_peanut');
    const [d] = mano(s, B, 'desafio');
    let r = hacer(motor, s, A, { tipo: 'JUGAR_CARTA', uid: h ?? '' });
    r = hacer(motor, forzarDados(r.state, 2, 2, 2, 2), B, { tipo: 'DESAFIAR', uid: d ?? '' });
    r = cerrarVentana(r.state);
    expect(r.state.descarte).toEqual([d, h]);
  });
});

it('cada carta del catálogo tiene al menos un test propio', () => {
  if (CARTAS.length === 0) return;
  const carpeta = fileURLToPath(new URL('.', import.meta.url));
  const textos = readdirSync(carpeta)
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => readFileSync(`${carpeta}/${f}`, 'utf8'))
    .join('\n');
  const sinTest = CARTAS.map((c) => c.id).filter((id) => !textos.includes(`'${id}`));
  expect(sinTest).toEqual([]);
});
