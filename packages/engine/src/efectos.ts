import type { Catalogo, Evento, GameState, JugadorId, Uid } from './tipos';

/**
 * Punto de enganche para los efectos de carta (Fase 2). El motor llama al resolutor
 * registrado para el id de carta cuando:
 * - un Héroe supera su tirada (R-031);
 * - una carta de Magia se resuelve (R-051).
 *
 * El resolutor recibe un borrador del estado que puede modificar y apilar decisiones.
 */
export interface ContextoEfecto {
  catalogo: Catalogo;
  /** Borrador mutable del estado. */
  estado: GameState;
  jugador: JugadorId;
  uid: Uid;
  emitir: (evento: Evento) => void;
}

export type ResolverEfecto = (contexto: ContextoEfecto) => void;

/** Resolutores indexados por id de carta del catálogo. */
export type RegistroEfectos = Readonly<Record<string, ResolverEfecto>>;

export interface Ctx {
  catalogo: Catalogo;
  efectos: RegistroEfectos;
}
