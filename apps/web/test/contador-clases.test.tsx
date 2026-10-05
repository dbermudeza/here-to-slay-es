import type { Clase } from '@hts/cards';
import type { DesgloseClases } from '@hts/engine';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ContadorClases, estadoClases } from '../src/pantallas/mesa/ContadorClases';

afterEach(cleanup);

const nombres: Record<string, string> = {
  lider_x: 'Lider Guardián',
  heroe_a: 'Héroe A',
  objeto_mascara_cazador: 'Máscara de Cazador',
  heroe_b: 'Héroe B',
};

function desglose(): DesgloseClases {
  const vacio: Record<Clase, DesgloseClases['porClase'][Clase]> = {
    luchador: [],
    bardo: [{ carta: 'heroe_a', uid: 'u1', origen: 'heroe' }],
    guardian: [{ carta: 'lider_x', uid: 'u0', origen: 'lider' }],
    cazador: [{ carta: 'heroe_b', uid: 'u2', origen: 'mascara', objeto: 'objeto_mascara_cazador' }],
    ladron: [],
    mago: [],
  };
  return { porClase: vacio, total: 3 };
}

const poner = (modo: 'normal' | 'dificil' = 'normal') =>
  render(
    <ContadorClases
      jugadorId="j1"
      nombreJugador="Ana"
      desglose={desglose()}
      monstruos={0}
      modo={modo}
      nombreCarta={(id) => nombres[id] ?? id}
    />,
  );

describe('ContadorClases', () => {
  it('muestra el total de clases', () => {
    poner();
    expect(screen.getByRole('button', { name: 'Clases: 3/6' })).toBeTruthy();
  });

  it('el desglose lista el Líder y la máscara, y marca "falta"', async () => {
    poner();
    const boton = screen.getByRole('button', { name: 'Clases: 3/6' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    const panel = document.getElementById(boton.getAttribute('aria-controls') ?? '');
    expect(panel?.hidden).toBe(true);
    await userEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    const guardian = document.querySelector('[data-clase="guardian"]')?.textContent ?? '';
    expect(guardian).toContain('Lider Guardián (Líder)');
    const cazador = document.querySelector('[data-clase="cazador"]')?.textContent ?? '';
    expect(cazador).toContain('Héroe B (máscara: Máscara de Cazador)');
    expect(document.querySelector('[data-clase="bardo"]')?.textContent).toContain('Héroe A');
    expect(document.querySelector('[data-clase="mago"]')?.textContent).toContain('falta');
    expect(document.querySelectorAll('[data-clase]').length).toBe(6);
  });

  it('se abre y se cierra con el teclado', async () => {
    poner();
    const boton = screen.getByRole('button', { name: 'Clases: 3/6' });
    await userEvent.tab();
    expect(document.activeElement).toBe(boton);
    await userEvent.keyboard('{Enter}');
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-controls')).toBe(
      document.querySelector('[data-clase]')?.closest('[id]')?.id,
    );
    await userEvent.keyboard(' ');
    expect(boton.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('pista textual del estado', () => {
  it('5 clases dice "cerca" y 6 dice que gana, sin depender del color', () => {
    const d = desglose();
    const con = (total: number, monstruos: number, modo: 'normal' | 'dificil') =>
      render(
        <ContadorClases
          jugadorId="j1"
          nombreJugador="Ana"
          desglose={{ ...d, total }}
          monstruos={monstruos}
          modo={modo}
          nombreCarta={(id) => id}
        />,
      );
    con(5, 0, 'normal');
    expect(screen.getByRole('button').textContent).toContain('cerca');
    cleanup();
    con(6, 0, 'dificil');
    expect(screen.getByRole('button').textContent).toContain('cerca');
    cleanup();
    con(6, 1, 'dificil');
    expect(screen.getByRole('button').textContent).toContain('gana al terminar el turno');
  });
});

describe('estadoClases (color honesto)', () => {
  it('reglas normales: 5 cerca, 6 listo', () => {
    expect(estadoClases(4, 0, 'normal')).toBe('normal');
    expect(estadoClases(5, 0, 'normal')).toBe('cerca');
    expect(estadoClases(6, 0, 'normal')).toBe('listo');
  });
  it('reglas difíciles: 6 sin Monstruos no es victoria', () => {
    expect(estadoClases(6, 0, 'dificil')).toBe('cerca');
    expect(estadoClases(6, 1, 'dificil')).toBe('listo');
    expect(estadoClases(3, 4, 'dificil')).toBe('listo');
    expect(estadoClases(3, 3, 'dificil')).toBe('normal');
  });
});
