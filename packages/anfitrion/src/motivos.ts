import { DEFINICIONES_EFECTOS } from '@hts/cards';
import type { Accion, CodigoError, GameState, JugadorId, Motor } from '@hts/engine';

export interface MotivoAccion {
  accion: Accion;
  codigo: CodigoError;
}

/**
 * Acciones que la interfaz muestra como botones (aunque no sean legales ahora), para poder explicar
 * por qué están desactivadas. Solo usa información que el propio jugador puede ver.
 */
export function accionesDeInterfaz(
  motor: Motor,
  estado: GameState,
  jugadorId: JugadorId,
): Accion[] {
  const j = estado.jugadores.find((x) => x.id === jugadorId);
  if (j === undefined) return [];
  const acciones: Accion[] = [{ tipo: 'ROBAR' }, { tipo: 'RENOVAR_MANO' }, { tipo: 'FIN_TURNO' }];
  for (const uid of [j.lider, ...j.monstruos]) {
    const id = estado.instancias[uid];
    if (
      id !== undefined &&
      (DEFINICIONES_EFECTOS[id]?.pasivas ?? []).some((p) => p.tipo === 'habilidad')
    ) {
      acciones.push({ tipo: 'USAR_HABILIDAD', uid });
    }
  }
  const primerHueco = estado.jugadores
    .flatMap((x) => x.grupo)
    .find((r) => r.objeto === null)?.heroe;
  for (const uid of j.mano) {
    const tipo = motor.catalogo.get(estado.instancias[uid] ?? '')?.tipo;
    acciones.push(
      tipo === 'objeto' || tipo === 'objeto_maldito'
        ? { tipo: 'JUGAR_CARTA', uid, objetivo: primerHueco ?? '' }
        : { tipo: 'JUGAR_CARTA', uid },
    );
  }
  for (const r of j.grupo) acciones.push({ tipo: 'TIRAR_HEROE', uid: r.heroe });
  for (const uid of estado.monstruosCentro) acciones.push({ tipo: 'ATACAR', uid });
  return acciones;
}

/** Motivo (código de error) de cada acción de interfaz que ahora mismo no es legal. */
export function motivosDe(motor: Motor, estado: GameState, jugadorId: JugadorId): MotivoAccion[] {
  const motivos: MotivoAccion[] = [];
  for (const accion of accionesDeInterfaz(motor, estado, jugadorId)) {
    const codigo = motor.validar(estado, { actor: jugadorId, accion });
    if (codigo !== null) motivos.push({ accion, codigo });
  }
  return motivos;
}
