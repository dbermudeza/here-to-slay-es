import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { Inicio } from '../src/pantallas/Inicio';
import { reiniciarImagenesFallidas } from '../src/ui/imagenesFallidas';
import { CATALOGO, motor } from './utilidades';

afterEach(cleanup);
beforeEach(reiniciarImagenesFallidas);

describe('Portada: logo', () => {
  it('el h1 se llama "Here to Slay" por el logo (carga inmediata) y, sin imagen, por el texto', () => {
    render(
      <ProveedorCatalogo motor={motor} cartas={CATALOGO}>
        <Inicio onNueva={() => undefined} />
      </ProveedorCatalogo>,
    );
    const titulo = screen.getByRole('heading', { level: 1, name: 'Here to Slay' });
    const img = screen.getByRole('img', { name: 'Here to Slay' });
    expect(titulo.contains(img)).toBe(true);
    expect(img.getAttribute('src')).toBe('/cartas/logo.png');
    expect(img.getAttribute('loading')).not.toBe('lazy');

    fireEvent.error(img);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Here to Slay' })).toBeTruthy();
  });
});
