/**
 * Anfitrión de una partida: lo usa la web para jugar en local (este dispositivo o contra bots) y el
 * servidor para las partidas en línea.
 *
 * - Aplica las acciones con el motor (los clientes nunca tocan el estado).
 * - Gestiona las cuentas regresivas de las ventanas y envía CERRAR_VENTANA al vencer.
 * - Hace jugar a los bots, con una pequeña pausa para que se pueda seguir la partida.
 * - Modo "local": decide de quién es la vista y cuándo hay que pasar el dispositivo.
 * - Modo "enLinea": si un jugador se desconecta, tras una espera juega un bot por él hasta que
 *   vuelva; con límite de tiempo, el bot decide por quien tarde demasiado.
 * - Celebración: al matar un Monstruo, la partida se detiene unos segundos para que todos vean la
 *   animación a la vez (nadie puede jugar; las cuentas regresivas se congelan).
 *
 * No depende de React ni de la red: se observa con `suscribir` y `version`.
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
import { aConfigPartida, type ConfigAnfitrion } from './config';
import { accionesDeInterfaz, motivosDe, type MotivoAccion } from './motivos';

export interface Reloj {
  ahora: () => number;
  programar: (fn: () => void, ms: number) => unknown;
  cancelar: (id: unknown) => void;
}

export const RELOJ_REAL: Reloj = {
  ahora: () => Date.now(),
  programar: (fn, ms) => globalThis.setTimeout(fn, ms),
  cancelar: (id) => globalThis.clearTimeout(id as Parameters<typeof clearTimeout>[0]),
};

export interface OpcionesAnfitrion {
  /** Pausa antes de que actúe un bot. */
  retardoBotMs?: number;
  /** Modo en línea: espera antes de que un bot sustituya a un jugador desconectado. */
  esperaDesconexionMs?: number;
  /** Pausa para celebrar un Monstruo derrotado (por defecto 4000 ms; 0 la desactiva). */
  celebracionMs?: number;
}

export const CELEBRACION_POR_DEFECTO_MS = 4000;

/** Monstruo derrotado que se está celebrando: mientras dura, nadie puede jugar. */
export interface Celebracion {
  /** Correlativo por anfitrión (distingue dos celebraciones seguidas de la misma carta). */
  id: number;
  jugador: JugadorId;
  carta: string;
  duracionMs: number;
}

/** Cuenta regresiva de la ventana abierta. */
export interface Plazo {
  secuencia: number;
  duracionMs: number;
  /** Instante (ms) en que vence; null si está en pausa. */
  fin: number | null;
}

/** Plazo de un jugador humano para decidir (límite de tiempo opcional). */
export interface PlazoDecision {
  jugador: JugadorId;
  fin: number;
}

export type EstadoConexion = 'conectado' | 'desconectado' | 'sustituido';

export const ESPERA_DESCONEXION_MS = 60_000;

export class Anfitrion {
  estado: GameState;
  readonly eventos: Evento[] = [];
  version = 0;
  plazo: Plazo | null = null;
  plazoDecision: PlazoDecision | null = null;
  /** Modo local: jugador cuya vista se muestra. */
  alMando: JugadorId;
  /** Modo local: jugador al que hay que pasar el dispositivo (pantalla de traspaso). */
  traspaso: JugadorId | null = null;
  /** Modo local: jugador que está respondiendo en una ventana (cuenta en pausa). */
  respondiendo: JugadorId | null = null;

  private readonly escuchas = new Set<() => void>();
  private readonly azares = new Map<JugadorId, () => number>();
  private readonly desconectados = new Map<JugadorId, unknown>();
  private readonly sustituidos = new Set<JugadorId>();
  private temporizadorVentana: unknown = null;
  private temporizadorBot: unknown = null;
  private temporizadorDecision: unknown = null;
  private temporizadorCelebracion: unknown = null;
  /** Celebración en curso e instante (ms) en que termina. */
  private celebracionActual: { celebracion: Celebracion; fin: number } | null = null;
  /** Monstruos matados que esperan su celebración (se celebran uno tras otro). */
  private readonly colaCelebraciones: Celebracion[] = [];
  /** Durante la celebración: lo que les quedaba a la ventana y a la decisión, y el traspaso. */
  private restantePlazoCongelado: number | null = null;
  private restanteDecisionCongelado: number | null = null;
  private traspasoDiferido: JugadorId | null = null;
  /** Eventos ya revisados en busca de Monstruos matados. */
  private eventosVistos = 0;
  private ultimaCelebracion = 0;
  /** Secuencia de la ventana de Modificadores que los bots ya han evaluado sin jugar nada. */
  private botsEvaluaron: number | null = null;
  private terminado = false;

  constructor(
    readonly motor: Motor,
    readonly config: ConfigAnfitrion,
    estado: GameState,
    private readonly reloj: Reloj = RELOJ_REAL,
    private readonly opciones: OpcionesAnfitrion = {},
    eventosPrevios: readonly Evento[] = [],
  ) {
    this.estado = estado;
    this.eventos.push(...eventosPrevios);
    // Los Monstruos matados antes de crear el anfitrión (partida cargada) no se celebran.
    this.eventosVistos = this.eventos.length;
    // Todos tienen generador propio: los humanos también, por si un bot tiene que decidir por ellos.
    for (const j of config.jugadores) {
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
    config: ConfigAnfitrion,
    reloj?: Reloj,
    opciones?: OpcionesAnfitrion,
  ): Anfitrion {
    const { state, events } = motor.crearPartida(aConfigPartida(config));
    return new Anfitrion(motor, config, state, reloj, opciones, events);
  }

  // ------------------------------------------------------------------ consultas

  /** Jugadores controlados por personas (según la configuración). */
  /** Humanos que no se han rendido (D-43). */
  private get humanosEnJuego(): JugadorId[] {
    return this.humanos.filter((id) => !this.estado.rendidos.includes(id));
  }

  get humanos(): JugadorId[] {
    return this.config.jugadores.filter((j) => j.control === 'humano').map((j) => j.id);
  }

  esHumano(id: JugadorId): boolean {
    return !this.esBot(id);
  }

  /** Bot por configuración o, en línea, sustituyendo a un jugador desconectado. */
  esBot(id: JugadorId): boolean {
    const control = this.config.jugadores.find((j) => j.id === id)?.control;
    return control !== 'humano' || this.sustituidos.has(id);
  }

  conexion(id: JugadorId): EstadoConexion {
    if (this.sustituidos.has(id)) return 'sustituido';
    return this.desconectados.has(id) ? 'desconectado' : 'conectado';
  }

  /** Jugador cuya vista se muestra (modos locales). */
  get observador(): JugadorId {
    return this.config.modo === 'bots' ? (this.humanos[0] ?? this.alMando) : this.alMando;
  }

  vista(): VistaJugador {
    return this.motor.getPlayerView(this.estado, this.observador);
  }

  legales(): Accion[] {
    if (this.traspaso !== null || this.celebracionActual !== null) return [];
    return this.motor.accionesLegales(this.estado, this.observador);
  }

  validar(accion: Accion): CodigoError | null {
    if (this.celebracionActual !== null) return 'CELEBRACION';
    return this.motor.validar(this.estado, { actor: this.observador, accion });
  }

  /** Alias de `validar` (interfaz común con el cliente en línea). */
  motivo(accion: Accion): CodigoError | null {
    return this.validar(accion);
  }

  /** Envía una acción como el jugador que está mirando (modos locales). */
  actuar(accion: Accion): CodigoError | null {
    return this.enviar(this.observador, accion);
  }

  vistaDe(id: JugadorId): VistaJugador {
    return this.motor.getPlayerView(this.estado, id);
  }

  legalesDe(id: JugadorId): Accion[] {
    if (this.celebracionActual !== null) return [];
    return this.motor.accionesLegales(this.estado, id);
  }

  motivosDe(id: JugadorId): MotivoAccion[] {
    if (this.celebracionActual !== null) {
      return accionesDeInterfaz(this.motor, this.estado, id).map((accion) => ({
        accion,
        codigo: 'CELEBRACION',
      }));
    }
    return motivosDe(this.motor, this.estado, id);
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
    if (this.celebracionActual !== null) return [];
    const cima = this.estado.pila[this.estado.pila.length - 1];
    if (cima?.tipo === 'ventanaDesafio') {
      return this.humanosEnJuego.filter(
        (id) => id !== cima.jugada.jugador && !cima.pasaron.includes(id),
      );
    }
    if (cima?.tipo === 'ventanaModificadores') return [...this.humanosEnJuego];
    return [];
  }

  /** Milisegundos que quedan en la cuenta regresiva de la ventana (null si no hay o está en pausa). */
  restanteMs(): number | null {
    if (this.plazo === null || this.plazo.fin === null) return null;
    return Math.max(0, this.plazo.fin - this.reloj.ahora());
  }

  /** Milisegundos que le quedan al jugador que debe decidir (null si no hay límite). */
  restanteDecisionMs(): number | null {
    if (this.plazoDecision === null) return null;
    if (this.restanteDecisionCongelado !== null) return this.restanteDecisionCongelado;
    return Math.max(0, this.plazoDecision.fin - this.reloj.ahora());
  }

  /** Monstruo derrotado que se está celebrando, o null. */
  get celebracion(): Celebracion | null {
    return this.celebracionActual?.celebracion ?? null;
  }

  /** Milisegundos que quedan de la celebración (null si no hay). */
  restanteCelebracionMs(): number | null {
    if (this.celebracionActual === null) return null;
    return Math.max(0, this.celebracionActual.fin - this.reloj.ahora());
  }

  // ------------------------------------------------------------------ acciones

  suscribir(fn: () => void): () => void {
    this.escuchas.add(fn);
    return () => {
      this.escuchas.delete(fn);
    };
  }

  /** Envía una acción de un jugador (o del sistema). Devuelve el error si es ilegal. */
  enviar(actor: Actor, accion: Accion): CodigoError | null {
    if (this.terminado) return 'PARTIDA_TERMINADA';
    if (this.celebracionActual !== null && actor !== SISTEMA) return 'CELEBRACION';
    const r = this.motor.reducer(this.estado, { actor, accion });
    if (!r.ok) return r.error.codigo;
    this.estado = r.state;
    this.eventos.push(...r.events);
    this.actualizar();
    return null;
  }

  /** Modo local: el jugador `id` quiere responder en la ventana abierta. */
  responder(id: JugadorId): void {
    // Durante la celebración nada avanza (respondedoresPosibles ya es []; se deja explícito).
    if (this.celebracionActual !== null) return;
    if (!this.respondedoresPosibles().includes(id)) return;
    this.respondiendo = id;
    this.pausarPlazo();
    if (id !== this.alMando) this.traspaso = id;
    this.notificar();
  }

  /** Modo local: el jugador que respondía ha terminado; se devuelve el dispositivo. */
  terminarRespuesta(): void {
    // Durante la celebración no hace nada: el jugador sigue respondiendo y podrá terminar después.
    if (this.respondiendo === null || this.celebracionActual !== null) return;
    this.respondiendo = null;
    this.reanudarPlazo();
    const siguiente = this.actorRequerido() ?? this.estado.turno.jugador;
    if (siguiente !== this.alMando && this.humanos.includes(siguiente)) this.traspaso = siguiente;
    this.programarBots();
    this.notificar();
  }

  /** Modo local: el jugador que recibe el dispositivo confirma que es él. */
  confirmarTraspaso(): void {
    // Durante la celebración el traspaso está diferido; no se puede confirmar todavía.
    if (this.traspaso === null || this.celebracionActual !== null) return;
    this.alMando = this.traspaso;
    this.traspaso = null;
    this.notificar();
  }

  /** En línea: el jugador ha perdido la conexión. Tras la espera, un bot juega por él. */
  desconectar(id: JugadorId): void {
    if (
      this.terminado ||
      !this.humanos.includes(id) ||
      this.desconectados.has(id) ||
      this.sustituidos.has(id)
    ) {
      return;
    }
    const temporizador = this.reloj.programar(() => {
      this.desconectados.delete(id);
      this.sustituidos.add(id);
      this.actualizar();
    }, this.opciones.esperaDesconexionMs ?? ESPERA_DESCONEXION_MS);
    this.desconectados.set(id, temporizador);
    this.notificar();
  }

  /** En línea: el jugador ha vuelto; recupera el control de su asiento. */
  reconectar(id: JugadorId): void {
    const temporizador = this.desconectados.get(id);
    if (temporizador !== undefined) this.reloj.cancelar(temporizador);
    const estaba = this.desconectados.delete(id) || this.sustituidos.delete(id);
    if (estaba) this.actualizar();
  }

  /** Detiene temporizadores (al salir de la partida o cerrar la sala). */
  destruir(): void {
    this.terminado = true;
    this.cancelar();
    if (this.temporizadorCelebracion !== null) this.reloj.cancelar(this.temporizadorCelebracion);
    this.temporizadorCelebracion = null;
    for (const t of this.desconectados.values()) this.reloj.cancelar(t);
    this.desconectados.clear();
    this.escuchas.clear();
  }

  // ------------------------------------------------------------------ interno

  private notificar(): void {
    this.version += 1;
    for (const fn of this.escuchas) fn();
  }

  private cancelar(): void {
    for (const t of [this.temporizadorVentana, this.temporizadorBot, this.temporizadorDecision]) {
      if (t !== null) this.reloj.cancelar(t);
    }
    this.temporizadorVentana = null;
    this.temporizadorBot = null;
    this.temporizadorDecision = null;
  }

  /** Recalcula temporizadores, bots y traspasos tras cada cambio de estado. */
  private actualizar(): void {
    this.detectarCelebraciones();
    if (this.estado.ganador !== null) {
      // La celebración del Monstruo que da la victoria sigue su curso; la victoria va después.
      this.cancelar();
      this.plazo = null;
      this.plazoDecision = null;
      this.restantePlazoCongelado = null;
      this.restanteDecisionCongelado = null;
      this.respondiendo = null;
      this.traspaso = null;
      this.traspasoDiferido = null;
      this.notificar();
      return;
    }
    const cima = this.estado.pila[this.estado.pila.length - 1];

    if (cima?.tipo !== 'ventanaDesafio' && cima?.tipo !== 'ventanaModificadores') {
      this.plazo = null;
      this.respondiendo = null;
      if (this.temporizadorVentana !== null) this.reloj.cancelar(this.temporizadorVentana);
      this.temporizadorVentana = null;
      this.restantePlazoCongelado = null;
    } else if (this.plazo?.secuencia !== cima.secuencia) {
      // Ventana nueva o reiniciada (un Modificador o un disparador): cuenta completa.
      this.plazo = { secuencia: cima.secuencia, duracionMs: cima.duracionMs, fin: null };
      if (this.celebracionActual !== null) this.restantePlazoCongelado = cima.duracionMs;
      else if (this.respondiendo === null) this.reanudarPlazo();
    }

    const traspaso = this.traspasoNecesario();
    if (traspaso !== null) {
      // La celebración va primero: todos la ven en la misma pantalla y después se pasa.
      if (this.celebracionActual !== null) this.traspasoDiferido = traspaso;
      else this.traspaso = traspaso;
    }

    this.programarBots();
    this.programarLimiteDecision();
    this.notificar();
  }

  /** Modo local: jugador al que hay que pasar el dispositivo para que actúe, o null. */
  private traspasoNecesario(): JugadorId | null {
    if (this.config.modo !== 'local' || this.respondiendo !== null) return null;
    const requerido = this.actorRequerido();
    if (requerido !== null && requerido !== this.alMando && this.humanos.includes(requerido)) {
      return requerido;
    }
    return null;
  }

  /** Encola una celebración por cada Monstruo matado en los eventos nuevos. */
  private detectarCelebraciones(): void {
    const nuevos = this.eventos.slice(this.eventosVistos);
    this.eventosVistos = this.eventos.length;
    const duracionMs = this.opciones.celebracionMs ?? CELEBRACION_POR_DEFECTO_MS;
    if (duracionMs <= 0 || this.terminado) return;
    for (const e of nuevos) {
      if (e.tipo === 'monstruoMatado') {
        this.ultimaCelebracion += 1;
        this.colaCelebraciones.push({
          id: this.ultimaCelebracion,
          jugador: e.jugador,
          carta: e.carta,
          duracionMs,
        });
      }
    }
    if (this.celebracionActual === null) this.empezarCelebracion();
  }

  /** Empieza la siguiente celebración de la cola: congela la ventana, la decisión y los bots. */
  private empezarCelebracion(): void {
    const celebracion = this.colaCelebraciones.shift();
    if (celebracion === undefined) return;
    const fin = this.reloj.ahora() + celebracion.duracionMs;
    this.celebracionActual = { celebracion, fin };
    this.temporizadorCelebracion = this.reloj.programar(
      () => this.terminarCelebracion(),
      celebracion.duracionMs,
    );
    if (this.plazo !== null && this.plazo.fin !== null) {
      this.restantePlazoCongelado = this.restanteMs();
      this.pausarPlazo();
    }
    if (this.temporizadorDecision !== null) {
      this.reloj.cancelar(this.temporizadorDecision);
      this.temporizadorDecision = null;
      this.restanteDecisionCongelado = this.restanteDecisionMs();
    }
    if (this.plazoDecision !== null && this.restanteDecisionCongelado !== null) {
      this.plazoDecision = { ...this.plazoDecision, fin: fin + this.restanteDecisionCongelado };
    }
    if (this.traspaso !== null) {
      this.traspasoDiferido = this.traspaso;
      this.traspaso = null;
    }
    if (this.temporizadorBot !== null) this.reloj.cancelar(this.temporizadorBot);
    this.temporizadorBot = null;
  }

  /** Fin de una celebración: la siguiente de la cola o, si no hay, se reanuda la partida. */
  private terminarCelebracion(): void {
    this.temporizadorCelebracion = null;
    this.celebracionActual = null;
    if (this.terminado) return;
    if (this.colaCelebraciones.length > 0) {
      this.empezarCelebracion();
      this.notificar();
      return;
    }
    if (this.estado.ganador === null) {
      if (
        this.plazo !== null &&
        this.restantePlazoCongelado !== null &&
        this.respondiendo === null
      ) {
        this.reanudarPlazo(this.restantePlazoCongelado);
      }
      this.traspaso = this.traspasoDiferido ?? this.traspasoNecesario();
      const decision = this.plazoDecision;
      const restante = this.restanteDecisionCongelado;
      this.restanteDecisionCongelado = null;
      this.plazoDecision = null;
      if (decision !== null && restante !== null && this.traspaso === null) {
        this.programarDecision(decision.jugador, restante);
      }
      this.programarBots();
    }
    this.restantePlazoCongelado = null;
    this.traspasoDiferido = null;
    this.notificar();
  }

  /** Pone en marcha la cuenta de la ventana: completa o, tras una celebración, lo que quedaba. */
  private reanudarPlazo(restanteMs?: number): void {
    if (this.plazo === null) return;
    if (this.temporizadorVentana !== null) this.reloj.cancelar(this.temporizadorVentana);
    const { secuencia, duracionMs } = this.plazo;
    const ms = restanteMs ?? duracionMs;
    this.plazo = { secuencia, duracionMs, fin: this.reloj.ahora() + ms };
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
    }, ms);
  }

  private pausarPlazo(): void {
    if (this.temporizadorVentana !== null) this.reloj.cancelar(this.temporizadorVentana);
    this.temporizadorVentana = null;
    if (this.plazo !== null) this.plazo = { ...this.plazo, fin: null };
  }

  /** Límite de tiempo opcional: si un humano tarda demasiado, el bot normal decide por él esa vez. */
  private programarLimiteDecision(): void {
    const limite = this.config.limiteDecisionS;
    const requerido = this.actorRequerido();
    if (this.temporizadorDecision !== null) this.reloj.cancelar(this.temporizadorDecision);
    this.temporizadorDecision = null;
    this.plazoDecision = null;
    this.restanteDecisionCongelado = null;
    if (limite === undefined || limite === null || limite <= 0) return;
    if (requerido === null || this.esBot(requerido) || this.traspaso !== null) return;
    this.programarDecision(requerido, limite * 1000);
  }

  /** Plazo de `ms` para que decida `requerido`; durante una celebración queda congelado. */
  private programarDecision(requerido: JugadorId, ms: number): void {
    if (this.celebracionActual !== null) {
      this.restanteDecisionCongelado = ms;
      this.plazoDecision = { jugador: requerido, fin: this.celebracionActual.fin + ms };
      return;
    }
    const clave = `${requerido}:${this.estado.pila.length}:${this.eventos.length}`;
    this.plazoDecision = { jugador: requerido, fin: this.reloj.ahora() + ms };
    this.temporizadorDecision = this.reloj.programar(() => {
      this.temporizadorDecision = null;
      const actual = `${this.actorRequerido() ?? ''}:${this.estado.pila.length}:${this.eventos.length}`;
      if (actual !== clave || this.estado.ganador !== null) return;
      this.actuarConBot(requerido);
    }, ms);
  }

  private programarBots(): void {
    if (this.temporizadorBot !== null) this.reloj.cancelar(this.temporizadorBot);
    this.temporizadorBot = null;
    if (this.celebracionActual !== null) return;
    if (this.respondiendo !== null || !this.hayTrabajoParaBots()) return;
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
    if (cima?.tipo === 'ventanaModificadores') {
      return (
        this.botsEvaluaron !== cima.secuencia && this.estado.jugadores.some((j) => this.esBot(j.id))
      );
    }
    const requerido = this.actorRequerido();
    return requerido !== null && this.esBot(requerido);
  }

  private botDe(id: JugadorId): { bot: Bot; azar: () => number } | null {
    const control = this.config.jugadores.find((j) => j.id === id)?.control;
    const azar = this.azares.get(id);
    if (control === undefined || azar === undefined) return null;
    // Un humano sustituido (o que agota su tiempo) lo juega el bot normal.
    return { bot: BOTS[control === 'humano' ? 'normal' : control], azar };
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

  /** El bot decide una vez por `id` (debe ser quien tiene que actuar). */
  private actuarConBot(id: JugadorId): void {
    const accion = this.preguntarBot(id) ?? this.motor.accionesLegales(this.estado, id)[0];
    if (accion === undefined) return;
    if (this.enviar(id, accion) !== null) {
      // Red de seguridad: si el bot propone algo ilegal, juega la primera acción legal.
      const legal = this.motor.accionesLegales(this.estado, id)[0];
      if (legal !== undefined) this.enviar(id, legal);
    }
  }

  /** Un "paso" de los bots: como mucho una acción; después se vuelve a programar. */
  private turnoDeBots(): void {
    if (this.estado.ganador !== null || this.terminado || this.celebracionActual !== null) return;
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
    if (requerido !== null && this.esBot(requerido)) this.actuarConBot(requerido);
  }
}
