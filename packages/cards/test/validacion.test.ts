import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUTA_CARTAS_JSON } from '../src/rutas';
import { validarCartas } from '../src/validacion';

const heroe = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  tipo: 'heroe',
  nombre: id,
  nombreOriginal: id,
  clase: 'mago',
  tirada: 7,
  copias: 1,
  texto: 't',
  textoOriginal: 't',
  ...extra,
});

describe('validarCartas', () => {
  it('reporta errores de esquema con el id de la carta', () => {
    const { datos, problemas } = validarCartas({
      version: 1,
      cartas: [heroe('heroe_a', { tirada: 'x' })],
    });
    expect(datos).toBeNull();
    expect(problemas).toContainEqual(
      expect.objectContaining({ severidad: 'error', donde: 'heroe_a.tirada' }),
    );
  });

  it('detecta ids duplicados', () => {
    const { problemas } = validarCartas({
      version: 1,
      cartas: [heroe('heroe_a'), heroe('heroe_a')],
    });
    expect(problemas).toContainEqual({
      severidad: 'error',
      donde: 'heroe_a',
      mensaje: 'id duplicado',
    });
  });

  it('avisa de efectos sin mapear, o los marca como error si son obligatorios', () => {
    const datos = { version: 1, cartas: [heroe('heroe_a')] };
    expect(validarCartas(datos).problemas).toContainEqual(
      expect.objectContaining({ severidad: 'aviso', mensaje: 'efecto sin mapear' }),
    );
    expect(validarCartas(datos, { efectosObligatorios: true }).problemas).toContainEqual(
      expect.objectContaining({ severidad: 'error', mensaje: 'efecto sin mapear' }),
    );
  });

  it('detecta efectos referenciados pero no registrados', () => {
    const datos = {
      version: 1,
      cartas: [heroe('heroe_a', { efecto: { tipo: 'dsl', clave: 'robar' } })],
    };
    expect(
      validarCartas(datos, { efectosRegistrados: new Set(['robar']) }).problemas,
    ).not.toContainEqual(
      expect.objectContaining({ donde: 'heroe_a', mensaje: expect.stringContaining('efecto') }),
    );
    expect(validarCartas(datos, { efectosRegistrados: new Set() }).problemas).toContainEqual(
      expect.objectContaining({
        donde: 'heroe_a',
        mensaje: 'efecto "dsl:robar" no está registrado',
      }),
    );
  });

  it('avisa de imágenes inexistentes y de cartas marcadas para revisar', () => {
    const datos = {
      version: 1,
      cartas: [heroe('heroe_a', { imagen: 'heroe_a.png', revisar: true })],
    };
    const { problemas } = validarCartas(datos, { existeImagen: () => false });
    expect(problemas).toContainEqual(
      expect.objectContaining({ donde: 'heroe_a', mensaje: expect.stringContaining('no existe') }),
    );
    expect(problemas).toContainEqual(
      expect.objectContaining({ donde: 'heroe_a', mensaje: 'marcada para revisar' }),
    );
  });

  it('compara los totales con el reglamento', () => {
    const { problemas } = validarCartas({
      version: 1,
      cartas: [heroe('heroe_a', { copias: 115 })],
    });
    expect(problemas.some((p) => p.donde === 'total:mazo principal')).toBe(false);
    expect(problemas.some((p) => p.donde === 'total:monstruos')).toBe(true);
  });
});

describe.skipIf(!existsSync(RUTA_CARTAS_JSON))('Referencias/cartas.es.json', () => {
  const { datos, problemas } = validarCartas(JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8')));

  it('cumple el esquema sin errores', () => {
    expect(problemas.filter((p) => p.severidad === 'error')).toEqual([]);
    expect(datos).not.toBeNull();
  });

  it('tiene 6 líderes (uno por clase) y 15 monstruos', () => {
    const cartas = datos?.cartas ?? [];
    const lideres = cartas.filter((c) => c.tipo === 'lider');
    expect(lideres).toHaveLength(6);
    expect(new Set(lideres.map((c) => (c.tipo === 'lider' ? c.clase : '')))).toHaveProperty(
      'size',
      6,
    );
    expect(cartas.filter((c) => c.tipo === 'monstruo')).toHaveLength(15);
  });

  it('tiene 8 héroes por clase', () => {
    const porClase = new Map<string, number>();
    for (const c of datos?.cartas ?? []) {
      if (c.tipo === 'heroe') porClase.set(c.clase, (porClase.get(c.clase) ?? 0) + 1);
    }
    expect([...porClase.values()]).toEqual([8, 8, 8, 8, 8, 8]);
  });

  it('los totales coinciden con el reglamento (115 / 6 / 15)', () => {
    expect(problemas.filter((p) => p.donde.startsWith('total:'))).toEqual([]);
  });

  it('los héroes conservan su nombre original', () => {
    for (const c of datos?.cartas ?? []) {
      if (c.tipo === 'heroe') expect(c.nombre).toBe(c.nombreOriginal);
    }
  });
});
