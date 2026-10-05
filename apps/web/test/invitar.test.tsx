import type { EstadoTunel, InfoServidor } from '@hts/anfitrion';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClienteEnLinea } from '../src/enlinea/cliente';
import { enlaceInvitacion, Invitar } from '../src/pantallas/Invitar';

afterEach(cleanup);

function clienteFalso(info: InfoServidor, tunel: EstadoTunel) {
  const abrirTunel = vi.fn(() => Promise.resolve(true));
  const cerrarTunel = vi.fn(() => Promise.resolve(true));
  const cliente = { info, tunel, abrirTunel, cerrarTunel } as unknown as ClienteEnLinea;
  return { cliente, abrirTunel, cerrarTunel };
}

const APAGADO: EstadoTunel = { fase: 'apagado', url: null, error: null };
const SERVIDOR: InfoServidor = {
  esEquipoServidor: true,
  redLocal: ['http://192.168.1.34:3000'],
};

describe('Invitar a la sala', () => {
  it('el enlace lleva el código de la sala', () => {
    expect(enlaceInvitacion('https://abc.trycloudflare.com', 'TKDEV')).toBe(
      'https://abc.trycloudflare.com/?sala=TKDEV',
    );
    expect(enlaceInvitacion('http://192.168.1.34:3000/', 'TKDEV')).toBe(
      'http://192.168.1.34:3000/?sala=TKDEV',
    );
  });

  it('en el equipo del servidor: enlace de la red local y botón para abrir el túnel', () => {
    const { cliente, abrirTunel } = clienteFalso(SERVIDOR, APAGADO);
    render(<Invitar cliente={cliente} codigo="TKDEV" />);
    expect(screen.getByText('http://192.168.1.34:3000/?sala=TKDEV')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir acceso por internet' }));
    expect(abrirTunel).toHaveBeenCalled();
  });

  it('con el túnel activo muestra el enlace por internet y permite cerrarlo', () => {
    const { cliente, cerrarTunel } = clienteFalso(SERVIDOR, {
      fase: 'activo',
      url: 'https://sent-circuit.trycloudflare.com',
      error: null,
    });
    render(<Invitar cliente={cliente} codigo="TKDEV" />);
    expect(
      screen.getByText('https://sent-circuit.trycloudflare.com/?sala=TKDEV'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar acceso por internet' }));
    expect(cerrarTunel).toHaveBeenCalled();
  });

  it('si cloudflared no está instalado, explica cómo instalarlo', () => {
    const { cliente } = clienteFalso(SERVIDOR, {
      fase: 'error',
      url: null,
      error: 'NO_INSTALADO',
    });
    render(<Invitar cliente={cliente} codigo="TKDEV" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se encuentra cloudflared');
    expect(screen.getByText('winget install --id Cloudflare.cloudflared')).toBeInTheDocument();
  });

  it('un invitado ve el enlace por el que ha entrado, sin botones del túnel', () => {
    const { cliente } = clienteFalso({ esEquipoServidor: false, redLocal: [] }, APAGADO);
    render(<Invitar cliente={cliente} codigo="TKDEV" />);
    expect(screen.getByText(enlaceInvitacion(window.location.origin, 'TKDEV'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acceso por internet/ })).not.toBeInTheDocument();
  });
});
