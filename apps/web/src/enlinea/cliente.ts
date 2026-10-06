/**
 * Cliente de una partida en línea. Habla con el servidor por Socket.IO y ofrece a la mesa la misma
 * interfaz que el director local (FuenteMesa), con lo que recibe ya filtrado para el jugador.
 */
import {
  MENSAJES,
  type Ack,
  type Celebracion,
  type EstadoConexion,
  type EstadoPartida,
  type EstadoSala,
  type EstadoTunel,
  type InfoServidor,
  type OpcionesSala,
  type Plazo,
  type PlazoDecision,
  type Sesion,
} from '@hts/anfitrion';
import type { Accion, CodigoError, Evento, JugadorId, VistaJugador } from '@hts/engine';
import { io, type Socket } from 'socket.io-client';
import type { FuenteMesa, PausaResultado, PresentacionLider } from '../juego/fuente';
import { guardarSesion, leerSesion } from './sesion';

export { leerSesion } from './sesion';

export type EstadoRed = 'conectando' | 'conectado' | 'desconectado';

export class ClienteEnLinea implements FuenteMesa {
  version = 0;
  red: EstadoRed = 'conectando';
  sesion: Sesion | null;
  sala: EstadoSala | null = null;
  partida: EstadoPartida | null = null;
  eventos: Evento[] = [];
  /** Último error recibido del servidor (código). */
  error: string | null = null;
  /** Lo que el servidor cuenta de esta conexión (¿es su propio equipo?, red local). */
  info: InfoServidor | null = null;
  /** Túnel de Cloudflare para jugar por internet. */
  tunel: EstadoTunel = { fase: 'apagado', url: null, error: null };

  readonly traspaso = null;
  readonly respondiendo = null;

  private readonly socket: Socket;
  private readonly escuchas = new Set<() => void>();
  /** Instante (Date.now) en que llegó el último estado de partida (para las cuentas regresivas). */
  private recibido = 0;
  private celebracionActual: {
    id: number;
    jugador: JugadorId;
    carta: string;
    duracionMs: number;
    fin: number;
  } | null = null;
  /** Avisa a la mesa cuando vence la celebración (el servidor no manda un estado solo por eso). */
  private temporizadorCelebracion: ReturnType<typeof setTimeout> | null = null;
  private pausaActual: { id: number; duracionMs: number; fin: number } | null = null;
  /** Avisa a la mesa cuando vence la pausa tras un resultado. */
  private temporizadorPausa: ReturnType<typeof setTimeout> | null = null;
  private presentacionActual: {
    id: number;
    jugador: JugadorId;
    carta: string;
    duracionMs: number;
    fin: number;
  } | null = null;
  /** Avisa a la mesa cuando vence la presentación de la habilidad de un Líder. */
  private temporizadorPresentacion: ReturnType<typeof setTimeout> | null = null;

  constructor(url?: string, sesion: Sesion | null = leerSesion()) {
    this.sesion = sesion;
    const opciones = { transports: ['websocket', 'polling'], reconnection: true };
    this.socket = url === undefined ? io(opciones) : io(url, opciones);
    this.socket.on('connect', () => {
      this.red = 'conectado';
      this.notificar();
      if (this.sesion !== null) void this.reanudar();
    });
    this.socket.on('disconnect', () => {
      this.red = 'desconectado';
      this.notificar();
    });
    this.socket.on(MENSAJES.infoServidor, (i: InfoServidor) => {
      this.info = i;
      this.notificar();
    });
    this.socket.on(MENSAJES.estadoTunel, (e: EstadoTunel) => {
      this.tunel = e;
      this.notificar();
    });
    this.socket.on(MENSAJES.estadoSala, (s: EstadoSala | null) => {
      this.sala = s;
      if (s === null) {
        // Nos han quitado de la sala.
        this.olvidarSesion();
      } else if (s.fase === 'lobby') {
        this.partida = null;
        this.eventos = [];
      }
      this.notificar();
    });
    this.socket.on(MENSAJES.estadoPartida, (p: EstadoPartida) => {
      this.partida = p;
      this.recibido = Date.now();
      const c = p.celebracion;
      this.celebracionActual =
        c === null
          ? null
          : {
              id: c.id,
              jugador: c.jugador,
              carta: c.carta,
              duracionMs: c.duracionMs,
              fin: this.recibido + c.restanteMs,
            };
      this.programarFinCelebracion();
      const pr = p.pausaResultado ?? null; // un servidor antiguo no lo manda
      this.pausaActual =
        pr === null
          ? null
          : { id: pr.id, duracionMs: pr.duracionMs, fin: this.recibido + pr.restanteMs };
      this.programarFinPausa();
      const pl = p.presentacionLider ?? null; // un servidor antiguo no lo manda
      this.presentacionActual =
        pl === null
          ? null
          : {
              id: pl.id,
              jugador: pl.jugador,
              carta: pl.carta,
              duracionMs: pl.duracionMs,
              fin: this.recibido + pl.restanteMs,
            };
      this.programarFinPresentacion();
      if (p.reinicio) this.eventos = [...p.eventos];
      else this.eventos.push(...p.eventos);
      this.notificar();
    });
  }

  // ------------------------------------------------------------------ sala

  suscribir(fn: () => void): () => void {
    this.escuchas.add(fn);
    return () => {
      this.escuchas.delete(fn);
    };
  }

  private notificar(): void {
    this.version += 1;
    for (const fn of this.escuchas) fn();
  }

  private pedir<T>(mensaje: string, datos: unknown = {}): Promise<Ack<T>> {
    if (!this.socket.connected) return Promise.resolve({ ok: false, error: 'SIN_CONEXION' });
    return new Promise((resolver) => {
      this.socket.timeout(10_000).emit(mensaje, datos, (err: Error | null, r: Ack<T>) => {
        resolver(err === null ? r : { ok: false, error: 'SIN_CONEXION' });
      });
    });
  }

  private async conResultado<T>(peticion: Promise<Ack<T>>): Promise<boolean> {
    const r = await peticion;
    this.error = r.ok ? null : r.error;
    this.notificar();
    return r.ok;
  }

  private async entrar(mensaje: string, datos: unknown): Promise<boolean> {
    const r = await this.pedir<Sesion>(mensaje, datos);
    if (r.ok) {
      this.sesion = { codigo: r.codigo, jugador: r.jugador, token: r.token };
      guardarSesion(this.sesion);
      this.error = null;
    } else {
      this.error = r.error;
    }
    this.notificar();
    return r.ok;
  }

  /** Espera a que el socket conecte (o falla tras unos segundos). */
  conectado(maxMs = 5000): Promise<boolean> {
    if (this.socket.connected) return Promise.resolve(true);
    return new Promise((resolver) => {
      const t = setTimeout(() => resolver(false), maxMs);
      this.socket.once('connect', () => {
        clearTimeout(t);
        resolver(true);
      });
    });
  }

  crear(nombre: string): Promise<boolean> {
    return this.entrar(MENSAJES.crear, { nombre });
  }

  unirse(codigo: string, nombre: string): Promise<boolean> {
    return this.entrar(MENSAJES.unirse, { codigo: codigo.trim().toUpperCase(), nombre });
  }

  async reanudar(): Promise<boolean> {
    if (this.sesion === null) return false;
    const ok = await this.entrar(MENSAJES.reanudar, {
      codigo: this.sesion.codigo,
      token: this.sesion.token,
    });
    if (!ok && this.error === 'SESION_INVALIDA') this.olvidarSesion();
    return ok;
  }

  listo(listo: boolean): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.listo, { listo }));
  }

  cambiarOpciones(opciones: OpcionesSala): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.opciones, opciones));
  }

  anadirBot(nivel: 'facil' | 'normal'): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.anadirBot, { nivel }));
  }

  quitar(jugador: JugadorId): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.quitar, { jugador }));
  }

  /** Abre el túnel de Cloudflare (solo desde el equipo del servidor). */
  abrirTunel(): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.abrirTunel));
  }

  cerrarTunel(): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.cerrarTunel));
  }

  empezar(): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.empezar));
  }

  volverALaSala(): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.volverALaSala));
  }

  async salir(): Promise<void> {
    await this.pedir(MENSAJES.salir);
    this.olvidarSesion();
    this.notificar();
  }

  private olvidarSesion(): void {
    this.sesion = null;
    this.sala = null;
    this.partida = null;
    this.celebracionActual = null;
    this.cancelarFinCelebracion();
    this.pausaActual = null;
    this.cancelarFinPausa();
    this.presentacionActual = null;
    this.cancelarFinPresentacion();
    this.eventos = [];
    guardarSesion(null);
  }

  /** Cierra la conexión (al salir de las pantallas en línea). */
  cerrar(): void {
    this.cancelarFinCelebracion();
    this.cancelarFinPausa();
    this.cancelarFinPresentacion();
    this.socket.disconnect();
    this.escuchas.clear();
  }

  get soyCreador(): boolean {
    return this.sala !== null && this.sesion !== null && this.sala.creador === this.sesion.jugador;
  }

  // ------------------------------------------------------------------ FuenteMesa

  get config(): FuenteMesa['config'] {
    return { modo: 'enLinea', jugadores: this.partida?.jugadores ?? [] };
  }

  get observador(): JugadorId {
    return this.partida?.yo ?? this.sesion?.jugador ?? '';
  }

  get plazo(): Plazo | null {
    const p = this.partida?.plazo ?? null;
    if (p === null) return null;
    return {
      secuencia: p.secuencia,
      duracionMs: p.duracionMs,
      fin: p.restanteMs === null ? null : this.recibido + p.restanteMs,
    };
  }

  get plazoDecision(): PlazoDecision | null {
    const d = this.partida?.decision ?? null;
    return d === null ? null : { jugador: d.jugador, fin: this.recibido + d.restanteMs };
  }

  get celebracion(): Celebracion | null {
    const c = this.celebracionActual;
    if (c === null || Date.now() >= c.fin) return null;
    return { id: c.id, jugador: c.jugador, carta: c.carta, duracionMs: c.duracionMs };
  }

  private programarFinCelebracion(): void {
    this.cancelarFinCelebracion();
    const c = this.celebracionActual;
    if (c === null) return;
    this.temporizadorCelebracion = setTimeout(
      () => {
        this.temporizadorCelebracion = null;
        this.notificar();
      },
      Math.max(0, c.fin - Date.now()) + 20,
    );
  }

  get pausaResultado(): PausaResultado | null {
    const p = this.pausaActual;
    if (p === null || Date.now() >= p.fin) return null;
    return { id: p.id, duracionMs: p.duracionMs };
  }

  restantePausaResultadoMs(): number | null {
    const p = this.pausaActual;
    if (p === null || Date.now() >= p.fin) return null;
    return Math.max(0, p.fin - Date.now());
  }

  private programarFinPausa(): void {
    this.cancelarFinPausa();
    const p = this.pausaActual;
    if (p === null) return;
    this.temporizadorPausa = setTimeout(
      () => {
        this.temporizadorPausa = null;
        this.notificar();
      },
      Math.max(0, p.fin - Date.now()) + 20,
    );
  }

  get presentacionLider(): PresentacionLider | null {
    const p = this.presentacionActual;
    if (p === null || Date.now() >= p.fin) return null;
    return { id: p.id, jugador: p.jugador, carta: p.carta, duracionMs: p.duracionMs };
  }

  restantePresentacionLiderMs(): number | null {
    const p = this.presentacionActual;
    if (p === null || Date.now() >= p.fin) return null;
    return Math.max(0, p.fin - Date.now());
  }

  private programarFinPresentacion(): void {
    this.cancelarFinPresentacion();
    const p = this.presentacionActual;
    if (p === null) return;
    this.temporizadorPresentacion = setTimeout(
      () => {
        this.temporizadorPresentacion = null;
        this.notificar();
      },
      Math.max(0, p.fin - Date.now()) + 20,
    );
  }

  private cancelarFinPresentacion(): void {
    if (this.temporizadorPresentacion !== null) clearTimeout(this.temporizadorPresentacion);
    this.temporizadorPresentacion = null;
  }

  private cancelarFinPausa(): void {
    if (this.temporizadorPausa !== null) clearTimeout(this.temporizadorPausa);
    this.temporizadorPausa = null;
  }

  private cancelarFinCelebracion(): void {
    if (this.temporizadorCelebracion !== null) clearTimeout(this.temporizadorCelebracion);
    this.temporizadorCelebracion = null;
  }

  vista(): VistaJugador {
    if (this.partida === null) throw new Error('No hay partida');
    return this.partida.vista;
  }

  legales(): Accion[] {
    return this.partida?.legales ?? [];
  }

  motivo(accion: Accion): CodigoError | null {
    const clave = JSON.stringify(accion);
    if (this.legales().some((a) => JSON.stringify(a) === clave)) return null;
    return (
      this.partida?.motivos.find((m) => JSON.stringify(m.accion) === clave)?.codigo ??
      'NO_ES_MOMENTO'
    );
  }

  actuar(accion: Accion): Promise<boolean> {
    return this.conResultado(this.pedir(MENSAJES.accion, { accion }));
  }

  actorRequerido(): JugadorId | null {
    const v = this.partida?.vista;
    if (v === undefined || v.ganador !== null) return null;
    const cima = v.pila[v.pila.length - 1];
    if (cima === undefined) return v.turno.jugador;
    return cima.tipo === 'decision' || cima.tipo === 'elegir' || cima.tipo === 'tiradaInmediata'
      ? cima.jugador
      : null;
  }

  esBot(id: JugadorId): boolean {
    const control = this.partida?.jugadores.find((j) => j.id === id)?.control;
    return control !== 'humano' || this.conexion(id) === 'sustituido';
  }

  conexion(id: JugadorId): EstadoConexion {
    return this.partida?.conexiones[id] ?? 'conectado';
  }

  restanteMs(): number | null {
    const fin = this.plazo?.fin ?? null;
    return fin === null ? null : Math.max(0, fin - Date.now());
  }

  restanteDecisionMs(): number | null {
    const d = this.plazoDecision;
    if (d === null) return null;
    // Durante la celebración el servidor tiene la cuenta congelada: aquí tampoco avanza.
    const congelado = this.partida?.decision?.restanteMs;
    const enPausa =
      this.restanteCelebracionMs() !== null ||
      this.restantePausaResultadoMs() !== null ||
      this.restantePresentacionLiderMs() !== null;
    if (enPausa && congelado !== undefined) return congelado;
    return Math.max(0, d.fin - Date.now());
  }

  restanteCelebracionMs(): number | null {
    const c = this.celebracionActual;
    return c === null ? null : Math.max(0, c.fin - Date.now());
  }

  respondedoresPosibles(): JugadorId[] {
    return [];
  }

  responder(): void {
    // En línea cada jugador responde desde su dispositivo.
  }

  terminarRespuesta(): void {
    // En línea no hay turnos de respuesta en un mismo dispositivo.
  }

  confirmarTraspaso(): void {
    // En línea no hay que pasar el dispositivo.
  }
}
