import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CelebracionMonstruo } from '../src/pantallas/mesa/CelebracionMonstruo';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { useApp } from '../src/estado/app';
import { CATALOGO, motor } from './utilidades';

// Sin animaciones reales: se comprueba qué se pinta en cada fase, no el movimiento.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const quitar = ['initial', 'animate', 'exit', 'transition'];
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      div: ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
        React.createElement(
          'div',
          Object.fromEntries(Object.entries(p).filter(([k]) => !quitar.includes(k))),
          children,
        ),
    },
  };
});

const monstruo = CATALOGO.find((c) => c.tipo === 'monstruo');
if (monstruo === undefined) throw new Error('Falta un Monstruo de prueba');

function montar(restanteMs = 4000, duracionMs = 4000) {
  return render(
    <ProveedorCatalogo motor={motor} cartas={CATALOGO}>
      <CelebracionMonstruo
        cartaId={monstruo?.id ?? ''}
        nombreJugador="Ana"
        nombreMonstruo={monstruo?.nombre ?? ''}
        duracionMs={duracionMs}
        restanteMs={restanteMs}
      />
    </ProveedorCatalogo>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  useApp.setState({ reducirAnimaciones: false });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useApp.setState({ reducirAnimaciones: null });
});

describe('CelebracionMonstruo', () => {
  it('muestra primero la carta, luego el corte y al final el texto con los dos nombres', () => {
    const { container } = montar();
    expect(
      container.querySelector('[aria-label="' + (monstruo?.nombre ?? '') + '"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-celebracion-texto]')).toBeNull();
    act(() => vi.advanceTimersByTime(600));
    expect(container.querySelector('[data-espada]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(container.querySelectorAll('[data-mitad]')).toHaveLength(2);
    act(() => vi.advanceTimersByTime(900));
    expect(container.querySelector('[data-celebracion-texto]')?.textContent).toBe(
      `¡Ana ha derrotado a ${monstruo?.nombre}!`,
    );
  });

  it('bloquea el puntero: ocupa toda la pantalla, sin pointer-events-none, y es decorativo', () => {
    const { container } = montar();
    const fondo = container.querySelector('[data-celebracion]');
    expect(fondo?.className).toContain('fixed inset-0');
    expect(fondo?.className).not.toContain('pointer-events-none');
    expect(fondo?.getAttribute('aria-hidden')).toBe('true');
  });

  it('si se monta cuando queda poco (reconexión), salta directamente al texto', () => {
    const { container } = montar(800);
    expect(container.querySelector('[data-celebracion-texto]')).not.toBeNull();
  });

  it('con "Reducir animaciones" no hay espada ni mitades: carta y luego texto', () => {
    useApp.setState({ reducirAnimaciones: true });
    const { container } = montar();
    expect(container.querySelector('[data-espada]')).toBeNull();
    act(() => vi.advanceTimersByTime(700));
    expect(container.querySelector('[data-espada]')).toBeNull();
    expect(container.querySelector('[data-mitad]')).toBeNull();
    expect(container.querySelector('[data-celebracion-texto]')).toBeNull();
    act(() => vi.advanceTimersByTime(700));
    expect(container.querySelector('[data-celebracion-texto]')).not.toBeNull();
  });
});
