import type { Accion, Catalogo, VistaJugador } from '@hts/engine';

/**
 * Lo que recibe un bot para decidir: exactamente lo mismo que tendría un jugador humano
 * (su vista filtrada y sus acciones legales), nunca el estado completo.
 */
export interface EntradaBot {
  vista: VistaJugador;
  legales: readonly Accion[];
  catalogo: Catalogo;
  /** Número aleatorio en [0, 1) del generador propio del bot (con semilla). */
  azar: () => number;
}

export type NivelBot = 'facil' | 'normal';

export interface Bot {
  nivel: NivelBot;
  /**
   * Devuelve la acción elegida, o null para "no hacer nada" en una ventana de respuesta
   * (no jugar Modificador). En el resto de situaciones debe devolver una acción legal.
   */
  elegir: (entrada: EntradaBot) => Accion | null;
}
