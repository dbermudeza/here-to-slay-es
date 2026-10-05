/** Utilidades del equipo del servidor: su dirección en la red local y dónde está cloudflared. */
import { existsSync, readdirSync } from 'node:fs';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import { join } from 'node:path';

/** Adaptadores virtuales (WSL/Hyper-V, VirtualBox, VMware, Docker, VPN…): nadie de tu Wi-Fi llega a ellos. */
const NOMBRE_VIRTUAL =
  /vethernet|wsl|hyper-v|virtualbox|vmware|vmnet|docker|vbox|loopback|tailscale|zerotier|hamachi|bluetooth|br-|veth/i;
const MAC_VIRTUAL = ['00:15:5d', '08:00:27', '00:50:56', '00:0c:29', '00:05:69', '02:42:'];

/** Preferencia por el tipo de red privada: primero la doméstica habitual. */
function prioridad(ip: string): number {
  if (ip.startsWith('192.168.')) return 0;
  if (ip.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  return 3;
}

/**
 * La dirección IPv4 del equipo en la red local (la de la Wi-Fi o el cable de casa), o null.
 * Se descartan los adaptadores virtuales y, si quedan varias, se elige una sola.
 */
export function ipRedLocal(
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined> = networkInterfaces(),
): string | null {
  const candidatas = Object.entries(interfaces).flatMap(([nombre, lista]) =>
    (lista ?? [])
      .filter((i) => i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
      .filter(
        (i) =>
          !NOMBRE_VIRTUAL.test(nombre) &&
          !MAC_VIRTUAL.some((prefijo) => i.mac.toLowerCase().startsWith(prefijo)),
      )
      .map((i) => i.address),
  );
  candidatas.sort((a, b) => prioridad(a) - prioridad(b));
  return candidatas[0] ?? null;
}

/**
 * Ejecutable de cloudflared. winget y el instalador oficial lo dejan en Program Files sin añadirlo
 * siempre al PATH, y una terminal abierta antes de instalarlo no ve el PATH nuevo: se busca también
 * en las carpetas de instalación habituales. Si no está en ninguna, se usa el nombre (PATH).
 */
export function buscarCloudflared(entorno: NodeJS.ProcessEnv = process.env): string {
  const configurado = entorno['CLOUDFLARED'];
  if (configurado !== undefined && configurado !== '') return configurado;

  const candidatos: string[] = [];
  if (process.platform === 'win32') {
    for (const base of [entorno['ProgramFiles(x86)'], entorno['ProgramFiles']]) {
      if (base !== undefined) candidatos.push(join(base, 'cloudflared', 'cloudflared.exe'));
    }
    const local = entorno['LOCALAPPDATA'];
    if (local !== undefined) {
      const winget = join(local, 'Microsoft', 'WinGet');
      candidatos.push(join(winget, 'Links', 'cloudflared.exe'));
      try {
        for (const carpeta of readdirSync(join(winget, 'Packages'))) {
          if (carpeta.startsWith('Cloudflare.cloudflared'))
            candidatos.push(join(winget, 'Packages', carpeta, 'cloudflared.exe'));
        }
      } catch {
        // Sin paquetes de winget.
      }
    }
  } else {
    candidatos.push(
      '/opt/homebrew/bin/cloudflared',
      '/usr/local/bin/cloudflared',
      '/usr/bin/cloudflared',
    );
  }
  return candidatos.find((ruta) => existsSync(ruta)) ?? 'cloudflared';
}
