import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { darCarta, ponerHeroe } from '../../../packages/engine/test/fixtures';
import { ProveedorCatalogo } from '../src/estado/contexto';
import type { ConfigLocal } from '../src/juego/config';
import { Configurar } from '../src/pantallas/Configurar';
import { Mesa } from '../src/pantallas/mesa/Mesa';
import { CATALOGO, config, directorEn, motor } from './utilidades';

afterEach(cleanup);

function conCatalogo(ui: React.ReactElement) {
  return render(
    <ProveedorCatalogo motor={motor} cartas={CATALOGO}>
      {ui}
    </ProveedorCatalogo>,
  );
}

describe('Pantalla de configuración', () => {
  it('contra bots: reglas difíciles, 3 bots y dificultad mixta', () => {
    const onEmpezar = vi.fn<(c: ConfigLocal) => void>();
    conCatalogo(
      <Configurar modoInicial="local" onEmpezar={onEmpezar} onVolver={() => undefined} />,
    );
    fireEvent.click(screen.getByLabelText(/Contra bots/));
    fireEvent.click(screen.getByLabelText(/Difíciles/));
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Número de bots'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText(/Mixta/));
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }));

    const c = onEmpezar.mock.calls[0]?.[0];
    expect(c).toMatchObject({ modo: 'bots', reglas: 'dificil', dificultad: 'mixta' });
    expect(c?.jugadores.map((j) => [j.nombre, j.control])).toEqual([
      ['Ana', 'humano'],
      ['Bot Bigotes', 'normal'],
      ['Bot Zarpas', 'facil'],
      ['Bot Cascabel', 'normal'],
    ]);
    expect(c?.semilla).not.toBe('');
  });

  it('en este dispositivo: valida nombres repetidos', () => {
    const onEmpezar = vi.fn();
    conCatalogo(
      <Configurar modoInicial="local" onEmpezar={onEmpezar} onVolver={() => undefined} />,
    );
    fireEvent.change(screen.getByLabelText('Jugador 2'), { target: { value: 'Jugador 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }));
    expect(screen.getByRole('alert').textContent).toMatch(/no se pueden repetir/);
    expect(onEmpezar).not.toHaveBeenCalled();
  });

  it('en este dispositivo: configura de 2 a 6 jugadores humanos', () => {
    const onEmpezar = vi.fn<(c: ConfigLocal) => void>();
    conCatalogo(
      <Configurar modoInicial="local" onEmpezar={onEmpezar} onVolver={() => undefined} />,
    );
    fireEvent.change(screen.getByLabelText('Número de jugadores'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }));
    const c = onEmpezar.mock.calls[0]?.[0];
    expect(c?.modo).toBe('local');
    expect(c?.reglas).toBe('normal');
    expect(c?.jugadores).toHaveLength(5);
    expect(c?.jugadores.every((j) => j.control === 'humano')).toBe(true);
  });
});

describe('Mesa', () => {
  const montar = (d: ReturnType<typeof directorEn>['director']) =>
    conCatalogo(
      <Mesa
        director={d}
        onSalir={() => undefined}
        onRevancha={() => undefined}
        onTutorial={() => undefined}
      />,
    );

  it('las acciones legales están activas y las ilegales explican por qué', () => {
    const { director } = directorEn(config('bots', ['humano', 'normal']));
    montar(director);
    const robar = screen.getByRole('button', { name: /^Robar/ });
    expect(robar).toBeEnabled();
    fireEvent.click(robar);
    expect(director.estado.turno.pa).toBe(2);
    // Con 2 PA ya no se puede renovar la mano (3 PA): botón desactivado con el motivo.
    const renovar = screen.getByRole('button', { name: /Descartar mano y robar 5/ });
    expect(renovar).toBeDisabled();
    expect(renovar.parentElement?.getAttribute('title')).toBe(
      'No te quedan suficientes puntos de acción.',
    );
  });

  it('jugar un Héroe de la mano abre la ventana de desafío y luego pregunta por la tirada inmediata', () => {
    let heroe = '';
    const { director, reloj } = directorEn(config('bots', ['humano', 'facil']), (s) => {
      heroe = darCarta(s, 'j1', 'heroe_mago');
    });
    montar(director);
    fireEvent.click(screen.getByRole('button', { name: 'Héroe mago' }));
    fireEvent.click(screen.getByRole('button', { name: /^Jugar/ }));
    expect(screen.getByText('¿Alguien quiere desafiarla?')).toBeInTheDocument();
    act(() => reloj.avanzar(100));
    expect(director.estado.pila[director.estado.pila.length - 1]).toMatchObject({
      tipo: 'tiradaInmediata',
      heroe,
    });
    const dialogo = screen.getByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ahora no' }));
    expect(director.estado.pila).toEqual([]);
  });

  it('un Objeto se equipa eligiendo el Héroe en la mesa', () => {
    let heroe = '';
    let anillo = '';
    const { director } = directorEn(config('bots', ['humano', 'facil']), (s) => {
      heroe = ponerHeroe(s, 'j1', 'bardo');
      anillo = darCarta(s, 'j1', 'objeto_anillo');
    });
    montar(director);
    fireEvent.click(screen.getByRole('button', { name: 'Anillo' }));
    fireEvent.click(screen.getByRole('button', { name: /Equipar a un Héroe/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Héroe bardo' }));
    const cima = director.estado.pila[director.estado.pila.length - 1];
    expect(cima).toMatchObject({
      tipo: 'ventanaDesafio',
      jugada: { tipo: 'objeto', uid: anillo, objetivo: heroe },
    });
  });

  it('en modo local, al terminar el turno se tapa la mesa hasta que el siguiente jugador confirma', () => {
    const { director } = directorEn(config('local', ['humano', 'humano']));
    montar(director);
    fireEvent.click(screen.getByRole('button', { name: /Terminar turno/ }));
    expect(screen.getByText('Pásale el dispositivo a J2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Soy J2' }));
    expect(screen.queryByText('Pásale el dispositivo a J2')).not.toBeInTheDocument();
    expect(screen.getByText('Tu turno')).toBeInTheDocument();
  });

  it('los textos vienen del i18n (sin claves sin traducir en la mesa)', () => {
    const { director } = directorEn(config('bots', ['humano', 'normal', 'facil']));
    const { container } = montar(director);
    expect(container.textContent).not.toMatch(/\b(mesa|ventana|decision|errores)\.[a-zA-Z]+/);
  });
});
