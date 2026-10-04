import type {
  EstadoConexion,
  JugadorConfig,
  ModoJuego,
  Plazo,
  PlazoDecision,
} from '@hts/anfitrion';
import type { Accion, CodigoError, Evento, JugadorId, VistaJugador } from '@hts/engine';

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

  // Solo en modo "este dispositivo" (en línea no hacen nada).
  readonly traspaso: JugadorId | null;
  readonly respondiendo: JugadorId | null;
  respondedoresPosibles(): JugadorId[];
  responder(id: JugadorId): void;
  terminarRespuesta(): void;
  confirmarTraspaso(): void;
}
