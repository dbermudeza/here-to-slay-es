import type { GameState, JugadorId, MarcoEfecto, Uid, Valor } from './tipos';

export interface DatosMarco {
  jugador: JugadorId;
  fuente: Uid;
  carta: string;
  pasiva: number | null;
  vars?: Record<string, Valor>;
}

/** Apila un nuevo efecto en ejecución. Se ejecutará cuando quede en la cima de la pila. */
export function apilarMarco(d: GameState, datos: DatosMarco): MarcoEfecto {
  const marco: MarcoEfecto = {
    tipo: 'efecto',
    id: d.siguienteEfecto,
    jugador: datos.jugador,
    fuente: datos.fuente,
    carta: datos.carta,
    pasiva: datos.pasiva,
    pc: 0,
    sub: 0,
    i: 0,
    cola: [],
    respuesta: null,
    vars: datos.vars ?? {},
  };
  d.siguienteEfecto += 1;
  d.pila.push(marco);
  return marco;
}
