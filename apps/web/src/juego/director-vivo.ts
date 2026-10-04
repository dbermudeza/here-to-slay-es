/**
 * Director en vivo: hace de host de una partida local en el navegador.
 *
 * - Aplica las acciones de los jugadores con el motor (la interfaz nunca toca el estado).
 * - Gestiona las cuentas regresivas reales de las ventanas y envía CERRAR_VENTANA al vencer.
 * - Hace jugar a los bots (con una pequeña pausa para que se pueda seguir la partida).
 * - En modo "este dispositivo", decide de quién es la vista y cuándo hay que pasar el dispositivo.
 *
 * No depende de React: la interfaz se suscribe con `suscribir` y lee `version`.
 */
import { BOTS, type Bot } from '@hts/bots';
import {
  crearRng,
  siguienteRng,
  SISTEMA,
  type Accion,
  type Actor,
  type CodigoError,
  type Evento,
  type GameState,
  type JugadorId,
  type Motor,
  type VistaJugador,
} from '@hts/engine';
import { aConfigPartida, type ConfigLocal } from './config';

export interface Reloj {
  ahora: () => number;
  programar: (fn: () => void, ms: number) => number;
  cancelar: (id: number) => void;
}

export const RELOJ_REAL: Reloj = {
  ahora: () => Date.now(),
  programar: (fn, ms) => window.setTimeout(fn, ms),
  cancelar: (id) => window.clearTimeout(id),
};

export interface OpcionesDirector {
  /** Pausa antes de que actúe un bot. */
  retardoBotMs?: number;
}

/** Cuenta regresiva de la ventana abierta. */
export interface Plazo {
  secuencia: number;
  duracionMs: number;
  /** Instante (ms) en que vence; null si está en pausa. */
  fin: number | null;
}

export class DirectorVivo {
  estado: GameState;
  readonly eventos: Evento[] = [];
  version = 0;
  plazo: Plazo | null = null;
  /** Modo "este dispositivo": jugador cuya vista se muestra. */
  alMando: JugadorId;
  /** Modo "este dispositivo": jugador al que hay que pasar el dispositivo (pantalla de traspaso). */
  traspaso: JugadorId | null = null;
  /** Modo "este dispositivo": jugador que está respondiendo en una ventana (cuenta en pausa). */
  respondiendo: JugadorId | null = null;

  private readonly escuchas = new Set<() => void>();
  private readonly azares = new Map<JugadorId, () => number>();
  private temporizadorVentana: number | null = null;
  private temporizadorBot: number | null = null;
  /** Secuencia de la ventana de Modificadores que los bots ya han evaluado sin jugar nada. */
  private botsEvaluaron: number | null = null;
  private terminado = false;

  constructor(
    readonly motor: Motor,
    readonly config: ConfigLocal,
    estado: GameState,
    private readonly reloj: Reloj = RELOJ_REAL,
    private readonly opciones: OpcionesDirector = {},
    eventosPrevios: readonly Evento[] = [],
  ) {
    this.estado = estado;
    this.eventos.push(...eventosPrevios);
    for (const j of config.jugadores) {
      if (j.control === 'humano') continue;
      let rng = crearRng(`${config.semilla}:${j.id}`);
      this.azares.set(j.id, () => {
        const [x, siguiente] = siguienteRng(rng);
        rng = siguiente;
        return x;
      });
    }
    this.alMando = this.humanos[0] ?? estado.turno.jugador;
    this.actualizar();
  }

  static nueva(
    motor: Motor,
    config: ConfigLocal,
    reloj?: Reloj,
    opciones?: OpcionesDirector,
  ): DirectorVivo {
    const { state, events } = motor.crearPartida(aConfigPartida(config));
    return new DirectorVivo(motor, config, state, reloj, opciones, events);
  }

  // ------------------------------------------------------------------ consultas

  get humanos(): JugadorId[] {
    return this.config.jugadores.filter((j) => j.control === 'humano').map((j) => j.id);
  }

  esHumano(id: JugadorId): boolean {
    return this.humanos.includes(id);
  }

  esBot(id: JugadorId): boolean {
    return !this.esHumano(id);
  }

  /** Jugador cuya vista se muestra: el humano en modo bots; el que tiene el dispositivo en modo local. */
  get observador(): JugadorId {
    return this.config.modo === 'bots' ? (this.humanos[0] ?? this.alMando) : this.alMando;
  }

  vista(): VistaJugador {
    return this.motor.getPlayerView(this.estado, this.observador);
  }

  legales(): Accion[] {
    if (this.traspaso !== null) return [];
    return this.motor.accionesLegales(this.estado, this.observador);
  }

  validar(accion: Accion): CodigoError | null {
    return this.motor.validar(this.estado, { actor: this.observador, accion });
  }

  /** Jugador que debe actuar ahora, o null si cualquiera puede responder (ventanas) o nadie. */
  actorRequerido(): JugadorId | null {
    if (this.estado.ganador !== null) return null;
    const cima = this.estado.pila[this.estado.pila.length - 1];
    if (cima === undefined) return this.estado.turno.jugador;
    switch (cima.tipo) {
      case 'decision':
      case 'elegir':
      case 'tiradaInmediata':
        return cima.jugador;
      default:
        return null;
    }
  }

  /** Jugadores humanos que pueden responder en la ventana abierta (modo local). */
  respondedoresPosibles(): JugadorId[] {
    const cima = this.estado.pila[this.estado.pila.length - 1];
    if (cima?.tipo === 'ventanaDesafio') {
      return this.humanos.filter((id) => id !== cima.jugada.jugador && !cima.pasaron.includes(id));
    }
    if (cima?.tipo === 'ventanaModificadores') return [...this.humanos];
    return [];
  }

  /** Milisegundos que quedan en la cuenta regresiva (null si no hay ventana o está en pausa). */
  restanteMs(): number | null {
    if (this.plazo?.fin === null || this.plazo === null) return null;
    return Math.max(0, this.plazo.fin - this.reloj.ahora());
  }

  // ------------------------------------------------------------------ acciones

  suscribir(fn: () => void): () => void {
    this.escuchas.add(fn);
    return () => {
      this.escuchas.delete(fn);
    };
  }

  /** Envía una acción de un jugador humano (o del sistema). Devuelve el error si es ilegal. */
  enviar(actor: Actor, accion: Accion): CodigoError | null {
    if (this.terminado) return 'PARTIDA_TERMINADA';
    const r = this.motor.reducer(this.estado, { actor, accion });
    if (!r.ok) return r.error.codigo;
    this.estado = r.state;
    this.eventos.push(...r.events);
    this.actualizar();
    return null;
  }

  /** Modo local: el jugador `id` quiere responder en la ventana abierta. */
  responder(id: JugadorId): void {
    if (!this.respondedoresPosibles().includes(id)) return;
    this.respondiendo = id;
    this.pausarPlazo();
    if (id !== this.alMando) this.traspaso = id;
    this.notificar();
  }

  /** Modo local: el jugador que respondía ha terminado; se devuelve el dispositivo. */
  terminarRespuesta(): void {
    if (this.respondiendo === null) return;
    this.respondiendo = null;
    this.reanudarPlazo();
    const siguiente = this.actorRequerido() ?? this.estado.turno.jugador;
    if (siguiente !== this.alMando && this.esHumano(siguiente)) this.traspaso = siguiente;
    this.programarBots();
    this.notificar();
  }

  /** Modo local: el jugador que recibe el dispositivo confirma que es él. */
  confirmarTraspaso(): void {
    if (this.traspaso === null) return;
    this.alMando = this.traspaso;
    this.traspaso = null;
    this.notificar();
  }

  /** Detiene temporizadores (al salir de la partida). */
  destruir(): void {
    this.terminado = true;
    this.cancelar();
    this.escuchas.clear();
  }

  // ------------------------------------------------------------------ interno

  private notificar(): void {
    this.version += 1;
    for (const fn of this.escuchas) fn();
  }

  private cancelar(): void {
    if (this.temporizadorVentana !== null) this.reloj.cancelar(this.temporizadorVentana);
    if (this.temporizadorBot !== null) this.reloj.cancelar(this.temporizadorBot);
    this.temporizadorVentana = null;
    this.temporizadorBot = null;
  }

  /** Recalcula temporizadores, bots y traspasos tras cada cambio de estado. */
  private actualizar(): void {
    if (this.estado.ganador !== null) {
      this.cancelar();
      this.plazo = null;
      this.respondiendo = null;
      this.traspaso = null;
      this.notificar();
      return;
    }
    const cima = this.estado.pila[this.estado.pila.length - 1];

    if (cima?.tipo !== 'ventanaDesafio' && cima?.tipo !== 'ventanaModificadores') {
      this.plazo = null;
      this.respondiendo = null;
      if (this.temporizadorVentana !== null) this.reloj.cancelar(this.temporizadorVentana);
      this.temporizadorVentana = null;
    } else if (this.plazo?.secuencia !== cima.secuencia) {
      // Ventana nueva o reiniciada (un Modificador o un disparador): cuenta completa.
      this.plazo = { secuencia: cima.secuencia, duracionMs: cima.duracionMs, fin: null };
      if (this.respondiendo === null) this.reanudarPlazo();
    }

    if (this.config.modo === 'local' && this.respondiendo === null) {
      const requerido = this.actorRequerido();
      if (requerido !== null && requerido !== this.alMando && this.esHumano(requerido)) {
        this.traspaso = requerido;
      }
    }

    this.programarBots();
    this.notificar();
  }

  private reanudarPlazo(): void {
    if (this.plazo === null) return;
    if (this.temporizadorVentana !== null) this.reloj.cancelar(this.temporizadorVentana);
    const { secuencia, duracionMs } = this.plazo;
    this.plazo = { secuencia, duracionMs, fin: this.reloj.ahora() + duracionMs };
    this.temporizadorVentana = this.reloj.programar(() => {
      this.temporizadorVentana = null;
      const cima = this.estado.pila[this.estado.pila.length - 1];
      if (
        cima !== undefined &&
        'secuencia' in cima &&
        cima.secuencia === secuencia &&
        this.respondiendo === null
      ) {
        this.enviar(SISTEMA, { tipo: 'CERRAR_VENTANA', secuencia });
      }
    }, duracionMs);
  }

  private pausarPlazo(): void {
    if (this.temporizadorVentana !== null) this.reloj.cancelar(this.temporizadorVentana);
    this.temporizadorVentana = null;
    if (this.plazo !== null) this.plazo = { ...this.plazo, fin: null };
  }

  private programarBots(): void {
    if (this.temporizadorBot !== null) this.reloj.cancelar(this.temporizadorBot);
    this.temporizadorBot = null;
    if (this.azares.size === 0 || this.respondiendo !== null) return;
    if (!this.hayTrabajoParaBots()) return;
    this.temporizadorBot = this.reloj.programar(() => {
      this.temporizadorBot = null;
      this.turnoDeBots();
    }, this.opciones.retardoBotMs ?? 700);
  }

  private hayTrabajoParaBots(): boolean {
    const cima = this.estado.pila[this.estado.pila.length - 1];
    if (cima?.tipo === 'ventanaDesafio') {
      return this.estado.jugadores.some(
        (j) => this.esBot(j.id) && j.id !== cima.jugada.jugador && !cima.pasaron.includes(j.id),
      );
    }
    if (cima?.tipo === 'ventanaModificadores') return this.botsEvaluaron !== cima.secuencia;
    const requerido = this.actorRequerido();
    return requerido !== null && this.esBot(requerido);
  }

  private botDe(id: JugadorId): { bot: Bot; azar: () => number } | null {
    const control = this.config.jugadores.find((j) => j.id === id)?.control;
    const azar = this.azares.get(id);
    if (control === undefined || control === 'humano' || azar === undefined) return null;
    return { bot: BOTS[control], azar };
  }

  private preguntarBot(id: JugadorId): Accion | null {
    const b = this.botDe(id);
    if (b === null) return null;
    const legales = this.motor.accionesLegales(this.estado, id);
    if (legales.length === 0) return null;
    return b.bot.elegir({
      vista: this.motor.getPlayerView(this.estado, id),
      legales,
      catalogo: this.motor.catalogo,
      azar: b.azar,
    });
  }

  /** Un "paso" de los bots: como mucho una acción; después se vuelve a programar. */
  private turnoDeBots(): void {
    if (this.estado.ganador !== null || this.terminado) return;
    const cima = this.estado.pila[this.estado.pila.length - 1];

    if (cima?.tipo === 'ventanaDesafio') {
      const id = this.estado.jugadores
        .map((j) => j.id)
        .find((x) => this.esBot(x) && x !== cima.jugada.jugador && !cima.pasaron.includes(x));
      if (id === undefined) return;
      const accion = this.preguntarBot(id);
      this.enviar(id, accion?.tipo === 'DESAFIAR' ? accion : { tipo: 'PASAR' });
      return;
    }

    if (cima?.tipo === 'ventanaModificadores') {
      for (const j of this.estado.jugadores) {
        if (!this.esBot(j.id)) continue;
        const accion = this.preguntarBot(j.id);
        if (accion?.tipo === 'JUGAR_MODIFICADOR' && this.enviar(j.id, accion) === null) return;
      }
      // Ningún bot juega nada en esta ventana: la cerrará la cuenta regresiva.
      this.botsEvaluaron = cima.secuencia;
      return;
    }

    const requerido = this.actorRequerido();
    if (requerido === null || !this.esBot(requerido)) return;
    const accion =
      this.preguntarBot(requerido) ?? this.motor.accionesLegales(this.estado, requerido)[0];
    if (accion === undefined) return;
    if (this.enviar(requerido, accion) !== null) {
      // Red de seguridad: si el bot propone algo ilegal, juega la primera acción legal.
      const legal = this.motor.accionesLegales(this.estado, requerido)[0];
      if (legal !== undefined) this.enviar(requerido, legal);
    }
  }
}
