import { RelojManual } from '@hts/anfitrion';
import { crearServidor, type ServidorHts } from '@hts/server';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClienteEnLinea } from '../src/enlinea/cliente';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { Sala } from '../src/pantallas/Sala';
import { CATALOGO, motor } from './utilidades';

/** Semilla fija: la partida de prueba la empieza un humano (no el bot, que no actúa con el reloj manual). */
const SEMILLA = 'enlinea-1';
let servidor: ServidorHts;
let url = '';
const clientes: ClienteEnLinea[] = [];

function nuevoCliente(): ClienteEnLinea {
  const c = new ClienteEnLinea(url, null);
  clientes.push(c);
  return c;
}

beforeEach(async () => {
  servidor = crearServidor({
    motor,
    reloj: new RelojManual(),
    semilla: () => SEMILLA,
    opcionesAnfitrion: { retardoBotMs: 50 },
  });
  const puerto = await servidor.escuchar(0, '127.0.0.1');
  url = `http://127.0.0.1:${puerto}`;
});

afterEach(async () => {
  cleanup();
  for (const c of clientes.splice(0)) c.cerrar();
  await servidor.cerrar();
});

describe('Cliente en línea', () => {
  it('crea una sala, otro se une, el anfitrión añade un bot y empieza', async () => {
    const ana = nuevoCliente();
    const beto = nuevoCliente();
    expect(await ana.conectado()).toBe(true);
    expect(await beto.conectado()).toBe(true);
    expect(await ana.crear('Ana')).toBe(true);
    const codigo = ana.sesion?.codigo ?? '';
    expect(ana.soyCreador).toBe(true);
    expect(await beto.unirse(codigo.toLowerCase(), 'Beto')).toBe(true);
    expect(await beto.unirse('ZZZZZ', 'Otro')).toBe(false);
    expect(beto.error).toBe('SALA_NO_EXISTE');
    expect(await ana.anadirBot('facil')).toBe(true);
    expect(await ana.empezar()).toBe(false);
    expect(ana.error).toBe('NO_ESTAN_LISTOS');
    await beto.listo(true);
    expect(await ana.empezar()).toBe(true);
    await waitFor(() => expect(ana.partida).not.toBeNull());
    await waitFor(() => expect(beto.partida).not.toBeNull());

    // Interfaz común con la mesa.
    expect(ana.config.modo).toBe('enLinea');
    expect(ana.observador).toBe('j1');
    expect(beto.observador).toBe('j2');
    expect(ana.esBot('j3')).toBe(true);
    expect(['j1', 'j2']).toContain(ana.actorRequerido());
    const activo = ana.actorRequerido() === 'j1' ? ana : beto;
    const otro = activo === ana ? beto : ana;
    expect(otro.motivo({ tipo: 'ROBAR' })).toBe('NO_ES_TU_TURNO');
    expect(activo.motivo({ tipo: 'ROBAR' })).toBeNull();
    const pa = activo.vista().turno.pa;
    expect(await activo.actuar({ tipo: 'ROBAR' })).toBe(true);
    await waitFor(() => expect(otro.vista().turno.pa).toBe(pa - 1));
  });
});

describe('Pantalla de la sala', () => {
  it('muestra el código, permite añadir un bot y al empezar aparece la mesa', async () => {
    const ana = nuevoCliente();
    await ana.conectado();
    await ana.crear('Ana');
    await waitFor(() => expect(ana.sala).not.toBeNull());
    render(
      <ProveedorCatalogo motor={motor} cartas={CATALOGO}>
        <Sala cliente={ana} onSalir={() => undefined} onTutorial={() => undefined} />
      </ProveedorCatalogo>,
    );
    expect(screen.getAllByText(ana.sesion?.codigo ?? '?').length).toBeGreaterThan(0);
    const empezar = screen.getByRole('button', { name: 'Empezar partida' });
    expect(empezar).toBeDisabled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bot normal' }));
    });
    await waitFor(() => expect(screen.getByText('Bot Bigotes')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }));
    });
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Tu mano' })).toBeInTheDocument(),
    );
  });
});
