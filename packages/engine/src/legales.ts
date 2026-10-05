import { buscarJugador, cartaDe, cimaPila } from './consultas';
import type { Ctx } from './efectos';
import type { Accion, Actor, GameState, Pregunta, Respuesta, Uid } from './tipos';
import { validar } from './validar';

function combinaciones<T>(lista: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const resultado: T[][] = [];
  lista.forEach((x, i) => {
    for (const resto of combinaciones(lista.slice(i + 1), k - 1)) resultado.push([x, ...resto]);
  });
  return resultado;
}

function permutaciones<T>(lista: readonly T[]): T[][] {
  if (lista.length <= 1) return [[...lista]];
  return lista.flatMap((x, i) =>
    permutaciones([...lista.slice(0, i), ...lista.slice(i + 1)]).map((resto) => [x, ...resto]),
  );
}

/** Todas las respuestas posibles a una pregunta. */
export function respuestasPosibles(s: GameState, p: Pregunta): Respuesta[] {
  switch (p.tipo) {
    case 'jugador':
      return p.opciones.map((jugador) => ({ jugador }));
    case 'cartas': {
      if (p.ordenado) return permutaciones(p.opciones).map((cartas) => ({ cartas }));
      const r: Respuesta[] = [];
      for (let k = p.min; k <= p.max; k++) {
        for (const cartas of combinaciones(p.opciones, k)) r.push({ cartas });
      }
      return r;
    }
    case 'oculta': {
      const n = buscarJugador(s, p.de)?.mano.length ?? 0;
      return Array.from({ length: n }, (_, indice) => ({ indice }));
    }
    case 'confirmar':
      return [{ si: true }, { si: false }];
    case 'valor':
      return p.opciones.map((valor) => ({ valor }));
    case 'ver':
      return [{ ok: true }];
  }
}

/**
 * Todas las acciones legales de `actor` en el estado actual (sin RENDIRSE, que siempre es posible
 * pero nunca se propone: los bots no se rinden). Se generan candidatas y se filtran con
 * `validar`, así que la lista nunca contradice al reducer. Sirve para la UI y los bots.
 */
export function accionesLegales(ctx: Ctx, s: GameState, actor: Actor): Accion[] {
  const j = buscarJugador(s, actor);
  if (j === undefined || s.ganador !== null || s.rendidos.includes(j.id)) return [];
  const candidatas: Accion[] = [];
  const cima = cimaPila(s);

  if (cima === undefined && s.turno.jugador === actor) {
    candidatas.push({ tipo: 'ROBAR' }, { tipo: 'RENOVAR_MANO' }, { tipo: 'FIN_TURNO' });
    const huecos = s.jugadores.flatMap((x) =>
      x.grupo.filter((r) => r.objeto === null).map((r) => r.heroe),
    );
    for (const uid of j.mano) {
      const tipo = cartaDe(ctx.catalogo, s, uid).tipo;
      if (tipo === 'objeto' || tipo === 'objeto_maldito') {
        for (const objetivo of huecos) candidatas.push({ tipo: 'JUGAR_CARTA', uid, objetivo });
      } else {
        candidatas.push({ tipo: 'JUGAR_CARTA', uid });
      }
    }
    for (const r of j.grupo) candidatas.push({ tipo: 'TIRAR_HEROE', uid: r.heroe });
    for (const uid of s.monstruosCentro) candidatas.push({ tipo: 'ATACAR', uid });
    for (const uid of [j.lider, ...j.monstruos]) candidatas.push({ tipo: 'USAR_HABILIDAD', uid });
  }

  switch (cima?.tipo) {
    case 'ventanaDesafio':
      candidatas.push({ tipo: 'PASAR' });
      for (const uid of j.mano) candidatas.push({ tipo: 'DESAFIAR', uid });
      break;
    case 'ventanaModificadores':
      for (const uid of j.mano) {
        const carta = cartaDe(ctx.catalogo, s, uid);
        if (carta.tipo !== 'modificador') continue;
        for (const valor of carta.opciones) {
          cima.tiradas.forEach((_, tirada) => {
            candidatas.push({ tipo: 'JUGAR_MODIFICADOR', uid, valor, tirada });
          });
        }
      }
      break;
    case 'tiradaInmediata':
      candidatas.push(
        { tipo: 'TIRADA_INMEDIATA', tirar: true },
        { tipo: 'TIRADA_INMEDIATA', tirar: false },
      );
      break;
    case 'elegir': {
      const opciones: Uid[] = cima.accion === 'descartar' ? j.mano : j.grupo.map((r) => r.heroe);
      for (const uids of combinaciones(opciones, cima.cantidad)) {
        candidatas.push({ tipo: 'ELEGIR', uids });
      }
      break;
    }
    case 'decision':
      if (cima.jugador === actor) {
        for (const respuesta of respuestasPosibles(s, cima.pregunta)) {
          candidatas.push({ tipo: 'RESPONDER', respuesta });
        }
      }
      break;
    case 'efecto':
    case undefined:
      break;
  }

  return candidatas.filter((accion) => validar(ctx, s, { actor, accion }) === null);
}
