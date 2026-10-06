import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CARTAS, HAY_CATALOGO, motor } from '../../../packages/engine/test/cartas/reales';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { DirectorVivo } from '../src/juego/director-vivo';
import { Mesa } from '../src/pantallas/mesa/Mesa';
import { config, RelojFalso } from './utilidades';

afterEach(cleanup);

describe.skipIf(!HAY_CATALOGO)('Partida completa en la interfaz (catálogo real)', () => {
  it('la mesa se pinta en todos los estados de una partida entre bots hasta la victoria', () => {
    const reloj = new RelojFalso();
    const director = DirectorVivo.nueva(
      motor,
      { ...config('bots', ['normal', 'normal', 'facil', 'normal'], 'interfaz'), reglas: 'normal' },
      reloj,
      { retardoBotMs: 50, celebracionMs: 0, presentacionLiderMs: 0 },
    );
    render(
      <ProveedorCatalogo motor={motor} cartas={CARTAS}>
        <Mesa
          director={director}
          onSalir={() => undefined}
          onRevancha={() => undefined}
          onTutorial={() => undefined}
        />
      </ProveedorCatalogo>,
    );
    for (let i = 0; i < 50_000 && director.estado.ganador === null; i++) {
      act(() => reloj.avanzar(500));
    }
    expect(director.estado.ganador).not.toBeNull();
    // Una partida de verdad: muchos eventos y varios turnos.
    expect(director.eventos.length).toBeGreaterThan(200);
    expect(director.estado.turno.numero).toBeGreaterThan(8);
    expect(screen.getByRole('heading', { name: /gana la partida/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revancha' })).toBeInTheDocument();
  }, 300_000);

  it('la mesa muestra la celebración mientras el director la tiene y la quita al acabar', () => {
    const reloj = new RelojFalso();
    const director = DirectorVivo.nueva(
      motor,
      { ...config('bots', ['normal', 'normal', 'normal'], 'celebracion'), reglas: 'normal' },
      reloj,
      { retardoBotMs: 50 },
    );
    const { container } = render(
      <ProveedorCatalogo motor={motor} cartas={CARTAS}>
        <Mesa
          director={director}
          onSalir={() => undefined}
          onRevancha={() => undefined}
          onTutorial={() => undefined}
        />
      </ProveedorCatalogo>,
    );
    expect(container.querySelector('[data-celebracion]')).toBeNull();
    for (let i = 0; i < 50_000 && director.celebracion === null; i++) {
      act(() => reloj.avanzar(100));
    }
    expect(director.celebracion).not.toBeNull();
    expect(container.querySelector('[data-celebracion]')).not.toBeNull();
    act(() => reloj.avanzar(4500));
    expect(container.querySelector('[data-celebracion]')).toBeNull();
  }, 300_000);

  it('durante la celebración todo lo demás queda inerte y al acabar vuelve el foco', () => {
    const reloj = new RelojFalso();
    const director = DirectorVivo.nueva(
      motor,
      { ...config('bots', ['normal', 'normal', 'normal'], 'celebracion'), reglas: 'normal' },
      reloj,
      { retardoBotMs: 50 },
    );
    const { container } = render(
      <ProveedorCatalogo motor={motor} cartas={CARTAS}>
        <Mesa
          director={director}
          onSalir={() => undefined}
          onRevancha={() => undefined}
          onTutorial={() => undefined}
        />
      </ProveedorCatalogo>,
    );
    // Un diálogo abierto (el menú) con el foco dentro.
    act(() => screen.getByRole('button', { name: 'Menú' }).click());
    const rendirse = screen.getByRole('button', { name: 'Rendirse' });
    act(() => rendirse.focus());
    expect(document.activeElement).toBe(rendirse);
    for (let i = 0; i < 50_000 && director.celebracion === null; i++) {
      act(() => reloj.avanzar(100));
    }
    expect(director.celebracion).not.toBeNull();
    expect(rendirse.closest('[inert]')).not.toBeNull();
    expect(container.querySelector('[data-celebracion]')?.closest('[inert]')).toBeNull();
    act(() => reloj.avanzar(4500));
    expect(rendirse.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(rendirse);
  }, 300_000);
});
