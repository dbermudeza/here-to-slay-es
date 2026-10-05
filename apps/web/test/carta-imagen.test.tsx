import type { Carta as DatosCarta } from '@hts/cards';
import type { Motor } from '@hts/engine';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { Carta } from '../src/ui/Carta';
import { reiniciarImagenesFallidas } from '../src/ui/imagenesFallidas';
import { CATALOGO } from './utilidades';

afterEach(cleanup);
beforeEach(reiniciarImagenesFallidas);

const heroes = CATALOGO.filter((c) => c.tipo === 'heroe').slice(0, 2);
const cartas: DatosCarta[] = heroes.map((c, i) => ({ ...c, imagen: `prueba${i}.png` }));
const [a, b] = cartas;
if (a === undefined || b === undefined) throw new Error('Faltan héroes de prueba');
const motorFalso = { catalogo: new Map(cartas.map((c) => [c.id, c])) } as unknown as Motor;

function montar(id: string) {
  const ui = (cartaId: string) => (
    <ProveedorCatalogo motor={motorFalso} cartas={cartas}>
      <Carta cartaId={cartaId} tamano="lg" />
    </ProveedorCatalogo>
  );
  const r = render(ui(id));
  return { cambiar: (otro: string) => r.rerender(ui(otro)) };
}

describe('Carta: imagen que falla', () => {
  it('muestra la carta genérica y reintenta al cambiar de carta y al recuperar el foco', () => {
    const { cambiar } = montar(a.id);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/cartas/prueba0.png');

    fireEvent.error(img);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(a.nombre)).toBeTruthy();

    cambiar(b.id);
    expect(screen.getByRole('img').getAttribute('src')).toBe('/cartas/prueba1.png');

    cambiar(a.id);
    expect(screen.queryByRole('img')).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(screen.getByRole('img').getAttribute('src')).toMatch(/^\/cartas\/prueba0\.png\?r=\d+$/);

    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByRole('img')).toBeTruthy();
  });

  it('un focus no toca las imágenes que cargaron bien', () => {
    montar(a.id);
    const img = screen.getByRole('img');
    fireEvent.load(img);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    const despues = screen.getByRole('img');
    expect(despues).toBe(img);
    expect(despues.getAttribute('src')).toBe('/cartas/prueba0.png');
  });

  it('con una fallida y otra buena, solo la fallida cambia de src', () => {
    render(
      <ProveedorCatalogo motor={motorFalso} cartas={cartas}>
        <Carta cartaId={a.id} />
        <Carta cartaId={b.id} />
      </ProveedorCatalogo>,
    );
    const [ia, ib] = screen.getAllByRole('img');
    if (ia === undefined || ib === undefined) throw new Error('faltan imágenes');
    fireEvent.load(ib);
    fireEvent.error(ia);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('src'))).toEqual([
      expect.stringMatching(/^\/cartas\/prueba0\.png\?r=\d+$/),
      '/cartas/prueba1.png',
    ]);
  });
});

describe('Carta boca abajo', () => {
  it('muestra la imagen del reverso y, si falla, el degradado de reserva', () => {
    render(
      <ProveedorCatalogo motor={motorFalso} cartas={cartas}>
        <Carta cartaId={null} tamano="lg" />
      </ProveedorCatalogo>,
    );
    const img = screen.getByRole('img', { name: 'Here to Slay' });
    expect(img.getAttribute('src')).toBe('/cartas/reverso.png');
    expect(img.className).toContain('object-cover');

    fireEvent.error(img);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByLabelText('Here to Slay')).toBeTruthy();
    expect(screen.getByText('Here to Slay')).toBeTruthy();
  });
});
