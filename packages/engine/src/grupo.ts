/**
 * Operaciones sobre manos y Grupos que pueden activar disparadores o reemplazos (sobre el borrador).
 */
import { buscarRanura, idCarta } from './consultas';
import type { Ctx } from './efectos';
import { robar } from './ops';
import { notificar, tieneSenuelo } from './pasivas';
import type { Emitir, GameState, Jugador, Ranura, Uid } from './tipos';

/** ROBAR n cartas y avisar a los disparadores de "cada vez que robas…". */
export function robarCartas(ctx: Ctx, d: GameState, j: Jugador, n: number, emitir: Emitir): Uid[] {
  const robadas = robar(d, j, n, emitir);
  notificar(
    ctx,
    d,
    robadas.map((uid) => ({ tipo: 'robo' as const, jugador: j.id, uid })),
    emitir,
  );
  return robadas;
}

function quitarRanura(j: Jugador, heroe: Uid): Ranura | null {
  const i = j.grupo.findIndex((r) => r.heroe === heroe);
  const ranura = j.grupo[i];
  if (ranura === undefined) return null;
  j.grupo.splice(i, 1);
  return ranura;
}

/** Muñeco Señuelo: si el Héroe lo lleva, el Objeto va al descarte en su lugar. */
function usarSenuelo(
  ctx: Ctx,
  d: GameState,
  dueno: Jugador,
  ranura: Ranura,
  emitir: Emitir,
): boolean {
  if (ranura.objeto === null || !tieneSenuelo(ctx, d, ranura)) return false;
  d.descarte.push(ranura.objeto);
  emitir({
    tipo: 'senueloUsado',
    dueno: dueno.id,
    heroe: idCarta(d, ranura.heroe),
    objeto: idCarta(d, ranura.objeto),
  });
  ranura.objeto = null;
  return true;
}

/** SACRIFICAR un Héroe propio. Su Objeto equipado va al descarte con él (D-07). */
export function sacrificarHeroe(
  ctx: Ctx,
  d: GameState,
  j: Jugador,
  heroe: Uid,
  emitir: Emitir,
): void {
  const actual = j.grupo.find((r) => r.heroe === heroe);
  if (actual === undefined || usarSenuelo(ctx, d, j, actual, emitir)) return;
  const ranura = quitarRanura(j, heroe);
  if (ranura === null) return;
  d.descarte.push(ranura.heroe);
  if (ranura.objeto !== null) d.descarte.push(ranura.objeto);
  emitir({
    tipo: 'heroeSacrificado',
    jugador: j.id,
    carta: idCarta(d, ranura.heroe),
    objeto: ranura.objeto === null ? null : idCarta(d, ranura.objeto),
  });
}

/**
 * DESTRUIR un Héroe de otro jugador (R-044). Su Objeto va al descarte, o a la mano de quien
 * destruye si `objetoAMano` (Shurikitty).
 */
export function destruirHeroe(
  ctx: Ctx,
  d: GameState,
  actor: Jugador,
  heroe: Uid,
  objetoAMano: boolean,
  emitir: Emitir,
): void {
  const ub = buscarRanura(d, heroe);
  if (ub === null || usarSenuelo(ctx, d, ub.jugador, ub.ranura, emitir)) return;
  const ranura = quitarRanura(ub.jugador, heroe);
  if (ranura === null) return;
  d.descarte.push(ranura.heroe);
  if (ranura.objeto !== null) {
    if (objetoAMano) actor.mano.push(ranura.objeto);
    else d.descarte.push(ranura.objeto);
  }
  emitir({
    tipo: 'heroeDestruido',
    jugador: actor.id,
    dueno: ub.jugador.id,
    carta: idCarta(d, ranura.heroe),
    objeto: ranura.objeto === null ? null : idCarta(d, ranura.objeto),
    objetoAMano: objetoAMano && ranura.objeto !== null,
  });
  notificar(ctx, d, [{ tipo: 'heroeDestruido', dueno: ub.jugador.id }], emitir);
}

/** ARREBATAR: mover un Héroe (con su Objeto, R-044) del Grupo de otro jugador al propio. */
export function arrebatarHeroe(d: GameState, actor: Jugador, heroe: Uid, emitir: Emitir): void {
  const ub = buscarRanura(d, heroe);
  if (ub === null || ub.jugador === actor) return;
  const ranura = quitarRanura(ub.jugador, heroe);
  if (ranura === null) return;
  actor.grupo.push(ranura);
  emitir({
    tipo: 'heroeArrebatado',
    jugador: actor.id,
    de: ub.jugador.id,
    carta: idCarta(d, ranura.heroe),
    objeto: ranura.objeto === null ? null : idCarta(d, ranura.objeto),
  });
}

/** Mover un Héroe propio (con su Objeto) al Grupo de otro jugador. */
export function moverHeroe(
  d: GameState,
  de: Jugador,
  a: Jugador,
  heroe: Uid,
  emitir: Emitir,
): void {
  const ranura = quitarRanura(de, heroe);
  if (ranura === null) return;
  a.grupo.push(ranura);
  emitir({ tipo: 'heroeMovido', de: de.id, a: a.id, carta: idCarta(d, heroe) });
}
