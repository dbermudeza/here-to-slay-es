import type { Carta } from '@hts/cards';
import type { EstadoRng } from './rng';

export type JugadorId = string;
/** Identificador de una copia física concreta de una carta, p. ej. `desafio#7`. */
export type Uid = string;
export type Modo = 'normal' | 'dificil';

/** Actor reservado para acciones que envía el host (servidor o cliente local), no un jugador. */
export const SISTEMA = '@sistema';
export type Actor = JugadorId | typeof SISTEMA;

export interface OpcionesPartida {
  /** Reglas de victoria (R-090..R-093). */
  modo: Modo;
  /** Tiempo para declarar un desafío tras intentar jugar una carta (lo gestiona el host). */
  duracionVentanaDesafioMs: number;
  /** Ventana de modificadores tras una tirada normal (R-067). */
  duracionVentanaModificadoresMs: number;
  /** Ventana de modificadores tras las dos tiradas de un desafío (R-067). */
  duracionVentanaModificadoresDesafioMs: number;
}

export const OPCIONES_POR_DEFECTO: OpcionesPartida = {
  modo: 'normal',
  duracionVentanaDesafioMs: 10_000,
  duracionVentanaModificadoresMs: 5_000,
  duracionVentanaModificadoresDesafioMs: 10_000,
};

/** Un Héroe del Grupo con su Objeto equipado (máximo uno, R-043). */
export interface Ranura {
  heroe: Uid;
  objeto: Uid | null;
}

export interface Jugador {
  id: JugadorId;
  nombre: string;
  lider: Uid;
  mano: Uid[];
  grupo: Ranura[];
  /** Monstruos matados (R-088). */
  monstruos: Uid[];
}

export interface Turno {
  jugador: JugadorId;
  numero: number;
  pa: number;
  /** Héroes que ya han tirado para usar su efecto este turno (R-034, D-05). */
  heroesUsados: Uid[];
}

/** Carta que un jugador intenta jugar y que está pendiente de la ventana de desafío. */
export type Jugada =
  | { tipo: 'heroe'; jugador: JugadorId; uid: Uid }
  | { tipo: 'objeto'; jugador: JugadorId; uid: Uid; objetivo: Uid }
  | { tipo: 'magia'; jugador: JugadorId; uid: Uid };

export interface Modificacion {
  jugador: JugadorId;
  uid: Uid;
  valor: number;
}

export interface Tirada {
  jugador: JugadorId;
  dados: [number, number];
  modificaciones: Modificacion[];
}

export type ContextoTirada =
  | { tipo: 'heroe'; heroe: Uid }
  | { tipo: 'ataque'; monstruo: Uid }
  /** tiradas[0] = desafiado (dueño de la jugada), tiradas[1] = desafiante. */
  | { tipo: 'desafio'; jugada: Jugada; desafiante: JugadorId };

export type AccionElegir = 'sacrificar' | 'descartar';

/** Elemento de la pila de decisiones pendientes. Solo actúa quien indica el elemento superior. */
export type Pendiente =
  | {
      tipo: 'ventanaDesafio';
      secuencia: number;
      duracionMs: number;
      jugada: Jugada;
      pasaron: JugadorId[];
    }
  | {
      tipo: 'ventanaModificadores';
      secuencia: number;
      duracionMs: number;
      tiradas: Tirada[];
      contexto: ContextoTirada;
    }
  | { tipo: 'tiradaInmediata'; jugador: JugadorId; heroe: Uid }
  | { tipo: 'elegir'; jugador: JugadorId; accion: AccionElegir; cantidad: number };

export type MotivoVictoria =
  'tresMonstruos' | 'grupoCompleto' | 'grupoCompletoYMonstruo' | 'cuatroMonstruosTresClases';

export interface GameState {
  version: 1;
  opciones: OpcionesPartida;
  rng: EstadoRng;
  /** Contador para identificar ventanas; cambia cada vez que una ventana se abre o se reinicia. */
  secuencia: number;
  /** Mapa uid → id de carta del catálogo, para todas las cartas en juego. */
  instancias: Record<Uid, string>;
  /** En orden de turno (sentido horario). */
  jugadores: Jugador[];
  /** Mazo principal; la carta superior es la de índice 0. */
  mazo: Uid[];
  /** Pila de descarte; la carta superior es la última. Pública. */
  descarte: Uid[];
  mazoMonstruos: Uid[];
  monstruosCentro: Uid[];
  turno: Turno;
  /** Pila de decisiones pendientes; la cima es el último elemento. */
  pila: Pendiente[];
  ganador: { jugador: JugadorId; motivo: MotivoVictoria } | null;
  /**
   * Solo para tests: valores de dado (1–6) que se consumen antes de usar el RNG.
   * Nunca se envía a los clientes.
   */
  dadosForzados: number[];
}

export type Accion =
  | { tipo: 'ROBAR' }
  | { tipo: 'JUGAR_CARTA'; uid: Uid; objetivo?: Uid }
  | { tipo: 'TIRAR_HEROE'; uid: Uid }
  | { tipo: 'ATACAR'; uid: Uid }
  | { tipo: 'RENOVAR_MANO' }
  | { tipo: 'FIN_TURNO' }
  | { tipo: 'DESAFIAR'; uid: Uid }
  | { tipo: 'PASAR' }
  | { tipo: 'JUGAR_MODIFICADOR'; uid: Uid; valor: number; tirada: number }
  | { tipo: 'TIRADA_INMEDIATA'; tirar: boolean }
  | { tipo: 'ELEGIR'; uids: Uid[] }
  | { tipo: 'CERRAR_VENTANA'; secuencia: number };

export interface Envio {
  actor: Actor;
  accion: Accion;
}

export type ResultadoAtaque = 'exito' | 'fracaso' | 'nada';

export type Evento =
  | { tipo: 'partidaCreada'; modo: Modo; jugadores: JugadorId[] }
  | { tipo: 'liderAsignado'; jugador: JugadorId; carta: string }
  | { tipo: 'turnoIniciado'; jugador: JugadorId; numero: number }
  | { tipo: 'turnoTerminado'; jugador: JugadorId }
  /** `uid`/`carta` son null en la versión que reciben los demás jugadores. */
  | { tipo: 'cartaRobada'; jugador: JugadorId; uid: Uid | null; carta: string | null }
  | { tipo: 'mazoRebarajado'; cartas: number }
  | { tipo: 'mazoAgotado' }
  | { tipo: 'manoRenovada'; jugador: JugadorId }
  | { tipo: 'cartasDescartadas'; jugador: JugadorId; cartas: string[] }
  | { tipo: 'cartaJugada'; jugador: JugadorId; uid: Uid; carta: string; objetivo: Uid | null }
  | { tipo: 'ventanaDesafioAbierta'; secuencia: number; duracionMs: number }
  | { tipo: 'pasa'; jugador: JugadorId }
  | { tipo: 'desafio'; desafiante: JugadorId; desafiado: JugadorId; carta: string }
  | { tipo: 'dadosTirados'; jugador: JugadorId; dados: [number, number] }
  | { tipo: 'ventanaModificadoresAbierta'; secuencia: number; duracionMs: number }
  | {
      tipo: 'modificadorJugado';
      jugador: JugadorId;
      carta: string;
      valor: number;
      /** Jugador cuya tirada se modifica. */
      sobre: JugadorId;
    }
  | { tipo: 'ventanaReiniciada'; secuencia: number; duracionMs: number }
  | { tipo: 'ventanaCerrada'; secuencia: number }
  | {
      tipo: 'desafioResuelto';
      ganador: 'desafiante' | 'desafiado';
      totalDesafiante: number;
      totalDesafiado: number;
    }
  | { tipo: 'cartaAnulada'; jugador: JugadorId; carta: string }
  | { tipo: 'heroeEntra'; jugador: JugadorId; carta: string }
  | { tipo: 'objetoEquipado'; jugador: JugadorId; carta: string; heroe: string; dueno: JugadorId }
  | { tipo: 'magiaResuelta'; jugador: JugadorId; carta: string }
  | { tipo: 'tiradaHeroe'; jugador: JugadorId; heroe: string; total: number; exito: boolean }
  | { tipo: 'efectoActivado'; jugador: JugadorId; carta: string }
  | { tipo: 'ataque'; jugador: JugadorId; monstruo: string }
  | {
      tipo: 'ataqueResuelto';
      jugador: JugadorId;
      monstruo: string;
      total: number;
      resultado: ResultadoAtaque;
    }
  | { tipo: 'monstruoMatado'; jugador: JugadorId; carta: string }
  | { tipo: 'monstruoRevelado'; carta: string }
  | { tipo: 'decisionPendiente'; jugador: JugadorId; accion: AccionElegir; cantidad: number }
  | { tipo: 'heroeSacrificado'; jugador: JugadorId; carta: string; objeto: string | null }
  | { tipo: 'victoria'; jugador: JugadorId; motivo: MotivoVictoria };

export type CodigoError =
  | 'PARTIDA_TERMINADA'
  | 'JUGADOR_DESCONOCIDO'
  | 'SOLO_SISTEMA'
  | 'NO_ES_TU_TURNO'
  | 'HAY_DECISION_PENDIENTE'
  | 'NO_ES_MOMENTO'
  | 'PA_INSUFICIENTES'
  | 'CARTA_NO_EN_MANO'
  | 'TIPO_DE_CARTA_INVALIDO'
  | 'OBJETIVO_INVALIDO'
  | 'HEROE_NO_EN_GRUPO'
  | 'HEROE_YA_USADO'
  | 'MONSTRUO_NO_DISPONIBLE'
  | 'REQUISITOS_NO_CUMPLIDOS'
  | 'NO_PUEDES_DESAFIARTE'
  | 'YA_PASASTE'
  | 'VALOR_INVALIDO'
  | 'TIRADA_INVALIDA'
  | 'SELECCION_INVALIDA'
  | 'SECUENCIA_OBSOLETA';

export interface ErrorMotor {
  codigo: CodigoError;
}

export type Resultado =
  { ok: true; state: GameState; events: Evento[] } | { ok: false; error: ErrorMotor };

export type Catalogo = ReadonlyMap<string, Carta>;
