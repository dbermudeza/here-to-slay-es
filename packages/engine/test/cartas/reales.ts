/**
 * Utilidades para los tests de cartas concretas con el catálogo real (Referencias/cartas.es.json).
 * Si el archivo no existe (repositorio sin los recursos personales), estos tests se saltan.
 */
import { existsSync, readFileSync } from 'node:fs';
import { ArchivoCartasSchema, type Carta } from '@hts/cards';
import { describe, expect } from 'vitest';
import { RUTA_CARTAS_JSON } from '../../../cards/src/rutas';
import {
  crearMotor,
  SISTEMA,
  type Decision,
  type Evento,
  type GameState,
  type JugadorId,
  type Respuesta,
  type Uid,
} from '../../src';
import { A, B, C, cima, escenario, forzarDados, hacer, jugadorDe, todosPasan } from '../fixtures';

export { A, B, C, cima, forzarDados, hacer, jugadorDe, todosPasan };

export const HAY_CATALOGO = existsSync(RUTA_CARTAS_JSON);
export const CARTAS: Carta[] = HAY_CATALOGO
  ? ArchivoCartasSchema.parse(JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8'))).cartas
  : [];
export const motor = crearMotor(CARTAS);
export const describeReal = describe.skipIf(!HAY_CATALOGO);

/** Líderes por defecto en los tests, elegidos para interferir lo menos posible. */
export const LIDERES: Record<JugadorId, string> = {
  [A]: 'lider_la_flecha_divina',
  [B]: 'lider_la_cancion_carismatica',
  [C]: 'lider_el_sabio_encapuchado',
};

export type R = { state: GameState; events: Evento[] };

/** Asigna el Líder `liderId` a `jugador` (intercambiándolo si otro lo tenía). Muta `s`. */
export function ponerLider(s: GameState, jugador: JugadorId, liderId: string): void {
  const j = jugadorDe(s, jugador);
  const uid = `${liderId}#1`;
  const otro = s.jugadores.find((x) => x.lider === uid);
  if (otro !== undefined) {
    [otro.lider, j.lider] = [j.lider, otro.lider];
    return;
  }
  const anterior = j.lider;
  s.instancias = Object.fromEntries(Object.entries(s.instancias).filter(([u]) => u !== anterior));
  s.instancias[uid] = liderId;
  j.lider = uid;
}

/** Mesa de 3 jugadores, manos vacías, turno de A con 3 PA y Líderes fijos. */
export function mesa(
  lideres: Partial<Record<JugadorId, string>> = {},
  semilla = 'cartas',
): GameState {
  const s = escenario(
    motor.crearPartida({
      jugadores: [A, B, C].map((id) => ({ id, nombre: id.toUpperCase() })),
      semilla,
    }).state,
  );
  for (const [j, l] of Object.entries({ ...LIDERES, ...lideres })) {
    if (l !== undefined) ponerLider(s, j, l);
  }
  return s;
}

function tomar(s: GameState, cartaId: string): Uid {
  const zonas = [s.mazo, s.descarte, s.mazoMonstruos, s.monstruosCentro];
  for (const zona of zonas) {
    const uid = zona.find((u) => s.instancias[u] === cartaId);
    if (uid !== undefined) {
      zona.splice(zona.indexOf(uid), 1);
      return uid;
    }
  }
  throw new Error(`No hay una copia libre de ${cartaId}`);
}

/** Da cartas a la mano de un jugador (las toma del mazo). Muta `s`. Devuelve los uids. */
export function mano(s: GameState, jugador: JugadorId, ...cartaIds: string[]): Uid[] {
  return cartaIds.map((id) => {
    const uid = tomar(s, id);
    jugadorDe(s, jugador).mano.push(uid);
    return uid;
  });
}

/** Pone un Héroe en el Grupo de un jugador, opcionalmente con un Objeto. Muta `s`. */
export function heroe(s: GameState, jugador: JugadorId, heroeId: string, objetoId?: string): Uid {
  const h = tomar(s, heroeId);
  const o = objetoId === undefined ? null : tomar(s, objetoId);
  jugadorDe(s, jugador).grupo.push({ heroe: h, objeto: o });
  return h;
}

/** Pone un Monstruo en el Grupo de un jugador (como si lo hubiera matado). Muta `s`. */
export function monstruo(s: GameState, jugador: JugadorId, monstruoId: string): Uid {
  const uid = tomar(s, monstruoId);
  jugadorDe(s, jugador).monstruos.push(uid);
  return uid;
}

/** Coloca cartas en la parte superior del mazo, en ese orden. Muta `s`. */
export function arriba(s: GameState, ...cartaIds: string[]): Uid[] {
  const uids = cartaIds.map((id) => tomar(s, id));
  s.mazo.unshift(...uids);
  return uids;
}

/** Pone cartas en la pila de descarte. Muta `s`. */
export function descarte(s: GameState, ...cartaIds: string[]): Uid[] {
  const uids = cartaIds.map((id) => tomar(s, id));
  s.descarte.push(...uids);
  return uids;
}

/**
 * El jugador del turno tira por un Héroe de su Grupo (lo pone si no está) con los dados indicados y
 * se cierra la ventana de Modificadores. El efecto queda en marcha.
 */
export function activar(s: GameState, heroeId: string, dados: number[] = [6, 6]): R {
  const yo = s.turno.jugador;
  const uid =
    jugadorDe(s, yo).grupo.find((r) => s.instancias[r.heroe] === heroeId)?.heroe ??
    heroe(s, yo, heroeId);
  const r = hacer(motor, forzarDados(s, ...dados), yo, { tipo: 'TIRAR_HEROE', uid });
  return acumular(r, cerrarVentana(r.state));
}

/** El jugador del turno juega una carta de Magia (que se le da) y nadie la desafía. */
export function jugarMagia(s: GameState, magiaId: string): R {
  const yo = s.turno.jugador;
  const [uid] = mano(s, yo, magiaId);
  const r = hacer(motor, s, yo, { tipo: 'JUGAR_CARTA', uid: uid ?? '' });
  return acumular(r, todosPasan(motor, r.state));
}

export function cerrarVentana(s: GameState): R {
  const v = cima(s);
  if (v === undefined || !('secuencia' in v)) throw new Error('No hay ventana abierta');
  return hacer(motor, s, SISTEMA, { tipo: 'CERRAR_VENTANA', secuencia: v.secuencia });
}

export function acumular(a: R, b: R): R {
  return { state: b.state, events: [...a.events, ...b.events] };
}

/** La decisión pendiente en la cima (falla si no la hay). */
export function decision(s: GameState): Decision {
  const d = cima(s);
  if (d?.tipo !== 'decision')
    throw new Error(`Se esperaba una decisión y la cima es ${d?.tipo ?? 'nada'}`);
  return d;
}

/** Responde la decisión pendiente (debe ser de `jugador`). */
export function responder(r: R, jugador: JugadorId, respuesta: Respuesta): R {
  expect(decision(r.state).jugador).toBe(jugador);
  return acumular(r, hacer(motor, r.state, jugador, { tipo: 'RESPONDER', respuesta }));
}

export const sinPendientes = (s: GameState): void => {
  expect(s.pila).toEqual([]);
};

export const idsDe = (s: GameState, uids: readonly Uid[]): string[] =>
  uids.map((u) => s.instancias[u] ?? '?').sort();

export const evento = <T extends Evento['tipo']>(r: R, tipo: T): Extract<Evento, { tipo: T }>[] =>
  r.events.filter((e): e is Extract<Evento, { tipo: T }> => e.tipo === tipo);
