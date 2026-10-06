import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { darCarta } from '../../../packages/engine/test/fixtures';
import { useApp } from '../src/estado/app';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { ventanaDeTirada, type InstantaneaVentana } from '../src/pantallas/mesa/Escenario';
import { Mesa } from '../src/pantallas/mesa/Mesa';
import { CATALOGO, config, directorEn, motor } from './utilidades';

// Sin animaciones reales: los elementos animados exponen sus propiedades iniciales (data-initial).
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const cache = new Map<string, unknown>();
  const componente = (tag: string) => {
    let c = cache.get(tag);
    if (c === undefined) {
      c = ({
        children,
        initial,
        ...p
      }: Record<string, unknown> & { children?: React.ReactNode }) => {
        const resto = Object.fromEntries(
          Object.entries(p).filter(([k]) => !['animate', 'exit', 'transition'].includes(k)),
        );
        return React.createElement(
          tag,
          { ...resto, 'data-initial': JSON.stringify(initial ?? null) },
          children,
        );
      };
      cache.set(tag, c);
    }
    return c;
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy({}, { get: (_t, tag: string) => componente(tag) }),
  };
});

afterEach(() => {
  cleanup();
  useApp.setState({ reducirAnimaciones: null });
});

const montar = (d: ReturnType<typeof directorEn>['director']) =>
  render(
    <ProveedorCatalogo motor={motor} cartas={CATALOGO}>
      <Mesa
        director={d}
        onSalir={() => undefined}
        onRevancha={() => undefined}
        onTutorial={() => undefined}
      />
    </ProveedorCatalogo>,
  );

const tres = () => config('local', ['humano', 'humano', 'humano']);

/** J1 intenta jugar un Héroe; J2 (con una carta de Desafío) tiene el dispositivo. */
function intentoDesdeJ2() {
  let heroe = '';
  const ctx = directorEn(tres(), (s) => {
    heroe = darCarta(s, 'j1', 'heroe_mago');
    darCarta(s, 'j2', 'desafio');
  });
  ctx.director.enviar('j1', { tipo: 'JUGAR_CARTA', uid: heroe });
  ctx.director.responder('j2');
  ctx.director.confirmarTraspaso();
  return ctx;
}

describe('Escenario central: intento de jugar una carta', () => {
  it('quien puede responder ve la jugada en el centro con Desafiar y Dejar pasar', () => {
    const { director } = intentoDesdeJ2();
    const { container } = montar(director);
    expect(screen.getByRole('heading', { name: 'J1 intenta jugar Héroe mago' })).toBeVisible();
    expect(screen.getByText('¿Alguien quiere desafiarla?')).toBeInTheDocument();
    const desafiar = screen.getByRole('button', { name: 'Desafiar' });
    const pasar = screen.getByRole('button', { name: 'Dejar pasar' });
    expect(desafiar.getAttribute('data-accion')).toContain('"tipo":"DESAFIAR"');
    expect(pasar.getAttribute('data-accion')).toBe('{"tipo":"PASAR"}');
    expect(screen.queryByText('Esperando desafíos…')).not.toBeInTheDocument();
    // En este dispositivo la cuenta atrás está en pausa mientras alguien responde.
    expect(screen.getByText('En pausa')).toBeInTheDocument();
    expect(container.querySelector('.bg-stone-950\\/35')).not.toBeNull();
  });

  it('el recuadro de la esquina ya no existe: todo va al escenario central', () => {
    const { director } = intentoDesdeJ2();
    const { container } = montar(director);
    expect(container.querySelector('.lg\\:right-2')).toBeNull();
    const escenario = container.querySelector('[data-escenario="intento"]');
    expect(escenario).not.toBeNull();
    expect(escenario?.className).toContain('inset-0');
  });

  it('dejar pasar envía PASAR', () => {
    const { director } = intentoDesdeJ2();
    montar(director);
    fireEvent.click(screen.getByRole('button', { name: 'Dejar pasar' }));
    const cima = director.estado.pila[director.estado.pila.length - 1];
    expect(cima).toMatchObject({ tipo: 'ventanaDesafio', pasaron: ['j2'] });
    expect(screen.getByText(/Has pasado\./)).toBeInTheDocument();
  });

  it('los demás ven «Esperando desafíos…» y ningún botón', () => {
    let heroe = '';
    const { director } = directorEn(tres(), (s) => {
      heroe = darCarta(s, 'j1', 'heroe_mago');
    });
    director.enviar('j1', { tipo: 'JUGAR_CARTA', uid: heroe });
    montar(director);
    expect(screen.getByText('Esperando desafíos…')).toBeInTheDocument();
    // La cuenta atrás es circular.
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desafiar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dejar pasar' })).not.toBeInTheDocument();
  });

  it('con «Reducir animaciones» la carta no vuela (solo se funde)', () => {
    const inicial = (): unknown => {
      const { director } = intentoDesdeJ2();
      const { container, unmount } = montar(director);
      const carta = container.querySelector('[data-escenario="intento"] [aria-label="Héroe mago"]');
      const valor = JSON.parse(carta?.parentElement?.getAttribute('data-initial') ?? 'null');
      unmount();
      return valor;
    };
    useApp.setState({ reducirAnimaciones: false });
    expect(inicial()).toMatchObject({ scale: 0.25, opacity: 0 });
    useApp.setState({ reducirAnimaciones: true });
    // Sin vuelo ni fundido: la carta aparece ya en su sitio.
    expect(inicial()).toBe(false);
  });
});

describe('Escenario central: duelo y Modificadores', () => {
  function duelo() {
    let heroe = '';
    let desafio = '';
    const ctx = directorEn(tres(), (s) => {
      heroe = darCarta(s, 'j1', 'heroe_mago');
      darCarta(s, 'j1', 'modificador_mas4');
      desafio = darCarta(s, 'j2', 'desafio');
      s.dadosForzados.push(1, 2, 6, 5);
    });
    ctx.director.enviar('j1', { tipo: 'JUGAR_CARTA', uid: heroe });
    ctx.director.enviar('j2', { tipo: 'DESAFIAR', uid: desafio });
    return ctx;
  }

  const suma = (t?: { dados: [number, number] }): number => (t?.dados[0] ?? 0) + (t?.dados[1] ?? 0);

  it('muestra a los dos jugadores, sus totales y se actualiza al jugar un Modificador', () => {
    const { director } = duelo();
    const cima = director.estado.pila[director.estado.pila.length - 1];
    if (cima?.tipo !== 'ventanaModificadores') throw new Error('Debía abrirse el duelo');
    const [desafiado, desafiante] = cima.tiradas;
    const { container } = montar(director);
    expect(screen.getByRole('heading', { name: '¡J2 desafía!' })).toBeInTheDocument();
    const fichas = (): string[] =>
      Array.from(container.querySelectorAll('[data-escenario="duelo"] [data-ficha]')).map(
        (f) => f.textContent ?? '',
      );
    expect(fichas()).toHaveLength(2);
    // Primero quien desafía (J2), luego el desafiado (J1).
    expect(fichas()[0]).toContain('J2');
    expect(fichas()[0]).toContain(`Total${suma(desafiante)}`);
    expect(fichas()[1]).toContain('J1');
    expect(fichas()[1]).toContain(`Total${suma(desafiado)}`);

    // J1 juega +4 sobre su propia tirada: su total sube y aparece el «+4».
    fireEvent.click(screen.getByRole('button', { name: /\+4 a J1/ }));
    expect(fichas()[1]).toContain(`Total${suma(desafiado) + 4}`);
    expect(
      within(container.querySelector('[data-escenario="duelo"]') as HTMLElement).getByLabelText(
        '+4 de J1',
      ),
    ).toBeInTheDocument();
  });

  it('los botones de Modificador llevan data-accion para el piloto e2e', () => {
    const { director } = duelo();
    montar(director);
    const boton = screen.getByRole('button', { name: /\+4 a J1/ });
    expect(boton.getAttribute('data-accion')).toContain('"tipo":"JUGAR_MODIFICADOR"');
  });
});

describe('Escenario central: resolución', () => {
  it('al cerrarse la ventana sin desafíos, el escenario desaparece o enseña la jugada', () => {
    let magia = '';
    const { director, reloj } = directorEn(tres(), (s) => {
      magia = darCarta(s, 'j1', 'magia_prueba');
    });
    const { container } = montar(director);
    act(() => {
      director.enviar('j1', { tipo: 'JUGAR_CARTA', uid: magia });
    });
    expect(container.querySelector('[data-escenario="intento"]')).not.toBeNull();
    act(() => reloj.avanzar(10_000));
    expect(container.querySelector('[data-escenario="intento"]')).toBeNull();
    if (director.estado.pila.length === 0) {
      expect(screen.getByRole('heading', { name: 'Jugada' })).toBeInTheDocument();
    }
  });
});

describe('Escenario central: duelo, qué carta se pinta', () => {
  it('cruza la carta de Desafío (la del descarte) sobre la carta jugada', () => {
    let heroe = '';
    let desafio = '';
    const { director } = directorEn(tres(), (s) => {
      heroe = darCarta(s, 'j1', 'heroe_mago');
      desafio = darCarta(s, 'j2', 'desafio');
    });
    director.enviar('j1', { tipo: 'JUGAR_CARTA', uid: heroe });
    director.enviar('j2', { tipo: 'DESAFIAR', uid: desafio });
    const { container } = montar(director);
    const cruzadas = container.querySelector('[data-escenario="duelo"] div.relative.hidden');
    expect(cruzadas?.querySelectorAll('[aria-label="Desafío"]')).toHaveLength(1);
    expect(cruzadas?.querySelectorAll('[aria-label="Héroe mago"]')).toHaveLength(1);
  });
});

describe('Escenario central: ventana guardada', () => {
  const ventana = (jugador: string, heroe: string): InstantaneaVentana => ({
    ventana: {
      tipo: 'ventanaModificadores',
      secuencia: 1,
      duracionMs: 1000,
      tiradas: [{ jugador, dados: [1, 2], modificaciones: [] }],
      contexto: { tipo: 'heroe', heroe: 'u1' },
    },
    carta: heroe,
  });

  it('solo se usa si coincide el jugador y la carta del evento', () => {
    const v = ventana('j1', 'heroe_mago');
    expect(
      ventanaDeTirada(v, { jugador: 'j1', carta: 'heroe_mago', tipo: 'heroe' }),
    ).not.toBeNull();
    expect(ventanaDeTirada(v, { jugador: 'j2', carta: 'heroe_mago', tipo: 'heroe' })).toBeNull();
    expect(ventanaDeTirada(v, { jugador: 'j1', carta: 'heroe_bardo', tipo: 'heroe' })).toBeNull();
    expect(ventanaDeTirada(v, { jugador: 'j1', carta: 'heroe_mago', tipo: 'ataque' })).toBeNull();
    expect(ventanaDeTirada(null, { jugador: 'j1', carta: 'heroe_mago', tipo: 'heroe' })).toBeNull();
  });
});

describe('Escenario central: resultados caducados', () => {
  it('un traspaso vacía la cola: al terminar no salen resultados viejos', () => {
    let magia = '';
    const { director, reloj } = directorEn(tres(), (s) => {
      magia = darCarta(s, 'j1', 'magia_prueba');
    });
    const { container } = montar(director);
    act(() => {
      director.enviar('j1', { tipo: 'JUGAR_CARTA', uid: magia });
    });
    act(() => reloj.avanzar(10_000));
    expect(screen.getByRole('heading', { name: 'Jugada' })).toBeInTheDocument();
    act(() => {
      director.enviar('j1', { tipo: 'FIN_TURNO' });
    });
    expect(director.traspaso).toBe('j2');
    act(() => director.confirmarTraspaso());
    expect(screen.queryByRole('heading', { name: 'Jugada' })).not.toBeInTheDocument();
    expect(container.querySelector('[data-escenario="final"]')).toBeNull();
  });
});
