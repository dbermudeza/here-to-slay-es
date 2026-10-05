import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { NetworkInterfaceInfo } from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buscarCloudflared, ipRedLocal } from '../src/red';

const ipv4 = (address: string, mac: string, internal = false): NetworkInterfaceInfo => ({
  address,
  mac,
  internal,
  family: 'IPv4',
  netmask: '255.255.255.0',
  cidr: `${address}/24`,
});

describe('Dirección en la red local', () => {
  it('una sola dirección: se descarta el adaptador virtual de WSL/Hyper-V', () => {
    expect(
      ipRedLocal({
        'Ethernet 2': [ipv4('192.168.1.1', 'c8:a3:62:2d:05:a1')],
        'vEthernet (WSL (Hyper-V firewall))': [ipv4('172.28.64.1', '00:15:5d:60:bf:7d')],
        'Loopback Pseudo-Interface 1': [ipv4('127.0.0.1', '00:00:00:00:00:00', true)],
      }),
    ).toBe('192.168.1.1');
  });

  it('descarta adaptadores virtuales por su MAC aunque el nombre no lo diga', () => {
    expect(
      ipRedLocal({
        'Conexión de red 3': [ipv4('192.168.56.1', '08:00:27:aa:bb:cc')],
        'Wi-Fi': [ipv4('10.0.0.23', 'a4:5e:60:11:22:33')],
      }),
    ).toBe('10.0.0.23');
  });

  it('si hay varias reales, prefiere la doméstica (192.168.x)', () => {
    expect(
      ipRedLocal({
        Ethernet: [ipv4('10.1.2.3', 'aa:aa:aa:aa:aa:01')],
        'Wi-Fi': [ipv4('192.168.0.15', 'aa:aa:aa:aa:aa:02')],
      }),
    ).toBe('192.168.0.15');
  });

  it('sin red local, null', () => {
    expect(ipRedLocal({ lo: [ipv4('127.0.0.1', '00:00:00:00:00:00', true)] })).toBeNull();
  });
});

describe('Dónde está cloudflared', () => {
  it('la variable CLOUDFLARED manda', () => {
    expect(buscarCloudflared({ CLOUDFLARED: 'D:\\otro\\cloudflared.exe' })).toBe(
      'D:\\otro\\cloudflared.exe',
    );
  });

  it.runIf(process.platform === 'win32')(
    'en Windows lo encuentra en Program Files aunque no esté en el PATH',
    () => {
      const base = mkdtempSync(join(tmpdir(), 'hts-pf-'));
      try {
        mkdirSync(join(base, 'cloudflared'));
        const exe = join(base, 'cloudflared', 'cloudflared.exe');
        writeFileSync(exe, '');
        expect(buscarCloudflared({ 'ProgramFiles(x86)': base })).toBe(exe);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    },
  );

  it('si no está en ninguna carpeta conocida, prueba con el PATH', () => {
    expect(buscarCloudflared({})).toMatch(/cloudflared(\.exe)?$/);
  });
});
