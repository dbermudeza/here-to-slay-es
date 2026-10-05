import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETARDO_ROTULO_MS, RotuloTurno } from '../src/pantallas/mesa/RotuloTurno';

// Sin animaciones: la salida de Framer Motion no termina con temporizadores falsos en jsdom.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      div: ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
        React.createElement('div', { className: String(p['className'] ?? '') }, children),
    },
  };
});

type Props = Parameters<typeof RotuloTurno>[0];
const base: Props = {
  numero: 3,
  jugador: 'j1',
  titulo: 'Tu turno',
  pausado: false,
  anunciarAlMontar: false,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RotuloTurno', () => {
  it('no aparece al montar la mesa a mitad de partida', () => {
    const { container } = render(<RotuloTurno {...base} />);
    expect(container.textContent).toBe('');
  });

  it('aparece al montar si es el primer turno intacto', () => {
    const { container } = render(<RotuloTurno {...base} numero={1} anunciarAlMontar />);
    expect(container.textContent).toContain('Tu turno');
    expect(container.textContent).toContain('Turno 1');
  });

  it('aparece al cambiar de turno, con el texto de "yo" y el de otro jugador', () => {
    const { container, rerender } = render(<RotuloTurno {...base} />);
    rerender(<RotuloTurno {...base} numero={4} jugador="j2" titulo="Turno de Ana" />);
    expect(container.textContent).toContain('Turno de Ana');
    expect(container.textContent).toContain('Turno 4');
    rerender(<RotuloTurno {...base} numero={5} jugador="j1" titulo="Tu turno" />);
    expect(container.textContent).toContain('Tu turno');
    expect(container.textContent).not.toContain('Turno de Ana');
  });

  it('desaparece solo y no bloquea el ratón', () => {
    const { container, rerender } = render(<RotuloTurno {...base} />);
    rerender(<RotuloTurno {...base} numero={4} jugador="j2" titulo="Turno de Ana" />);
    expect(container.querySelector('.pointer-events-none')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(RETARDO_ROTULO_MS + 1500);
    });
    expect(container.textContent).toBe('');
  });

  it('espera a que se cierre el traspaso para empezar a contar', () => {
    const { container, rerender } = render(<RotuloTurno {...base} />);
    rerender(<RotuloTurno {...base} numero={4} jugador="j2" titulo="Turno de Ana" pausado />);
    act(() => {
      vi.advanceTimersByTime(RETARDO_ROTULO_MS * 3);
    });
    expect(container.textContent).toBe('');
    rerender(<RotuloTurno {...base} numero={4} jugador="j2" titulo="Turno de Ana" />);
    expect(container.textContent).toContain('Turno de Ana');
    act(() => {
      vi.advanceTimersByTime(RETARDO_ROTULO_MS + 1500);
    });
    expect(container.textContent).toBe('');
  });
});
