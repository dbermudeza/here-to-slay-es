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
  /** Jugadores controlados por bots: no cuentan para la victoria por rendición (D-43). */
  bots: JugadorId[];
}

export const OPCIONES_POR_DEFECTO: OpcionesPartida = {
  modo: 'normal',
  duracionVentanaDesafioMs: 10_000,
  duracionVentanaModificadoresMs: 5_000,
  duracionVentanaModificadoresDesafioMs: 10_000,
  bots: [],
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
  /**
   * PA con que empezó el turno, contando los extra (Megababosa, D-36). Solo informativo: la
   * interfaz muestra `paInicial - PA_POR_TURNO` puntos extra aunque ya se hayan gastado.
   */
  paInicial: number;
  /** Héroes que ya han tirado para usar su efecto este turno (R-034, D-05). */
  heroesUsados: Uid[];
  /** Habilidades "una vez por turno" ya usadas (cartas con la habilidad). */
  habilidadesUsadas: Uid[];
}

/** Carta que un jugador intenta jugar y que está pendiente de la ventana de desafío. */
export type Jugada =
  | { tipo: 'heroe'; jugador: JugadorId; uid: Uid }
  | { tipo: 'objeto'; jugador: JugadorId; uid: Uid; objetivo: Uid }
  | { tipo: 'magia'; jugador: JugadorId; uid: Uid };

export interface Modificacion {
  jugador: JugadorId;
  /** Carta de Modificador jugada, o null si el cambio viene de una habilidad. */
  uid: Uid | null;
  /** Id de catálogo de la carta que causa el cambio. */
  carta: string;
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

/** Valor de una variable de un efecto en curso. */
export type Valor = string | string[] | number | boolean | null;

/** Pregunta que un efecto hace a un jugador. */
export type Pregunta =
  | { tipo: 'jugador'; opciones: JugadorId[] }
  /** Elegir entre `min` y `max` cartas. Si `ordenado`, el orden de la respuesta importa. */
  | { tipo: 'cartas'; opciones: Uid[]; min: number; max: number; ordenado: boolean }
  /** Elegir a ciegas una carta (por su posición) de la mano de `de` (R-097). */
  | { tipo: 'oculta'; de: JugadorId; cartas: number }
  | { tipo: 'confirmar' }
  | { tipo: 'valor'; opciones: number[] }
  /** Ver unas cartas (de la mano de `de` o del mazo) y confirmar. */
  | { tipo: 'ver'; cartas: Uid[]; de: JugadorId | null };

export type Respuesta =
  | { jugador: JugadorId }
  | { cartas: Uid[] }
  | { indice: number }
  | { si: boolean }
  | { valor: number }
  | { ok: true };

/** Clave del motivo de una pregunta, para la UI (i18n). */
export type MotivoPregunta =
  | 'elegirJugador'
  | 'descartar'
  | 'sacrificar'
  | 'dar'
  | 'sacar'
  | 'verMano'
  | 'tomarDeMano'
  | 'recuperarDescarte'
  | 'destruir'
  | 'arrebatarEnLugarDeDestruir'
  | 'arrebatar'
  | 'darHeroe'
  | 'jugarInmediato'
  | 'objetivoObjeto'
  | 'confirmar'
  | 'robar'
  | 'devolverObjeto'
  | 'elegirDelMazo'
  | 'ordenarMazo'
  | 'bonoCuerno';

/** Efecto en ejecución (programa de una carta o de una pasiva). */
export interface MarcoEfecto {
  tipo: 'efecto';
  id: number;
  /** Jugador que controla el efecto ("tú" en el texto de la carta). */
  jugador: JugadorId;
  /** Instancia de la carta que origina el efecto. */
  fuente: Uid;
  /** Id de catálogo de la carta cuya definición se ejecuta. */
  carta: string;
  /** Índice de la pasiva (disparador o habilidad) que se ejecuta, o null para el programa principal. */
  pasiva: number | null;
  /** Paso actual del programa. */
  pc: number;
  /** Fase interna del paso actual (para pasos que preguntan varias veces). */
  sub: number;
  /** Contador de iteraciones del paso actual. */
  i: number;
  /** Cola de trabajo del paso actual (jugadores o cartas pendientes). */
  cola: string[];
  /** Respuesta a la última pregunta, pendiente de consumir. */
  respuesta: Valor;
  vars: Record<string, Valor>;
}

export interface Decision {
  tipo: 'decision';
  jugador: JugadorId;
  /** Marco de efecto que espera la respuesta. */
  efecto: number;
  /** Carta cuyo efecto pregunta. */
  carta: string;
  motivo: MotivoPregunta;
  pregunta: Pregunta;
}

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
  | { tipo: 'elegir'; jugador: JugadorId; accion: AccionElegir; cantidad: number }
  | MarcoEfecto
  | Decision;

export type TipoTemporal = 'bonoTirada' | 'noDestruible' | 'noArrebatable' | 'noDesafiable';

/** Efecto con duración (Wise Shield, Mighty Blade…). */
export interface Temporal {
  jugador: JugadorId;
  tipo: TipoTemporal;
  valor: number;
  /** finTurno: al terminar el turno de `jugador`; inicioTurnoPropio: al empezar su próximo turno. */
  expira: 'finTurno' | 'inicioTurnoPropio';
  carta: string;
}

export type MotivoVictoria =
  | 'tresMonstruos'
  | 'grupoCompleto'
  | 'grupoCompletoYMonstruo'
  | 'cuatroMonstruosTresClases'
  /** D-43: todos los demás jugadores humanos se han rendido. */
  | 'rendicion';

export interface GameState {
  version: 1;
  opciones: OpcionesPartida;
  rng: EstadoRng;
  /** Contador para identificar ventanas; cambia cada vez que una ventana se abre o se reinicia. */
  secuencia: number;
  /** Contador de ids de marcos de efecto. */
  siguienteEfecto: number;
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
  /** Efectos con duración activos. */
  temporales: Temporal[];
  ganador: { jugador: JugadorId; motivo: MotivoVictoria } | null;
  /** Jugadores que se han rendido (D-43): ya no juegan, no responden ni pueden ganar. */
  rendidos: JugadorId[];
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
  /** Usar la habilidad de una carta propia (La Garra Sombría). */
  | { tipo: 'USAR_HABILIDAD'; uid: Uid }
  | { tipo: 'DESAFIAR'; uid: Uid }
  | { tipo: 'PASAR' }
  | { tipo: 'JUGAR_MODIFICADOR'; uid: Uid; valor: number; tirada: number }
  | { tipo: 'TIRADA_INMEDIATA'; tirar: boolean }
  | { tipo: 'ELEGIR'; uids: Uid[] }
  | { tipo: 'RESPONDER'; respuesta: Respuesta }
  /** Rendirse (D-43): se puede en cualquier momento. */
  | { tipo: 'RENDIRSE' }
  | { tipo: 'CERRAR_VENTANA'; secuencia: number };

export interface Envio {
  actor: Actor;
  accion: Accion;
}

export type ResultadoAtaque = 'exito' | 'fracaso' | 'nada';

export interface Bono {
  carta: string;
  valor: number;
}

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
  | { tipo: 'jugadaIndesafiable'; jugador: JugadorId; carta: string }
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
  /** Resultado final de una tirada, con el desglose de modificadores y bonos. */
  | {
      tipo: 'tiradaFinal';
      jugador: JugadorId;
      dados: [number, number];
      modificadores: number;
      bonos: Bono[];
      total: number;
    }
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
  | { tipo: 'heroeSellado'; jugador: JugadorId; heroe: string }
  | { tipo: 'efectoActivado'; jugador: JugadorId; carta: string }
  | { tipo: 'disparadorActivado'; jugador: JugadorId; carta: string }
  | { tipo: 'habilidadUsada'; jugador: JugadorId; carta: string }
  | { tipo: 'esperandoDecision'; jugador: JugadorId; carta: string; motivo: MotivoPregunta }
  | { tipo: 'sinObjetivos'; jugador: JugadorId; carta: string }
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
  | {
      tipo: 'heroeDestruido';
      jugador: JugadorId;
      dueno: JugadorId;
      carta: string;
      objeto: string | null;
      objetoAMano: boolean;
    }
  | { tipo: 'senueloUsado'; dueno: JugadorId; heroe: string; objeto: string }
  | {
      tipo: 'heroeArrebatado';
      jugador: JugadorId;
      de: JugadorId;
      carta: string;
      objeto: string | null;
    }
  | { tipo: 'heroeMovido'; de: JugadorId; a: JugadorId; carta: string }
  /** SACAR de la mano ajena. `uid`/`carta` solo los ven los dos implicados. */
  | {
      tipo: 'cartaSacada';
      jugador: JugadorId;
      de: JugadorId;
      uid: Uid | null;
      carta: string | null;
    }
  /** DAR una carta de la mano. `uid`/`carta` solo los ven los dos implicados. */
  | { tipo: 'cartaDada'; jugador: JugadorId; a: JugadorId; uid: Uid | null; carta: string | null }
  | { tipo: 'manoVista'; jugador: JugadorId; de: JugadorId }
  | { tipo: 'manosIntercambiadas'; jugador: JugadorId; con: JugadorId }
  | { tipo: 'cartaRecuperada'; jugador: JugadorId; carta: string }
  | { tipo: 'cartaRevelada'; jugador: JugadorId; carta: string }
  | { tipo: 'mazoMirado'; jugador: JugadorId; cartas: number }
  | { tipo: 'mazoReordenado'; jugador: JugadorId; cartas: number }
  | { tipo: 'objetoDevuelto'; dueno: JugadorId; carta: string; heroe: string }
  | {
      tipo: 'temporalActivado';
      jugador: JugadorId;
      efecto: TipoTemporal;
      valor: number;
      carta: string;
    }
  | { tipo: 'temporalTerminado'; jugador: JugadorId; efecto: TipoTemporal; carta: string }
  | { tipo: 'victoria'; jugador: JugadorId; motivo: MotivoVictoria }
  | { tipo: 'jugadorRendido'; jugador: JugadorId }
  /** Las cartas de la mano y del Grupo de quien se ha rendido van al descarte (D-43). */
  | { tipo: 'cartasRetiradas'; jugador: JugadorId; cartas: string[] };

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
  | 'HEROE_SELLADO'
  | 'HABILIDAD_NO_DISPONIBLE'
  | 'MONSTRUO_NO_DISPONIBLE'
  | 'REQUISITOS_NO_CUMPLIDOS'
  | 'NO_PUEDES_DESAFIARTE'
  | 'YA_PASASTE'
  | 'VALOR_INVALIDO'
  | 'TIRADA_INVALIDA'
  | 'SELECCION_INVALIDA'
  | 'RESPUESTA_INVALIDA'
  | 'SECUENCIA_OBSOLETA'
  | 'JUGADOR_RENDIDO'
  /** Lo usa solo el anfitrión: se está celebrando un Monstruo derrotado y nadie puede jugar. */
  | 'CELEBRACION';

export interface ErrorMotor {
  codigo: CodigoError;
}

export type Resultado =
  { ok: true; state: GameState; events: Evento[] } | { ok: false; error: ErrorMotor };

export type Catalogo = ReadonlyMap<string, Carta>;

export type Emitir = (evento: Evento) => void;
