/**
 * Presentación del Líder de extremo a extremo: Anfitrión real (DirectorVivo), motor y catálogo
 * reales, reloj manual y la mesa pintada. La Canción Carismática actúa en cada tirada de Héroe
 * (R-082, R-104): cada activación lleva la presentación completa (también la segunda del mismo turno).
 */
import { SISTEMA } from '@hts/engine';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  A,
  B,
  C,
  CARTAS,
  forzarDados,
  HAY_CATALOGO,
  heroe,
  mesa,
  motor,
} from '../../../packages/engine/test/cartas/reales';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { SEGUNDOS_POR_DEFECTO, type ConfigLocal } from '../src/juego/config';
import { DirectorVivo } from '../src/juego/director-vivo';
import { Mesa } from '../src/pantallas/mesa/Mesa';
import { RelojFalso } from './utilidades';

// Sin movimiento real: el test comprueba qué se pinta, no la animación.
vi.mock('framer-motion', async () => {
  const real = await vi.importActual<Record<string, unknown>>('framer-motion');
  const React = await import('react');
  const quitar = ['initial', 'animate', 'exit', 'transition', 'layout', 'layoutId'];
  const componente =
    (tag: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(
        tag,
        Object.fromEntries(Object.entries(p).filter(([k]) => !quitar.includes(k))),
        children,
      );
  return {
    ...real,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy({}, { get: (_t, tag: string) => componente(tag) }),
  };
});

afterEach(cleanup);

const PRESENTACION = 4000;
const config: ConfigLocal = {
  modo: 'bots', // observa ana; los tres juegan como humanos
  reglas: 'normal',
  semilla: 'presentacion-ui',
  segundos: SEGUNDOS_POR_DEFECTO,
  jugadores: [A, B, C].map((id) => ({ id, nombre: id.toUpperCase(), control: 'humano' })),
};

describe.skipIf(!HAY_CATALOGO)('Presentación del Líder en la mesa (motor real)', () => {
  it('R-082: cada tirada presenta al Líder, también la segunda del mismo turno', () => {
    const s = mesa({ [A]: 'lider_la_cancion_carismatica', [B]: 'lider_la_flecha_divina' });
    const h1 = heroe(s, A, 'heroe_peanut');
    const h2 = heroe(s, A, 'heroe_napping_nibbles');
    const reloj = new RelojFalso();
    const director = new DirectorVivo(
      motor,
      config,
      forzarDados(s, ...Array<number>(12).fill(1)),
      reloj,
      { retardoBotMs: 100, celebracionMs: 0, pausaResultadoMs: 0 },
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
    const presentacion = () => container.querySelector('[data-presentacion-lider]');
    const destellos = () => container.querySelectorAll('[data-destello-lider]').length;
    const tirar = (uid: string) =>
      act(() => {
        expect(director.enviar(A, { tipo: 'TIRAR_HEROE', uid })).toBeNull();
        const cima = director.estado.pila.at(-1);
        if (cima === undefined || !('secuencia' in cima)) throw new Error('Sin ventana');
        expect(
          director.enviar(SISTEMA, { tipo: 'CERRAR_VENTANA', secuencia: cima.secuencia }),
        ).toBeNull();
      });

    expect(presentacion()).toBeNull();
    expect(destellos()).toBe(0);

    // 1.ª activación: presentación, sin destello extra.
    tirar(h1);
    expect(director.presentacionLider).toMatchObject({ id: 1, jugador: A });
    expect(presentacion()).not.toBeNull();
    expect(presentacion()?.textContent).toContain('¡ANA activa la habilidad de su Líder!');
    expect(destellos()).toBe(0);
    act(() => reloj.avanzar(PRESENTACION));
    expect(director.presentacionLider).toBeNull();
    expect(presentacion()).toBeNull();
    expect(destellos()).toBe(0);

    // 2.ª activación en el mismo turno: también presentación, y sin destellos.
    tirar(h2);
    expect(director.eventos.filter((e) => e.tipo === 'liderActivado')).toHaveLength(2);
    expect(director.presentacionLider).toMatchObject({ id: 2, jugador: A });
    expect(presentacion()).not.toBeNull();
    expect(destellos()).toBe(0);
    act(() => reloj.avanzar(PRESENTACION));
    expect(presentacion()).toBeNull();

    // Turno siguiente de ana (tras B y C): vuelve la presentación.
    act(() => {
      for (const id of [A, B, C]) expect(director.enviar(id, { tipo: 'FIN_TURNO' })).toBeNull();
    });
    expect(director.estado.turno.jugador).toBe(A);
    tirar(h1);
    expect(director.presentacionLider).toMatchObject({ id: 3, jugador: A });
    expect(presentacion()).not.toBeNull();
    expect(destellos()).toBe(0);
    act(() => reloj.avanzar(PRESENTACION));
    expect(presentacion()).toBeNull();
  });
});
