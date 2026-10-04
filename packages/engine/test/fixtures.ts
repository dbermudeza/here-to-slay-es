/**
 * Catálogo mínimo de prueba y utilidades para montar escenarios. Los tests del motor no dependen de
 * Referencias/cartas.es.json.
 */
import { CartaSchema, CLASES, type Carta, type Clase } from '@hts/cards';
import { expect } from 'vitest';
import {
  crearMotor,
  problemaDeConservacion,
  SISTEMA,
  type Accion,
  type Actor,
  type CodigoError,
  type Evento,
  type GameState,
  type Motor,
  type OpcionesMotor,
  type OpcionesPartida,
  type Uid,
} from '../src';

const t = { texto: 't', textoOriginal: 't' };

const heroe = (clase: Clase, tirada = 7, copias = 3) => ({
  id: `heroe_${clase}`,
  tipo: 'heroe',
  nombre: `Héroe ${clase}`,
  nombreOriginal: `Hero ${clase}`,
  clase,
  tirada,
  copias,
  ...t,
});

const monstruo = (
  id: string,
  requisitos: string[],
  exito: { rango: { tipo: 'min' | 'max'; valor: number }; accion: Record<string, unknown> },
  fracaso: { rango: { tipo: 'min' | 'max'; valor: number }; accion: Record<string, unknown> },
) => ({
  id: `monstruo_${id}`,
  tipo: 'monstruo',
  nombre: `Monstruo ${id}`,
  nombreOriginal: id,
  copias: 1,
  requisitos,
  exito: { ...exito, ...t },
  fracaso: { ...fracaso, ...t },
  ...t,
});

const MATAR = { tipo: 'matar', robar: 0 };
const SACRIFICAR = { tipo: 'sacrificar', cantidad: 1 };
const DESCARTAR2 = { tipo: 'descartar', cantidad: 2 };
const min = (valor: number) => ({ tipo: 'min' as const, valor });
const max = (valor: number) => ({ tipo: 'max' as const, valor });

const crudas: unknown[] = [
  ...CLASES.map((clase) => ({
    id: `lider_${clase}`,
    tipo: 'lider',
    nombre: `Líder ${clase}`,
    nombreOriginal: `Leader ${clase}`,
    clase,
    copias: 1,
    ...t,
  })),
  ...CLASES.map((c) => heroe(c)),
  {
    id: 'objeto_anillo',
    tipo: 'objeto',
    nombre: 'Anillo',
    nombreOriginal: 'Ring',
    copias: 3,
    ...t,
  },
  {
    id: 'objeto_mascara_mago',
    tipo: 'objeto',
    nombre: 'Máscara de Mago',
    nombreOriginal: 'Wizard Mask',
    copias: 2,
    otorgaClase: 'mago',
    ...t,
  },
  {
    id: 'objeto_maldito_llave',
    tipo: 'objeto_maldito',
    nombre: 'Llave',
    nombreOriginal: 'Key',
    copias: 2,
    ...t,
  },
  { id: 'magia_prueba', tipo: 'magia', nombre: 'Magia', nombreOriginal: 'Magic', copias: 3, ...t },
  {
    id: 'modificador_mas2_menos2',
    tipo: 'modificador',
    nombre: '+2/−2',
    nombreOriginal: '+2/-2',
    copias: 6,
    opciones: [2, -2],
  },
  {
    id: 'modificador_mas4',
    tipo: 'modificador',
    nombre: '+4',
    nombreOriginal: '+4',
    copias: 3,
    opciones: [4],
  },
  {
    id: 'desafio',
    tipo: 'desafio',
    nombre: 'Desafío',
    nombreOriginal: 'Challenge',
    copias: 6,
    ...t,
  },
  monstruo('h', ['heroe'], { rango: min(8), accion: MATAR }, { rango: max(5), accion: SACRIFICAR }),
  monstruo(
    'hh',
    ['heroe', 'heroe'],
    { rango: min(8), accion: { tipo: 'matar', robar: 1 } },
    { rango: max(4), accion: DESCARTAR2 },
  ),
  monstruo(
    'mago_h',
    ['mago', 'heroe'],
    { rango: min(8), accion: MATAR },
    { rango: max(4), accion: DESCARTAR2 },
  ),
  monstruo(
    'dracos',
    ['heroe'],
    { rango: max(5), accion: MATAR },
    { rango: min(8), accion: SACRIFICAR },
  ),
  monstruo(
    'extra_1',
    ['heroe'],
    { rango: min(8), accion: MATAR },
    { rango: max(5), accion: SACRIFICAR },
  ),
  monstruo(
    'extra_2',
    ['heroe'],
    { rango: min(8), accion: MATAR },
    { rango: max(5), accion: SACRIFICAR },
  ),
];

export const CATALOGO: Carta[] = crudas.map((c) => CartaSchema.parse(c));

export const nuevoMotor = (opciones?: OpcionesMotor): Motor => crearMotor(CATALOGO, opciones);

export const A = 'ana';
export const B = 'beto';
export const C = 'cata';

export function nuevaPartida(
  motor: Motor,
  {
    jugadores = [A, B, C],
    semilla = 'prueba',
    opciones = {},
  }: {
    jugadores?: string[];
    semilla?: string;
    opciones?: Partial<OpcionesPartida>;
  } = {},
): GameState {
  return motor.crearPartida({
    jugadores: jugadores.map((id) => ({ id, nombre: id.toUpperCase() })),
    semilla,
    opciones,
  }).state;
}

/**
 * Prepara un escenario limpio: manos vacías, turno de `turnoDe` con 3 PA, Líderes elegidos y
 * Monstruos del centro concretos. Devuelve una copia; no muta la entrada.
 */
export function escenario(
  s0: GameState,
  {
    turnoDe = A,
    lideres = {},
    centro,
  }: { turnoDe?: string; lideres?: Record<string, Clase>; centro?: string[] } = {},
): GameState {
  const s = structuredClone(s0);
  for (const j of s.jugadores) {
    s.mazo.push(...j.mano);
    j.mano = [];
  }
  // Reasignar Líderes por clase.
  for (const j of s.jugadores) {
    const clase = lideres[j.id];
    if (clase === undefined) continue;
    const otro = s.jugadores.find((x) => s.instancias[x.lider] === `lider_${clase}`);
    if (otro !== undefined && otro !== j) [otro.lider, j.lider] = [j.lider, otro.lider];
    else if (otro === undefined) {
      const anterior = j.lider;
      s.instancias = Object.fromEntries(
        Object.entries(s.instancias).filter(([uid]) => uid !== anterior),
      );
      j.lider = `lider_${clase}#1`;
      s.instancias[j.lider] = `lider_${clase}`;
    }
  }
  if (centro !== undefined) {
    s.mazoMonstruos.push(...s.monstruosCentro);
    s.monstruosCentro = centro.map((id) => {
      const uid = s.mazoMonstruos.find((u) => s.instancias[u] === `monstruo_${id}`);
      if (uid === undefined) throw new Error(`Monstruo ${id} no disponible`);
      s.mazoMonstruos.splice(s.mazoMonstruos.indexOf(uid), 1);
      return uid;
    });
  }
  s.turno = { jugador: turnoDe, numero: s.turno.numero, pa: 3, heroesUsados: [] };
  s.pila = [];
  return s;
}

function tomarDelMazo(s: GameState, cartaId: string): Uid {
  const uid = s.mazo.find((u) => s.instancias[u] === cartaId);
  if (uid === undefined) throw new Error(`No queda ${cartaId} en el mazo`);
  s.mazo.splice(s.mazo.indexOf(uid), 1);
  return uid;
}

/** Mueve una copia de `cartaId` del mazo a la mano de `jugador` (muta `s`). */
export function darCarta(s: GameState, jugador: string, cartaId: string): Uid {
  const uid = tomarDelMazo(s, cartaId);
  jugadorDe(s, jugador).mano.push(uid);
  return uid;
}

/** Pone un Héroe del mazo en el Grupo de `jugador`, opcionalmente con un Objeto (muta `s`). */
export function ponerHeroe(s: GameState, jugador: string, clase: Clase, objetoId?: string): Uid {
  const heroeUid = tomarDelMazo(s, `heroe_${clase}`);
  const objeto = objetoId === undefined ? null : tomarDelMazo(s, objetoId);
  jugadorDe(s, jugador).grupo.push({ heroe: heroeUid, objeto });
  return heroeUid;
}

export function jugadorDe(s: GameState, id: string) {
  const j = s.jugadores.find((x) => x.id === id);
  if (j === undefined) throw new Error(`Jugador ${id} no existe`);
  return j;
}

/** Copia de `s` cuyos próximos dados serán `valores`. No muta `s`. */
export function forzarDados(s: GameState, ...valores: number[]): GameState {
  return { ...s, dadosForzados: [...s.dadosForzados, ...valores] };
}

export function cima(s: GameState) {
  return s.pila[s.pila.length - 1];
}

/** Ejecuta una acción que debe ser legal; comprueba la conservación de cartas. */
export function hacer(
  motor: Motor,
  s: GameState,
  actor: Actor,
  accion: Accion,
): { state: GameState; events: Evento[] } {
  const r = motor.reducer(s, { actor, accion });
  if (!r.ok) throw new Error(`Acción rechazada (${r.error.codigo}): ${JSON.stringify(accion)}`);
  expect(problemaDeConservacion(r.state)).toBeNull();
  return { state: r.state, events: r.events };
}

/** Ejecuta una acción que debe ser ilegal y devuelve el código de error. */
export function rechazo(motor: Motor, s: GameState, actor: Actor, accion: Accion): CodigoError {
  const r = motor.reducer(s, { actor, accion });
  if (r.ok) throw new Error(`Se esperaba un rechazo: ${JSON.stringify(accion)}`);
  return r.error.codigo;
}

/** Cierra la ventana superior como lo haría el temporizador del host. */
export function cerrar(motor: Motor, s: GameState) {
  const v = cima(s);
  if (v === undefined || !('secuencia' in v)) throw new Error('No hay ventana abierta');
  return hacer(motor, s, SISTEMA, { tipo: 'CERRAR_VENTANA', secuencia: v.secuencia });
}

/** Todos los rivales pasan en la ventana de desafío. */
export function todosPasan(motor: Motor, s: GameState) {
  const v = cima(s);
  if (v?.tipo !== 'ventanaDesafio') throw new Error('No hay ventana de desafío');
  let r = { state: s, events: [] as Evento[] };
  for (const j of s.jugadores) {
    if (j.id === v.jugada.jugador) continue;
    const paso = hacer(motor, r.state, j.id, { tipo: 'PASAR' });
    r = { state: paso.state, events: [...r.events, ...paso.events] };
  }
  return r;
}

export const tipos = (eventos: readonly Evento[]) => eventos.map((e) => e.tipo);
