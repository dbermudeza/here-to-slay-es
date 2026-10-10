/**
 * Túnel rápido de Cloudflare (`cloudflared tunnel --url http://localhost:<puerto>`), lanzado por el
 * propio servidor para jugar por internet sin abrir puertos. La dirección pública
 * (https://….trycloudflare.com) se lee de la salida de cloudflared.
 *
 * cloudflared escribe la dirección en cuanto la crea, pero tarda unos segundos más en conectar con
 * Cloudflare: quien entrara en ese hueco vería el «Error 1033». Por eso el túnel solo pasa a
 * «activo» cuando cloudflared confirma la conexión y la dirección pública responde de verdad.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import type { EstadoTunel } from '@hts/anfitrion';
import { buscarCloudflared } from './red';

const URL_TUNEL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
/** Línea con la que cloudflared confirma que la conexión con Cloudflare está lista. */
const CONECTADO = /Registered tunnel connection/i;
/** Diagnóstico de cloudflared cuando la red no le deja salir por su puerto (7844). */
const BLOQUEADA = /port 7844/i;
/** Pausa entre comprobaciones de la dirección pública. */
const REINTENTO_MS = 1500;

/** ¿Responde nuestro servidor a través de la dirección pública? */
async function responde(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/api/estado`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return false;
    const cuerpo: unknown = await r.json();
    return typeof cuerpo === 'object' && cuerpo !== null && 'salas' in cuerpo;
  } catch {
    return false;
  }
}

export interface OpcionesTunel {
  /** Ejecutable (por defecto, el que encuentre `buscarCloudflared`). */
  comando?: string;
  /** Argumentos (por defecto, los del túnel rápido hacia `puerto`). */
  argumentos?: (puerto: number) => string[];
  /** Tiempo máximo hasta que el túnel funcione. */
  esperaMs?: number;
  /** Comprueba que la dirección pública responde (por defecto, pide /api/estado por internet). */
  comprobar?: (url: string) => Promise<boolean>;
  /** Pausa entre comprobaciones (por defecto, 1,5 s). */
  reintentoMs?: number;
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
    const comando = this.opciones.comando ?? buscarCloudflared();
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

    let url: string | null = null;
    let conectado = false;
    let comprobando = false;
    let bloqueada = false;
    const vigente = (): boolean => this.proceso === proceso && this.estado.fase === 'conectando';
    const comprobar = this.opciones.comprobar ?? responde;
    const verificar = async (direccion: string): Promise<void> => {
      comprobando = true;
      while (vigente()) {
        if (await comprobar(direccion)) {
          if (!vigente()) return;
          this.limpiarEspera();
          this.cambiar({ fase: 'activo', url: direccion, error: null });
          return;
        }
        await new Promise((fin) => setTimeout(fin, this.opciones.reintentoMs ?? REINTENTO_MS));
      }
    };
    const leer = (trozo: Buffer): void => {
      const texto = trozo.toString();
      url ??= URL_TUNEL.exec(texto)?.[0] ?? null;
      if (CONECTADO.test(texto)) conectado = true;
      if (BLOQUEADA.test(texto)) bloqueada = true;
      if (url !== null && conectado && !comprobando && vigente()) void verificar(url);
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
    // 'close' (no 'exit'): llega cuando ya se ha leído toda la salida, incluido el diagnóstico final.
    proceso.on('close', () => {
      if (this.proceso !== proceso) return;
      this.terminar();
      // Si se cae (o no llegó a dar la dirección), se avisa; si se cerró a propósito, ya está apagado.
      this.cambiar({ fase: 'error', url: null, error: bloqueada ? 'RED_BLOQUEADA' : 'FALLO' });
    });

    this.espera = setTimeout(() => {
      if (this.proceso !== proceso || this.estado.fase !== 'conectando') return;
      this.terminar();
      this.cambiar({ fase: 'error', url: null, error: bloqueada ? 'RED_BLOQUEADA' : 'TIEMPO' });
    }, this.opciones.esperaMs ?? 60_000);
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
