import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copiarImagenes, type RutasImagenes } from '../src/imagenes';
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

describe('copiarImagenes', () => {
  let dir: string;
  let rutas: RutasImagenes;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hts-imagenes-'));
    const origenCartas = join(dir, 'Referencias', 'Imagenes', 'Cartas');
    mkdirSync(join(origenCartas, 'Heroes'), { recursive: true });
    writeFileSync(join(origenCartas, 'Heroes', 'A.png'), 'carta-a');
    writeFileSync(
      join(dir, 'cartas.json'),
      JSON.stringify({
        version: 1,
        cartas: [
          heroe('heroe_a', { imagen: 'heroe_a.png', origenImagen: 'Heroes/A.png' }),
          heroe('heroe_b', { imagen: 'heroe_b.png', origenImagen: 'Heroes/B.png' }),
        ],
      }),
    );
    rutas = {
      cartasJson: join(dir, 'cartas.json'),
      origenCartas,
      reverso: join(origenCartas, 'Reverso_carta.png'),
      logo: join(dir, 'Referencias', 'Imagenes', 'here_to_slay_logo.jpg'),
      destino: join(dir, 'assets', 'cartas'),
    };
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('copia el reverso a reverso.png y el logo (.jpg con contenido PNG) a logo.png sin modificarlos', () => {
    writeFileSync(rutas.reverso, 'reverso-bytes');
    writeFileSync(rutas.logo, 'logo-bytes');
    const { copiadas, faltan } = copiarImagenes(rutas);
    expect(copiadas).toBe(3);
    expect(faltan).toEqual(['heroe_b ← Heroes/B.png']);
    expect(readFileSync(join(rutas.destino, 'heroe_a.png'), 'utf8')).toBe('carta-a');
    expect(readFileSync(join(rutas.destino, 'reverso.png'), 'utf8')).toBe('reverso-bytes');
    expect(readFileSync(join(rutas.destino, 'logo.png'), 'utf8')).toBe('logo-bytes');
    // Los originales siguen en su sitio.
    expect(readFileSync(rutas.logo, 'utf8')).toBe('logo-bytes');
  });

  it('si falta el reverso o el logo no falla: lo informa en faltan', () => {
    const { copiadas, faltan } = copiarImagenes(rutas);
    expect(copiadas).toBe(1);
    expect(faltan).toHaveLength(3);
    expect(faltan.some((f) => f.startsWith('reverso de las cartas ←'))).toBe(true);
    expect(faltan.some((f) => f.startsWith('logo del juego ←'))).toBe(true);
    expect(existsSync(join(rutas.destino, 'reverso.png'))).toBe(false);
    expect(existsSync(join(rutas.destino, 'logo.png'))).toBe(false);
  });
});

describe('validarCartas: nombres de imagen reservados', () => {
  it.each(['reverso.png', 'logo.png'])('una carta no puede usar %s', (imagen) => {
    const { problemas } = validarCartas({ version: 1, cartas: [heroe('heroe_a', { imagen })] });
    expect(problemas).toContainEqual(
      expect.objectContaining({ severidad: 'error', donde: 'heroe_a' }),
    );
  });
});
