/**
 * Operaciones que modifican un BORRADOR del estado. El reducer clona el estado antes de
 * llamarlas, así que el estado que recibe nunca se muta.
 */
import { siguienteRng } from './rng';
import { idCarta } from './consultas';
import type { ContextoTirada, Emitir, GameState, Jugador, JugadorId, Tirada, Uid } from './tipos';

export type { Emitir };

export const PA_POR_TURNO = 3;
export const CARTAS_MANO_INICIAL = 5;
export const MONSTRUOS_EN_CENTRO = 3;

export function azar(d: GameState): number {
  const [valor, siguiente] = siguienteRng(d.rng);
  d.rng = siguiente;
  return valor;
}

export function entero(d: GameState, n: number): number {
  return Math.floor(azar(d) * n);
}

/** Fisher–Yates con el RNG de la partida. */
export function barajar<T>(d: GameState, lista: T[]): void {
  for (let i = lista.length - 1; i > 0; i--) {
    const k = entero(d, i + 1);
    [lista[i], lista[k]] = [lista[k] as T, lista[i] as T];
  }
}

export function dado(d: GameState): number {
  const forzado = d.dadosForzados.shift();
  return forzado ?? entero(d, 6) + 1;
}

export function quitar<T>(lista: T[], valor: T): boolean {
  const i = lista.indexOf(valor);
  if (i === -1) return false;
  lista.splice(i, 1);
  return true;
}

/**
 * Si el mazo está vacío, baraja la pila de descarte como nuevo mazo (R-095).
 * Devuelve false si no hay cartas ni en el mazo ni en el descarte.
 */
export function reponerMazo(d: GameState, emitir: Emitir): boolean {
  if (d.mazo.length > 0) return true;
  if (d.descarte.length === 0) {
    // TODO(regla) D-16: sin mazo ni descarte, la acción de robar no tiene efecto.
    emitir({ tipo: 'mazoAgotado' });
    return false;
  }
  d.mazo = d.descarte;
  d.descarte = [];
  barajar(d, d.mazo);
  emitir({ tipo: 'mazoRebarajado', cartas: d.mazo.length });
  return true;
}

/**
 * ROBAR n cartas del mazo, sin activar disparadores. Devuelve las cartas robadas.
 * Usa `robarCartas` (grupo.ts) salvo en la preparación.
 */
export function robar(d: GameState, j: Jugador, n: number, emitir: Emitir): Uid[] {
  const robadas: Uid[] = [];
  for (let i = 0; i < n; i++) {
    if (!reponerMazo(d, emitir)) break;
    const uid = d.mazo.shift();
    if (uid === undefined) break;
    j.mano.push(uid);
    robadas.push(uid);
    emitir({ tipo: 'cartaRobada', jugador: j.id, uid, carta: idCarta(d, uid) });
  }
  return robadas;
}

/** DESCARTAR cartas concretas de la mano. */
export function descartarDeMano(
  d: GameState,
  j: Jugador,
  uids: readonly Uid[],
  emitir: Emitir,
): void {
  if (uids.length === 0) return;
  for (const uid of uids) {
    quitar(j.mano, uid);
    d.descarte.push(uid);
  }
  emitir({ tipo: 'cartasDescartadas', jugador: j.id, cartas: uids.map((u) => idCarta(d, u)) });
}

export function tirar(d: GameState, jugador: JugadorId, emitir: Emitir): Tirada {
  const dados: [number, number] = [dado(d), dado(d)];
  emitir({ tipo: 'dadosTirados', jugador, dados });
  return { jugador, dados, modificaciones: [] };
}

export function abrirVentanaModificadores(
  d: GameState,
  tiradas: Tirada[],
  contexto: ContextoTirada,
  emitir: Emitir,
): void {
  d.secuencia += 1;
  const duracionMs =
    contexto.tipo === 'desafio'
      ? d.opciones.duracionVentanaModificadoresDesafioMs
      : d.opciones.duracionVentanaModificadoresMs;
  d.pila.push({
    tipo: 'ventanaModificadores',
    secuencia: d.secuencia,
    duracionMs,
    tiradas,
    contexto,
  });
  emitir({ tipo: 'ventanaModificadoresAbierta', secuencia: d.secuencia, duracionMs });
}
