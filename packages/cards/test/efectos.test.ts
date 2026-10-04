import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CartaSchema,
  DEFINICIONES_EFECTOS,
  DefinicionEfectoSchema,
  PasoSchema,
  problemaDeDefinicion,
  validarCartas,
} from '../src';
import { RUTA_CARTAS_JSON } from '../src/rutas';

describe('DSL de efectos', () => {
  it('las definiciones del juego base son válidas', () => {
    expect(Object.keys(DEFINICIONES_EFECTOS)).toHaveLength(95);
  });

  it('rechaza pasos desconocidos y nombres de variable inválidos', () => {
    expect(PasoSchema.safeParse({ paso: 'teletransportar' }).success).toBe(false);
    expect(PasoSchema.safeParse({ paso: 'robar', cantidad: 1, var: 'Mal-Nombre' }).success).toBe(
      false,
    );
    expect(PasoSchema.safeParse({ paso: 'robar', cantidad: 0 }).success).toBe(false);
    expect(PasoSchema.safeParse({ paso: 'robar', cantidad: 2, si: { var: 'ok' } }).success).toBe(
      true,
    );
  });

  it('una definición necesita programa, pasivas o núcleo, y no admite campos extra', () => {
    expect(DefinicionEfectoSchema.safeParse({}).success).toBe(false);
    expect(DefinicionEfectoSchema.safeParse({ programa: [], extra: 1 }).success).toBe(false);
    expect(DefinicionEfectoSchema.safeParse({ programa: [] }).success).toBe(true);
  });

  it('problemaDeDefinicion comprueba que la forma encaje con el tipo de carta', () => {
    const heroe = CartaSchema.parse({
      id: 'heroe_x',
      tipo: 'heroe',
      nombre: 'X',
      nombreOriginal: 'X',
      clase: 'mago',
      tirada: 7,
      copias: 1,
      texto: 't',
      textoOriginal: 't',
    });
    expect(problemaDeDefinicion(heroe, { programa: [] })).toBeNull();
    expect(
      problemaDeDefinicion(heroe, { pasivas: [{ tipo: 'paExtra', valor: 1 }] }),
    ).not.toBeNull();
    const objeto = CartaSchema.parse({
      ...heroe,
      id: 'objeto_x',
      tipo: 'objeto',
      clase: undefined,
      tirada: undefined,
    });
    expect(problemaDeDefinicion(objeto, { nucleo: 'mascara' })).toMatch(/otorgaClase/);
  });
});

describe.skipIf(!existsSync(RUTA_CARTAS_JSON))('cartas.es.json con efectos obligatorios', () => {
  it('todas las cartas tienen un efecto definido y con la forma correcta', () => {
    const { problemas } = validarCartas(JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8')), {
      efectosRegistrados: new Set(Object.keys(DEFINICIONES_EFECTOS)),
      efectosObligatorios: true,
      definiciones: DEFINICIONES_EFECTOS,
    });
    expect(problemas).toEqual([]);
  });
});
