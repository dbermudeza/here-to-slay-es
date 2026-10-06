import type { Evento } from '@hts/engine';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../src/estado/app';
import { ProveedorCatalogo } from '../src/estado/contexto';
import type { PresentacionLider as Presentacion } from '../src/juego/fuente';
import { MesaContexto, type ValorMesa } from '../src/pantallas/mesa/contexto';
import { PresentacionLider } from '../src/pantallas/mesa/PresentacionLider';
import { ZonaJugador } from '../src/pantallas/mesa/ZonaJugador';
import { CATALOGO, config, directorEn, motor } from './utilidades';

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

function montar(restanteMs = 2500, duracionMs = 2500) {
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

describe('Destello del Líder sin presentación', () => {
  /** Zona de j1 con un director cuyos eventos y presentación se controlan desde el test. */
  function zona(previos: string[] = []) {
    const { director: real } = directorEn(config('local', ['humano', 'humano']));
    const eventos: Evento[] = previos.map(() => ({
      tipo: 'liderActivado',
      jugador: 'j1',
      carta: 'lider_x',
    }));
    const estado: { presentacion: Presentacion | null } = { presentacion: null };
    const director = Object.create(real, {
      eventos: { get: () => eventos },
      presentacionLider: { get: () => estado.presentacion },
    });
    const vista = real.vista();
    const valor = {
      director,
      vista,
      yo: 'j1',
      legales: [],
      esMiTurnoLibre: false,
      equipando: null,
      objetivosEquipar: new Set<string>(),
      setEquipando: () => undefined,
      enviar: () => undefined,
      motivo: () => null,
      ampliar: () => undefined,
      detalleDe: () => undefined,
      idDe: (uid: string) => vista.cartas[uid] ?? null,
      nombreCarta: (id: string) => id,
      nombreJugador: (id: string) => id,
    } as unknown as ValorMesa;
    const jugador = vista.jugadores.find((j) => j.id === 'j1');
    if (jugador === undefined) throw new Error('Falta j1');
    const arbol = () => (
      <ProveedorCatalogo motor={motor} cartas={CATALOGO}>
        <MesaContexto.Provider value={valor}>
          <ZonaJugador jugador={jugador} propia />
        </MesaContexto.Provider>
      </ProveedorCatalogo>
    );
    const ui = render(arbol());
    const activar = (carta = 'lider_x') => {
      eventos.push({ tipo: 'liderActivado', jugador: 'j1', carta });
      ui.rerender(arbol());
    };
    const turno = (numero: number) => {
      eventos.push({ tipo: 'turnoIniciado', jugador: 'j1', numero });
      ui.rerender(arbol());
    };
    return { ui, estado, activar, turno };
  }

  it('la primera activación del turno no destella (la cubre la presentación); la siguiente sí', () => {
    const { ui, activar } = zona();
    activar();
    expect(ui.container.querySelector('[data-destello-lider]')).toBeNull();
    activar();
    const destello = ui.container.querySelector('[data-destello-lider]');
    expect(destello).not.toBeNull();
    expect(destello?.parentElement?.className).toContain('pointer-events-none');
    expect(destello?.parentElement?.getAttribute('aria-hidden')).toBe('true');
  });

  it('un turno nuevo vuelve a dar la primera activación sin destello', () => {
    const { ui, activar, turno } = zona();
    activar();
    turno(2);
    activar();
    expect(ui.container.querySelector('[data-destello-lider]')).toBeNull();
    activar();
    expect(ui.container.querySelector('[data-destello-lider]')).not.toBeNull();
  });

  it('lo ocurrido antes de montar no destella', () => {
    const { ui, activar } = zona(['previo', 'previo']);
    expect(ui.container.querySelector('[data-destello-lider]')).toBeNull();
    activar('lider_otro');
    expect(ui.container.querySelector('[data-destello-lider]')).toBeNull();
  });

  it('sin eventos de Líder no se renderiza ningún destello', () => {
    const { ui } = zona();
    expect(ui.container.querySelector('[data-destello-lider]')).toBeNull();
    expect(document.querySelector('[data-presentacion-lider]')).toBeNull();
  });
});
