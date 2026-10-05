/**
 * Túnel rápido de Cloudflare (`cloudflared tunnel --url http://localhost:<puerto>`), lanzado por el
 * propio servidor para jugar por internet sin abrir puertos. La dirección pública
 * (https://….trycloudflare.com) se lee de la salida de cloudflared.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import type { EstadoTunel } from '@hts/anfitrion';

const URL_TUNEL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

export interface OpcionesTunel {
  /** Ejecutable (por defecto, `cloudflared` o la variable CLOUDFLARED). */
  comando?: string;
  /** Argumentos (por defecto, los del túnel rápido hacia `puerto`). */
  argumentos?: (puerto: number) => string[];
  /** Tiempo máximo para obtener la dirección. */
  esperaMs?: number;
}

export class Tunel {
  private proceso: ChildProcess | null = null;
  private espera: NodeJS.Timeout | null = null;
  estado: EstadoTunel = { fase: 'apagado', url: null, error: null };

  constructor(
    private readonly alCambiar: (estado: EstadoTunel) => void,
    private readonly opciones: OpcionesTunel = {},
  ) {}

  private cambiar(estado: EstadoTunel): void {
    this.estado = estado;
    this.alCambiar(estado);
  }

  abrir(puerto: number): void {
    if (this.estado.fase === 'conectando' || this.estado.fase === 'activo') return;
    const comando = this.opciones.comando ?? process.env['CLOUDFLARED'] ?? 'cloudflared';
    const argumentos = this.opciones.argumentos?.(puerto) ?? [
      'tunnel',
      '--no-autoupdate',
      '--url',
      `http://127.0.0.1:${puerto}`,
    ];
    this.cambiar({ fase: 'conectando', url: null, error: null });

    let proceso: ChildProcess;
    try {
      proceso = spawn(comando, argumentos, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      this.cambiar({ fase: 'error', url: null, error: 'NO_INSTALADO' });
      return;
    }
    this.proceso = proceso;

    const leer = (trozo: Buffer): void => {
      const url = URL_TUNEL.exec(trozo.toString())?.[0];
      if (url === undefined || this.estado.fase !== 'conectando' || this.proceso !== proceso)
        return;
      this.limpiarEspera();
      this.cambiar({ fase: 'activo', url, error: null });
    };
    proceso.stdout?.on('data', leer);
    proceso.stderr?.on('data', leer);

    proceso.on('error', (e: NodeJS.ErrnoException) => {
      if (this.proceso !== proceso) return;
      this.terminar();
      this.cambiar({
        fase: 'error',
        url: null,
        error: e.code === 'ENOENT' ? 'NO_INSTALADO' : 'FALLO',
      });
    });
    proceso.on('exit', () => {
      if (this.proceso !== proceso) return;
      this.terminar();
      // Si se cae (o no llegó a dar la dirección), se avisa; si se cerró a propósito, ya está apagado.
      this.cambiar({ fase: 'error', url: null, error: 'FALLO' });
    });

    this.espera = setTimeout(() => {
      if (this.proceso !== proceso || this.estado.fase !== 'conectando') return;
      this.terminar();
      this.cambiar({ fase: 'error', url: null, error: 'TIEMPO' });
    }, this.opciones.esperaMs ?? 45_000);
    this.espera.unref();
  }

  cerrar(): void {
    this.terminar();
    if (this.estado.fase !== 'apagado') this.cambiar({ fase: 'apagado', url: null, error: null });
  }

  private limpiarEspera(): void {
    if (this.espera !== null) clearTimeout(this.espera);
    this.espera = null;
  }

  private terminar(): void {
    this.limpiarEspera();
    const p = this.proceso;
    this.proceso = null;
    if (p !== null && p.exitCode === null) p.kill();
  }
}
