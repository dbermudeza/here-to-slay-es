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
 * - Pausa de resultado: tras una tirada, un desafío, un ataque o una jugada que se resuelve, la
 *   partida se detiene un momento para todos, como en la celebración pero sin animación propia,
 *   para que el resultado se vea antes de la siguiente pregunta o ventana.
 * - Presentación del Líder: la primera vez en cada turno que se activa la habilidad del Líder de un
 *   jugador (evento `liderActivado`), la partida se detiene igual para que todos vean la animación.
 * - Las detenciones nunca se solapan: van una tras otra, en el orden de los eventos (presentación
 *   del Líder → celebración del Monstruo → pausa de resultado; la celebración tapa al resultado).
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
  /**
   * Pausa para todos tras un evento que la interfaz enseña como resultado (tirada, duelo, ataque,
   * jugada resuelta o anulada). Mientras dura nadie puede jugar y las cuentas regresivas se
   * congelan, como en la celebración. Por defecto 3000 ms (la escena más larga, el duelo); 0 la
   * desactiva.
   */
  pausaResultadoMs?: number;
  /**
   * Pausa para presentar la activación de la habilidad de un Líder (solo la primera de cada Líder
   * en cada turno). Por defecto 2500 ms; 0 la desactiva.
   */
  presentacionLiderMs?: number;
}

export const CELEBRACION_POR_DEFECTO_MS = 4000;
export const PAUSA_RESULTADO_POR_DEFECTO_MS = 3000;
export const PRESENTACION_LIDER_POR_DEFECTO_MS = 2500;
export const RETARDO_BOT_POR_DEFECTO_MS = 700;

/** Monstruo derrotado que se está celebrando: mientras dura, nadie puede jugar. */
export interface Celebracion {
  /** Correlativo por anfitrión (distingue dos celebraciones seguidas de la misma carta). */
  id: number;
  jugador: JugadorId;
  carta: string;
  duracionMs: number;
}

/** Activación de la habilidad de un Líder que se está presentando: mientras dura, nadie juega. */
export interface PresentacionLider {
  /** Correlativo por anfitrión. */
  id: number;
  jugador: JugadorId;
  /** Id de catálogo del Líder. */
  carta: string;
  duracionMs: number;
}

/** Pausa tras un resultado: mientras dura, nadie puede jugar. */
export interface PausaResultado {
  /**
   * Correlativo por anfitrión. Si llega otro resultado durante la pausa, esta se alarga desde ese
   * resultado y conserva el id (para la interfaz es la misma pausa, sin cortes).
   */
  id: number;
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
  /** Pausa de resultado en curso e instante (ms) en que termina. */
  private pausaActual: { pausa: PausaResultado; fin: number } | null = null;
  private temporizadorPausa: unknown = null;
  private ultimaPausa = 0;
  /** Pausa de resultado que espera a que termine la presentación del Líder. */
  private pausaPendiente = false;
  /** Presentación del Líder en curso e instante (ms) en que termina. */
  private presentacionActual: { presentacion: PresentacionLider; fin: number } | null = null;
  /** Activaciones de Líder que esperan su presentación (una tras otra). */
  private readonly colaPresentaciones: PresentacionLider[] = [];
  private temporizadorPresentacion: unknown = null;
  private ultimaPresentacion = 0;
  /** Turno (`turno.numero`) de `lideresPresentados` y Líderes ya presentados en él. */
  private turnoPresentados: number;
  private readonly lideresPresentados = new Set<string>();
  /**
   * Con la partida detenida (celebración o pausa de resultado): lo que les quedaba a la ventana y
   * a la decisión, y el traspaso.
   */
  private restantePlazoCongelado: number | null = null;
  private restanteDecisionCongelado: number | null = null;
  private traspasoDiferido: JugadorId | null = null;
  /** Eventos ya revisados en busca de Monstruos matados y de resultados. */
  private eventosVistos = 0;
  /** Última carta jugada cuya resolución todavía no se ha visto (como la sigue la interfaz). */
  private jugadaEnCurso: { jugador: JugadorId; carta: string } | null = null;
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
    // Tampoco se presentan sus activaciones de Líder. Si `eventosPrevios` incluye el `turnoIniciado`
    // del turno en curso, las activaciones posteriores a él cuentan como ya presentadas (no se
    // repiten tras cargar); si no lo incluye (sin historial, o recortado), el turno empieza limpio y
    // la siguiente activación de cada Líder se presenta.
    this.turnoPresentados = -1;
    this.detectarPresentaciones(this.eventos, false);
    if (this.turnoPresentados !== estado.turno.numero) {
      this.turnoPresentados = estado.turno.numero;
      this.lideresPresentados.clear();
    }
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
    if (this.traspaso !== null || this.detenida() !== null) return [];
    return this.motor.accionesLegales(this.estado, this.observador);
  }

  validar(accion: Accion): CodigoError | null {
    const detenida = this.detenida();
    if (detenida !== null) return detenida.codigo;
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
    if (this.detenida() !== null) return [];
    return this.motor.accionesLegales(this.estado, id);
  }

  motivosDe(id: JugadorId): MotivoAccion[] {
    const detenida = this.detenida();
    if (detenida !== null) {
      return accionesDeInterfaz(this.motor, this.estado, id).map((accion) => ({
        accion,
        codigo: detenida.codigo,
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
    if (this.detenida() !== null) return [];
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

  /** Pausa de resultado en curso, o null. */
  get pausaResultado(): PausaResultado | null {
    return this.pausaActual?.pausa ?? null;
  }

  /** Milisegundos que quedan de la pausa de resultado (null si no hay). */
  restantePausaResultadoMs(): number | null {
    if (this.pausaActual === null) return null;
    return Math.max(0, this.pausaActual.fin - this.reloj.ahora());
  }

  /** Activación de un Líder que se está presentando, o null. */
  get presentacionLider(): PresentacionLider | null {
    return this.presentacionActual?.presentacion ?? null;
  }

  /** Milisegundos que quedan de la presentación del Líder (null si no hay). */
  restantePresentacionLiderMs(): number | null {
    if (this.presentacionActual === null) return null;
    return Math.max(0, this.presentacionActual.fin - this.reloj.ahora());
  }

  /**
   * Si la partida está detenida (presentación de un Líder, celebración o pausa de resultado; nunca
   * dos a la vez), el código con el que se rechazan las acciones y el instante en que se reanuda;
   * si no, null.
   */
  private detenida(): { codigo: CodigoError; fin: number } | null {
    if (this.presentacionActual !== null) {
      return { codigo: 'PRESENTACION_LIDER', fin: this.presentacionActual.fin };
    }
    if (this.celebracionActual !== null) {
      return { codigo: 'CELEBRACION', fin: this.celebracionActual.fin };
    }
    if (this.pausaActual !== null) return { codigo: 'PAUSA_RESULTADO', fin: this.pausaActual.fin };
    return null;
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
    const detenida = this.detenida();
    if (detenida !== null && actor !== SISTEMA) return detenida.codigo;
    const r = this.motor.reducer(this.estado, { actor, accion });
    if (!r.ok) return r.error.codigo;
    this.estado = r.state;
    this.eventos.push(...r.events);
    this.actualizar();
    return null;
  }

  /** Modo local: el jugador `id` quiere responder en la ventana abierta. */
  responder(id: JugadorId): void {
    // Con la partida detenida nada avanza (respondedoresPosibles ya es []; se deja explícito).
    if (this.detenida() !== null) return;
    if (!this.respondedoresPosibles().includes(id)) return;
    this.respondiendo = id;
    this.pausarPlazo();
    if (id !== this.alMando) this.traspaso = id;
    this.notificar();
  }

  /** Modo local: el jugador que respondía ha terminado; se devuelve el dispositivo. */
  terminarRespuesta(): void {
    // Con la partida detenida no hace nada: el jugador sigue respondiendo y terminará después.
    if (this.respondiendo === null || this.detenida() !== null) return;
    this.respondiendo = null;
    this.reanudarPlazo();
    const siguiente = this.actorRequerido() ?? this.estado.turno.jugador;
    if (siguiente !== this.alMando && this.humanos.includes(siguiente)) this.traspaso = siguiente;
    this.programarBots();
    this.notificar();
  }

  /** Modo local: el jugador que recibe el dispositivo confirma que es él. */
  confirmarTraspaso(): void {
    // Con la partida detenida el traspaso está diferido; no se puede confirmar todavía.
    if (this.traspaso === null || this.detenida() !== null) return;
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
    if (this.temporizadorPausa !== null) this.reloj.cancelar(this.temporizadorPausa);
    this.temporizadorPausa = null;
    if (this.temporizadorPresentacion !== null) this.reloj.cancelar(this.temporizadorPresentacion);
    this.temporizadorPresentacion = null;
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
    const nuevos = this.eventos.slice(this.eventosVistos);
    this.eventosVistos = this.eventos.length;
    const hayResultado = this.detectarResultados(nuevos);
    this.detectarPresentaciones(nuevos);
    this.detectarCelebraciones(nuevos);
    // La celebración manda: si está en curso (o en espera), no hay pausa de resultado. Con la
    // partida ganada tampoco: no queda nada que detener (la interfaz pasa a la victoria). Si hay una
    // presentación de Líder, la pausa espera a que termine (y entonces dura lo configurado entero).
    const pausa = this.opciones.pausaResultadoMs ?? PAUSA_RESULTADO_POR_DEFECTO_MS;
    if (
      hayResultado &&
      pausa > 0 &&
      this.celebracionActual === null &&
      this.colaCelebraciones.length === 0 &&
      this.estado.ganador === null &&
      !this.terminado
    ) {
      if (this.presentacionActual !== null || this.colaPresentaciones.length > 0) {
        this.pausaPendiente = true;
      } else {
        this.empezarPausa(pausa);
      }
    }
    if (this.presentacionActual === null && this.celebracionActual === null) {
      this.siguienteDetencion();
    }
    if (this.estado.ganador !== null) {
      // La celebración del Monstruo que da la victoria sigue su curso; la victoria va después.
      // Una pausa de resultado o una presentación de Líder se cancelan: al acabar la partida no
      // queda más temporizador que el de la celebración.
      this.cancelar();
      if (this.temporizadorPausa !== null) this.reloj.cancelar(this.temporizadorPausa);
      this.temporizadorPausa = null;
      this.pausaActual = null;
      this.pausaPendiente = false;
      if (this.temporizadorPresentacion !== null) {
        this.reloj.cancelar(this.temporizadorPresentacion);
      }
      this.temporizadorPresentacion = null;
      this.presentacionActual = null;
      this.colaPresentaciones.length = 0;
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
      if (this.detenida() !== null) this.restantePlazoCongelado = cima.duracionMs;
      else if (this.respondiendo === null) this.reanudarPlazo();
    }

    const traspaso = this.traspasoNecesario();
    if (traspaso !== null) {
      // La celebración o la pausa van primero: todos las ven en la misma pantalla y luego se pasa.
      if (this.detenida() !== null) this.traspasoDiferido = traspaso;
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

  /**
   * Busca en los eventos nuevos los que la interfaz convierte en una escena de resultado (los mismos
   * que `Escenario.tsx` en la web). Devuelve si hay alguno (entonces la partida hace una pausa).
   */
  private detectarResultados(nuevos: readonly Evento[]): boolean {
    let hayResultado = false;
    for (const e of nuevos) {
      switch (e.tipo) {
        case 'cartaJugada':
          this.jugadaEnCurso = { jugador: e.jugador, carta: e.carta };
          break;
        case 'desafioResuelto':
        case 'tiradaHeroe':
        case 'ataqueResuelto':
          hayResultado = true;
          break;
        case 'cartaAnulada':
          this.jugadaEnCurso = null;
          hayResultado = true;
          break;
        case 'heroeEntra':
        case 'objetoEquipado':
        case 'magiaResuelta': {
          // Solo cuando cierra la jugada en curso (no si un efecto mete un Héroe en el Grupo).
          const j = this.jugadaEnCurso;
          if (j !== null && j.jugador === e.jugador && j.carta === e.carta) {
            this.jugadaEnCurso = null;
            hayResultado = true;
          }
          break;
        }
        default:
          break;
      }
    }
    return hayResultado;
  }

  /**
   * Encola la presentación de cada Líder que se activa por primera vez en el turno. Las siguientes
   * activaciones del mismo Líder en ese turno no detienen la partida (la interfaz las ve por el
   * evento). Con la partida ganada no se presenta nada: la victoria pasa por delante. Con
   * `encolar` a false solo se anotan como vistas (historial de una partida cargada).
   */
  private detectarPresentaciones(nuevos: readonly Evento[], encolar = true): void {
    const duracionMs = this.opciones.presentacionLiderMs ?? PRESENTACION_LIDER_POR_DEFECTO_MS;
    for (const e of nuevos) {
      if (e.tipo === 'turnoIniciado' && e.numero !== this.turnoPresentados) {
        this.turnoPresentados = e.numero;
        this.lideresPresentados.clear();
      }
      if (e.tipo !== 'liderActivado') continue;
      const clave = `${e.jugador}:${e.carta}`;
      if (this.lideresPresentados.has(clave)) continue;
      this.lideresPresentados.add(clave);
      if (!encolar || duracionMs <= 0 || this.terminado || this.estado.ganador !== null) continue;
      this.ultimaPresentacion += 1;
      this.colaPresentaciones.push({
        id: this.ultimaPresentacion,
        jugador: e.jugador,
        carta: e.carta,
        duracionMs,
      });
    }
  }

  /** Encola una celebración por cada Monstruo matado en los eventos nuevos. */
  private detectarCelebraciones(nuevos: readonly Evento[]): void {
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
  }

  /**
   * Sin presentación ni celebración en curso, empieza la siguiente detención en espera, en el orden
   * de sus eventos: las presentaciones de Líder (el bono va antes que el resultado de la tirada y que
   * el Monstruo matado), luego las celebraciones y por último la pausa de resultado aplazada.
   * Devuelve si ha empezado alguna.
   */
  private siguienteDetencion(): boolean {
    if (this.terminado) return false;
    if (this.colaPresentaciones.length > 0) {
      this.empezarPresentacion();
      return true;
    }
    if (this.colaCelebraciones.length > 0) {
      this.empezarCelebracion();
      return true;
    }
    if (this.pausaPendiente) {
      this.pausaPendiente = false;
      const pausa = this.opciones.pausaResultadoMs ?? PAUSA_RESULTADO_POR_DEFECTO_MS;
      if (pausa > 0 && this.estado.ganador === null) {
        this.empezarPausa(pausa);
        return true;
      }
    }
    return false;
  }

  /** Empieza la siguiente presentación de la cola: congela la ventana, la decisión y los bots. */
  private empezarPresentacion(): void {
    const presentacion = this.colaPresentaciones.shift();
    if (presentacion === undefined) return;
    const fin = this.reloj.ahora() + presentacion.duracionMs;
    // Una pausa de resultado en curso se aplaza entera hasta después de la presentación.
    if (this.pausaActual !== null) {
      if (this.temporizadorPausa !== null) this.reloj.cancelar(this.temporizadorPausa);
      this.temporizadorPausa = null;
      this.pausaActual = null;
      this.pausaPendiente = true;
    }
    this.presentacionActual = { presentacion, fin };
    this.temporizadorPresentacion = this.reloj.programar(
      () => this.terminarPresentacion(),
      presentacion.duracionMs,
    );
    this.detener(fin);
  }

  /** Fin de una presentación: la siguiente detención en espera o, si no hay, se reanuda. */
  private terminarPresentacion(): void {
    this.temporizadorPresentacion = null;
    this.presentacionActual = null;
    if (this.terminado) return;
    if (!this.siguienteDetencion()) this.reanudar();
    this.notificar();
  }

  /** Empieza la siguiente celebración de la cola: congela la ventana, la decisión y los bots. */
  private empezarCelebracion(): void {
    const celebracion = this.colaCelebraciones.shift();
    if (celebracion === undefined) return;
    const fin = this.reloj.ahora() + celebracion.duracionMs;
    // La celebración tapa el resultado (la interfaz lo descarta) y ya detiene la partida: sustituye
    // a la pausa de resultado en curso o aplazada, si la hay (lo congelado pasa a la celebración).
    if (this.temporizadorPausa !== null) this.reloj.cancelar(this.temporizadorPausa);
    this.temporizadorPausa = null;
    this.pausaActual = null;
    this.pausaPendiente = false;
    this.celebracionActual = { celebracion, fin };
    this.temporizadorCelebracion = this.reloj.programar(
      () => this.terminarCelebracion(),
      celebracion.duracionMs,
    );
    this.detener(fin);
  }

  /**
   * Detiene la partida hasta `fin` (presentación, celebración o pausa): congela la cuenta de la
   * ventana y el límite por decisión, difiere el traspaso y para a los bots. Si ya estaba detenida
   * (cola de celebraciones, pausa alargada), lo congelado se conserva y solo se mueve el fin.
   */
  private detener(fin: number): void {
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
    if (!this.siguienteDetencion()) this.reanudar();
    this.notificar();
  }

  /** Empieza la pausa de resultado o, si ya hay una, la alarga desde ahora con el mismo id. */
  private empezarPausa(duracionMs: number): void {
    if (this.temporizadorPausa !== null) this.reloj.cancelar(this.temporizadorPausa);
    if (this.pausaActual === null) this.ultimaPausa += 1;
    const fin = this.reloj.ahora() + duracionMs;
    this.pausaActual = { pausa: { id: this.ultimaPausa, duracionMs }, fin };
    this.temporizadorPausa = this.reloj.programar(() => this.terminarPausa(), duracionMs);
    this.detener(fin);
  }

  private terminarPausa(): void {
    this.temporizadorPausa = null;
    this.pausaActual = null;
    if (this.terminado) return;
    this.reanudar();
    this.notificar();
  }

  /** Reanuda la partida detenida: la ventana y la decisión con lo que les quedaba, y el traspaso. */
  private reanudar(): void {
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
  }

  /** Pone en marcha la cuenta de la ventana: completa o, tras una detención, lo que quedaba. */
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

  /** Plazo de `ms` para que decida `requerido`; con la partida detenida queda congelado. */
  private programarDecision(requerido: JugadorId, ms: number): void {
    const detenida = this.detenida();
    if (detenida !== null) {
      this.restanteDecisionCongelado = ms;
      this.plazoDecision = { jugador: requerido, fin: detenida.fin + ms };
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
    if (this.detenida() !== null) return;
    if (this.respondiendo !== null || !this.hayTrabajoParaBots()) return;
    this.temporizadorBot = this.reloj.programar(() => {
      this.temporizadorBot = null;
      this.turnoDeBots();
    }, this.opciones.retardoBotMs ?? RETARDO_BOT_POR_DEFECTO_MS);
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
    if (this.estado.ganador !== null || this.terminado || this.detenida() !== null) return;
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
