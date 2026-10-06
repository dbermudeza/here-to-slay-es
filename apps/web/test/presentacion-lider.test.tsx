import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../src/estado/app';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { PresentacionLider } from '../src/pantallas/mesa/PresentacionLider';
import { CATALOGO, motor } from './utilidades';

// Sin animaciones reales: se comprueba qué se pinta, no el movimiento.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const quitar = ['initial', 'animate', 'exit', 'transition'];
  const componente =
    (tag: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(
        tag,
        Object.fromEntries(Object.entries(p).filter(([k]) => !quitar.includes(k))),
        children,
      );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy({}, { get: (_t, tag: string) => componente(tag) }),
  };
});

const lider = CATALOGO.find((c) => c.tipo === 'lider');
if (lider === undefined) throw new Error('Falta un Líder de prueba');

function montar(restanteMs = 4000, duracionMs = 4000) {
  return render(
    <ProveedorCatalogo motor={motor} cartas={CATALOGO}>
      <PresentacionLider
        cartaId={lider?.id ?? ''}
        nombreJugador="Ana"
        nombreLider={lider?.nombre ?? ''}
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

describe('PresentacionLider', () => {
  it('enseña la carta del Líder y el texto con el nombre del jugador', () => {
    const { container } = montar();
    expect(container.querySelector(`[aria-label="${lider?.nombre}"]`)).not.toBeNull();
    expect(container.querySelector('[data-presentacion-texto]')?.textContent).toBe(
      '¡Ana activa la habilidad de su Líder!',
    );
    expect(container.textContent).toContain(lider?.nombre);
  });

  it('gira la carta y, al detenerse, aparecen los rayos y las chispas', () => {
    const { container } = montar();
    expect(container.querySelector('[data-giro]')).not.toBeNull();
    expect(container.querySelector('[data-rayos]')).toBeNull();
    act(() => vi.advanceTimersByTime(1300));
    expect(container.querySelectorAll('[data-rayos]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-chispa]').length).toBeGreaterThan(0);
  });

  it('el giro es sobre el eje Y y la carta tiene dorso girado también sobre Y', () => {
    const { container } = montar();
    const dorso = container.querySelector('[data-giro] > div:nth-child(2)') as HTMLElement | null;
    expect(dorso?.style.transform).toBe('rotateY(180deg)');
    expect((container.querySelector('[data-giro]') as HTMLElement).style.transformStyle).toBe(
      'preserve-3d',
    );
  });

  it('los rayos y el texto siguen visibles durante toda la permanencia (hasta 4 s)', () => {
    const { container } = montar();
    act(() => vi.advanceTimersByTime(3900));
    expect(container.querySelector('[data-rayos]')).not.toBeNull();
    expect(container.querySelector('[data-presentacion-texto]')).not.toBeNull();
  });

  it('bloquea el puntero: ocupa toda la pantalla, sin pointer-events-none, y es decorativa', () => {
    const { container } = montar();
    const fondo = container.querySelector('[data-presentacion-lider]');
    expect(fondo?.className).toContain('fixed inset-0');
    expect(fondo?.className).not.toContain('pointer-events-none');
    expect(fondo?.getAttribute('aria-hidden')).toBe('true');
  });

  it('con "Reducir animaciones" no hay giro ni rayos, solo carta y texto', () => {
    useApp.setState({ reducirAnimaciones: true });
    const { container } = montar();
    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelector('[data-giro]')).toBeNull();
    expect(container.querySelector('[data-rayos]')).toBeNull();
    expect(container.querySelector('[data-chispa]')).toBeNull();
    expect(container.querySelector(`[aria-label="${lider?.nombre}"]`)).not.toBeNull();
    expect(container.querySelector('[data-presentacion-texto]')).not.toBeNull();
  });

  it('si se monta cuando queda poco (reconexión), salta el giro y enseña los rayos', () => {
    const { container } = montar(500);
    expect(container.querySelector('[data-rayos]')).not.toBeNull();
  });
});
