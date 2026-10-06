import { CELEBRACION_POR_DEFECTO_MS } from '@hts/anfitrion';
import type {
  Celebracion,
  EstadoConexion,
  JugadorConfig,
  ModoJuego,
  PausaResultado,
  Plazo,
  PlazoDecision,
  PresentacionLider,
} from '@hts/anfitrion';
import type { Accion, CodigoError, Evento, JugadorId, VistaJugador } from '@hts/engine';

export type { PausaResultado, PresentacionLider };

/**
 * Lo que necesita la mesa para funcionar. Lo cumplen el director local (Anfitrion) y el cliente en
 * línea (que recibe lo mismo del servidor, ya filtrado para el jugador).
 */
export interface FuenteMesa {
  readonly version: number;
  suscribir(fn: () => void): () => void;
  readonly config: { readonly modo: ModoJuego; readonly jugadores: readonly JugadorConfig[] };
  /** Jugador cuya vista se muestra. */
  readonly observador: JugadorId;
  /** Eventos que puede conocer quien mira (para el historial y las animaciones). */
  readonly eventos: readonly Evento[];
  readonly plazo: Plazo | null;
  readonly plazoDecision: PlazoDecision | null;
  /** Monstruo derrotado que se está celebrando (nadie puede jugar mientras dure), o null. */
  readonly celebracion: Celebracion | null;
  /** Pausa tras un resultado (nadie actúa y las cuentas atrás se congelan), o null. */
  readonly pausaResultado: PausaResultado | null;
  /**
   * Presentación de la habilidad de un Líder (nadie puede jugar mientras dure, las cuentas atrás se
   * congelan), o null. Sale en cada activación del Líder.
   */
  readonly presentacionLider: PresentacionLider | null;
  vista(): VistaJugador;
  legales(): Accion[];
  /** null si la acción es legal; si no, el motivo. */
  motivo(accion: Accion): CodigoError | null;
  /** Envía una acción como el jugador que mira. */
  actuar(accion: Accion): unknown;
  actorRequerido(): JugadorId | null;
  esBot(id: JugadorId): boolean;
  conexion(id: JugadorId): EstadoConexion;
  restanteMs(): number | null;
  restanteDecisionMs(): number | null;
  /** Milisegundos que quedan de la celebración; null si no hay. */
  restanteCelebracionMs(): number | null;
  /** Milisegundos que quedan de la pausa tras un resultado; null si no hay. */
  restantePausaResultadoMs(): number | null;
  /** Milisegundos que quedan de la presentación del Líder; null si no hay. */
  restantePresentacionLiderMs(): number | null;

  // Solo en modo "este dispositivo" (en línea no hacen nada).
  readonly traspaso: JugadorId | null;
  readonly respondiendo: JugadorId | null;
  respondedoresPosibles(): JugadorId[];
  responder(id: JugadorId): void;
  terminarRespuesta(): void;
  confirmarTraspaso(): void;
}

/** Duración nominal de la celebración de un Monstruo derrotado (la de la animación completa). */
export const CELEBRACION_MS = CELEBRACION_POR_DEFECTO_MS;
