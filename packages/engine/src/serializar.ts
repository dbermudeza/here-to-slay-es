import { problemaDeConservacion } from './consultas';
import type { Ctx } from './efectos';
import { PA_POR_TURNO } from './ops';
import type { GameState } from './tipos';

export class ErrorCarga extends Error {}

const FORMATO = 'hts-partida';

/** Guarda la partida completa (incluida la semilla en curso del RNG) como texto JSON. */
export function serializarPartida(estado: GameState): string {
  return JSON.stringify({ formato: FORMATO, estado });
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Carga una partida guardada. Lanza ErrorCarga si el texto no es una partida válida para este catálogo. */
export function cargarPartida(ctx: Ctx, texto: string): GameState {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorCarga('El archivo no es JSON válido.');
  }
  if (!esObjeto(datos) || datos.formato !== FORMATO || !esObjeto(datos.estado)) {
    throw new ErrorCarga('El archivo no es una partida guardada.');
  }
  const e = datos.estado;
  if (e.version !== 1)
    throw new ErrorCarga(`Versión de partida no soportada: ${String(e.version)}.`);
  const listas = [
    'jugadores',
    'mazo',
    'descarte',
    'mazoMonstruos',
    'monstruosCentro',
    'pila',
    'rng',
    'dadosForzados',
    'temporales',
  ];
  for (const campo of listas) {
    if (!Array.isArray(e[campo])) throw new ErrorCarga(`Campo inválido: ${campo}.`);
  }
  if (!esObjeto(e.instancias) || !esObjeto(e.turno) || !esObjeto(e.opciones)) {
    throw new ErrorCarga('Faltan campos de la partida.');
  }
  for (const id of Object.values(e.instancias)) {
    if (typeof id !== 'string' || !ctx.catalogo.has(id)) {
      throw new ErrorCarga(`La partida usa una carta que no está en el catálogo: ${String(id)}.`);
    }
  }
  // Partidas guardadas antes de poder rendirse (D-43).
  if (e.rendidos === undefined) e.rendidos = [];
  if (!Array.isArray(e.rendidos)) throw new ErrorCarga('Campo inválido: rendidos.');
  if (esObjeto(e.opciones) && e.opciones.bots === undefined) e.opciones.bots = [];
  // Partidas guardadas antes de `turno.paInicial`: no se sabe si hubo PA extra ya gastados, así que
  // se toma el mayor entre los PA que quedan y los PA base del turno.
  if (esObjeto(e.turno) && e.turno.paInicial === undefined && typeof e.turno.pa === 'number') {
    e.turno.paInicial = Math.max(e.turno.pa, PA_POR_TURNO);
  }
  const estado = e as unknown as GameState;
  if (!estado.jugadores.some((j) => j.id === estado.turno.jugador)) {
    throw new ErrorCarga('El jugador del turno no existe.');
  }
  const problema = problemaDeConservacion(estado);
  if (problema !== null) throw new ErrorCarga(`Partida inconsistente: ${problema}.`);
  return estado;
}
