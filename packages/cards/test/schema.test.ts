import { describe, expect, it } from 'vitest';
import { CartaSchema } from '../src/schema';

const heroe = {
  id: 'heroe_bad_axe',
  tipo: 'heroe',
  nombre: 'Bad Axe',
  nombreOriginal: 'Bad Axe',
  clase: 'luchador',
  tirada: 8,
  copias: 1,
  texto: 'DESTRUYE una carta de Héroe.',
  textoOriginal: 'DESTROY a Hero card.',
};

const monstruo = {
  id: 'monstruo_dracos',
  tipo: 'monstruo',
  nombre: 'Dracos',
  nombreOriginal: 'Dracos',
  copias: 1,
  requisitos: ['heroe'],
  exito: {
    rango: { tipo: 'max', valor: 5 },
    accion: { tipo: 'matar' },
    texto: 'MATA',
    textoOriginal: 'SLAY',
  },
  fracaso: {
    rango: { tipo: 'min', valor: 8 },
    accion: { tipo: 'sacrificar', cantidad: 1 },
    texto: 'SACRIFICA',
    textoOriginal: 'SACRIFICE',
  },
  texto: 'x',
  textoOriginal: 'x',
};

describe('CartaSchema', () => {
  it('acepta un héroe válido y rellena valores por defecto', () => {
    const c = CartaSchema.parse(heroe);
    expect(c).toMatchObject({ expansion: 'base', revisar: false, efecto: null });
  });

  it('rechaza ids con tildes, mayúsculas o espacios', () => {
    for (const id of ['heroe_canción', 'Heroe_x', 'heroe x', '_heroe', 'heroe__x']) {
      expect(CartaSchema.safeParse({ ...heroe, id }).success, id).toBe(false);
    }
  });

  it('rechaza clases que no existen en el juego base', () => {
    expect(CartaSchema.safeParse({ ...heroe, clase: 'hechicero' }).success).toBe(false);
  });

  it('rechaza tiradas fuera del rango de 2d6', () => {
    expect(CartaSchema.safeParse({ ...heroe, tirada: 1 }).success).toBe(false);
    expect(CartaSchema.safeParse({ ...heroe, tirada: 14 }).success).toBe(false);
  });

  it('exige texto en héroes', () => {
    expect(CartaSchema.safeParse({ ...heroe, texto: undefined }).success).toBe(false);
  });

  it('acepta monstruos con rangos invertidos (Dracos)', () => {
    expect(CartaSchema.safeParse(monstruo).success).toBe(true);
  });

  it('exige que el éxito mate y que el fracaso no mate', () => {
    const exitoQueSacrifica = { ...monstruo.exito, accion: { tipo: 'sacrificar', cantidad: 1 } };
    const fracasoQueMata = { ...monstruo.fracaso, accion: { tipo: 'matar', robar: 0 } };
    expect(CartaSchema.safeParse({ ...monstruo, exito: exitoQueSacrifica }).success).toBe(false);
    expect(CartaSchema.safeParse({ ...monstruo, fracaso: fracasoQueMata }).success).toBe(false);
  });

  it('exige al menos un requisito en monstruos', () => {
    expect(CartaSchema.safeParse({ ...monstruo, requisitos: [] }).success).toBe(false);
  });

  it('acepta modificadores de una o dos opciones y rechaza 0', () => {
    const base = {
      id: 'modificador_mas4',
      tipo: 'modificador',
      nombre: 'M',
      nombreOriginal: 'M',
      copias: 4,
    };
    expect(CartaSchema.safeParse({ ...base, opciones: [4] }).success).toBe(true);
    expect(CartaSchema.safeParse({ ...base, opciones: [1, -3] }).success).toBe(true);
    expect(CartaSchema.safeParse({ ...base, opciones: [0] }).success).toBe(false);
    expect(CartaSchema.safeParse({ ...base, opciones: [1, 2, 3] }).success).toBe(false);
  });

  it('acepta referencias de efecto dsl/custom/ninguno', () => {
    for (const efecto of [
      { tipo: 'dsl', clave: 'robar' },
      { tipo: 'custom', clave: 'x' },
      { tipo: 'ninguno' },
    ]) {
      expect(CartaSchema.safeParse({ ...heroe, efecto }).success).toBe(true);
    }
    expect(CartaSchema.safeParse({ ...heroe, efecto: { tipo: 'dsl' } }).success).toBe(false);
  });
});
