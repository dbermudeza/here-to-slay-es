import { CLASES, type Carta, type Clase, type RangoTirada, type Requisito } from '@hts/cards';
import type { Catalogo, GameState, Jugador, JugadorId, Ranura, Tirada, Uid } from './tipos';

/** Error de invariante interna: indica un fallo del motor, no una acción ilegal. */
export class ErrorInterno extends Error {}

export function cartaDe(catalogo: Catalogo, estado: GameState, uid: Uid): Carta {
  const id = estado.instancias[uid];
  const carta = id === undefined ? undefined : catalogo.get(id);
  if (carta === undefined) throw new ErrorInterno(`Carta desconocida: ${uid}`);
  return carta;
}

export function idCarta(estado: GameState, uid: Uid): string {
  const id = estado.instancias[uid];
  if (id === undefined) throw new ErrorInterno(`Instancia desconocida: ${uid}`);
  return id;
}

export function buscarJugador(estado: GameState, id: JugadorId): Jugador | undefined {
  return estado.jugadores.find((j) => j.id === id);
}

export function jugador(estado: GameState, id: JugadorId): Jugador {
  const j = buscarJugador(estado, id);
  if (j === undefined) throw new ErrorInterno(`Jugador desconocido: ${id}`);
  return j;
}

export function jugadorActivo(estado: GameState): Jugador {
  return jugador(estado, estado.turno.jugador);
}

export function cimaPila(estado: GameState) {
  return estado.pila[estado.pila.length - 1];
}

export interface Ubicacion {
  jugador: Jugador;
  ranura: Ranura;
}

/** Busca el Héroe `uid` en el Grupo de cualquier jugador. */
export function buscarRanura(estado: GameState, heroe: Uid): Ubicacion | null {
  for (const j of estado.jugadores) {
    const ranura = j.grupo.find((r) => r.heroe === heroe);
    if (ranura) return { jugador: j, ranura };
  }
  return null;
}

/** Traduce un uid a id de carta; `null`/`undefined` si la carta no se conoce (p. ej., oculta). */
export type IdDeCarta = (uid: Uid) => string | null | undefined;

/** Quién aporta una clase al Grupo (R-046, R-091). */
export interface AportacionClase {
  /** Id de carta (no uid) del Líder o del Héroe que aporta la clase. */
  carta: string;
  /** Uid de esa carta en la mesa. */
  uid: Uid;
  /** 'mascara': Héroe cuya clase viene de su Objeto equipado (su id va en `objeto`). */
  origen: 'lider' | 'heroe' | 'mascara';
  /** Id de carta del Objeto; solo si `origen === 'mascara'`. */
  objeto?: string;
}

export interface DesgloseClases {
  /** Las 6 clases (orden de CLASES), con quién aporta cada una; lista vacía si nadie. */
  porClase: Record<Clase, AportacionClase[]>;
  /** Número de clases distintas representadas (lo que usa la victoria, R-091). */
  total: number;
}

interface ClaseAportada {
  clase: Clase;
  aportacion: AportacionClase;
}

/** Clase que aporta el Líder `uid`, o null si no es un Líder conocido. */
function aportacionLider(catalogo: Catalogo, idDe: IdDeCarta, uid: Uid): ClaseAportada | null {
  const id = idDe(uid);
  const carta = id == null ? undefined : catalogo.get(id);
  if (id == null || carta?.tipo !== 'lider') return null;
  return { clase: carta.clase, aportacion: { carta: id, uid, origen: 'lider' } };
}

/**
 * Clase que aporta un Héroe del Grupo (R-046): la de su máscara si lleva un Objeto que otorga
 * clase (y entonces solo esa), si no la suya. Null si la ranura no tiene un Héroe conocido.
 */
function aportacionHeroe(
  catalogo: Catalogo,
  idDe: IdDeCarta,
  ranura: Ranura,
): ClaseAportada | null {
  const id = idDe(ranura.heroe);
  const heroe = id == null ? undefined : catalogo.get(id);
  if (id == null || heroe?.tipo !== 'heroe') return null;
  const uid = ranura.heroe;
  if (ranura.objeto !== null) {
    const objetoId = idDe(ranura.objeto);
    const objeto = objetoId == null ? undefined : catalogo.get(objetoId);
    if (
      objetoId != null &&
      (objeto?.tipo === 'objeto' || objeto?.tipo === 'objeto_maldito') &&
      objeto.otorgaClase
    ) {
      return {
        clase: objeto.otorgaClase,
        aportacion: { carta: id, uid, origen: 'mascara', objeto: objetoId },
      };
    }
  }
  return { clase: heroe.clase, aportacion: { carta: id, uid, origen: 'heroe' } };
}

/**
 * Desglose de las clases de un Grupo, Líder incluido (R-046, R-081, R-091). Sirve tanto con el
 * estado como con una vista: las cartas que `idDe` no conoce se ignoran.
 */
export function desgloseClases(
  catalogo: Catalogo,
  idDe: IdDeCarta,
  lider: Uid,
  grupo: readonly Ranura[],
): DesgloseClases {
  const porClase = Object.fromEntries(CLASES.map((c) => [c, []])) as unknown as Record<
    Clase,
    AportacionClase[]
  >;
  const aportadas = [
    aportacionLider(catalogo, idDe, lider),
    ...grupo.map((r) => aportacionHeroe(catalogo, idDe, r)),
  ];
  for (const a of aportadas) if (a !== null) porClase[a.clase].push(a.aportacion);
  const total = CLASES.filter((c) => porClase[c].length > 0).length;
  return { porClase, total };
}

const idDeEstado =
  (estado: GameState): IdDeCarta =>
  (uid) =>
    idCarta(estado, uid);

/** Clase de un Héroe teniendo en cuenta su Objeto equipado (máscaras, R-046). */
export function claseEfectiva(catalogo: Catalogo, estado: GameState, ranura: Ranura): Clase {
  const a = aportacionHeroe(catalogo, idDeEstado(estado), ranura);
  if (a === null) throw new ErrorInterno(`${ranura.heroe} no es un Héroe`);
  return a.clase;
}

export function claseLider(catalogo: Catalogo, estado: GameState, j: Jugador): Clase {
  const a = aportacionLider(catalogo, idDeEstado(estado), j.lider);
  if (a === null) throw new ErrorInterno(`${j.lider} no es un Líder`);
  return a.clase;
}

/** Clases distintas representadas en el Grupo, incluido el Líder (R-081, R-091). */
export function clasesDelGrupo(catalogo: Catalogo, estado: GameState, j: Jugador): Set<Clase> {
  const clases = new Set<Clase>([claseLider(catalogo, estado, j)]);
  for (const r of j.grupo) clases.add(claseEfectiva(catalogo, estado, r));
  return clases;
}

/**
 * Comprueba los requisitos de un Monstruo (R-086). Cada símbolo debe cubrirlo una carta distinta:
 * - un símbolo de clase, un Héroe o el Líder de esa clase;
 * - un símbolo "H", solo un Héroe.
 *
 * Se resuelve como un emparejamiento con vuelta atrás; los requisitos son muy pocos.
 */
export function cumpleRequisitos(
  catalogo: Catalogo,
  estado: GameState,
  j: Jugador,
  requisitos: readonly Requisito[],
): boolean {
  interface Fuente {
    clase: Clase;
    esHeroe: boolean;
  }
  const fuentes: Fuente[] = [
    { clase: claseLider(catalogo, estado, j), esHeroe: false },
    ...j.grupo.map((r) => ({ clase: claseEfectiva(catalogo, estado, r), esHeroe: true })),
  ];
  // Primero los requisitos de clase, que son los más restrictivos.
  const orden = [...requisitos].sort((a, b) => Number(a === 'heroe') - Number(b === 'heroe'));
  const usadas = new Array<boolean>(fuentes.length).fill(false);

  const cubre = (f: Fuente, req: Requisito): boolean =>
    req === 'heroe' ? f.esHeroe : f.clase === req;

  const asignar = (i: number): boolean => {
    const req = orden[i];
    if (req === undefined) return true;
    for (let k = 0; k < fuentes.length; k++) {
      const f = fuentes[k];
      if (f === undefined || usadas[k] || !cubre(f, req)) continue;
      usadas[k] = true;
      if (asignar(i + 1)) return true;
      usadas[k] = false;
    }
    return false;
  };
  return asignar(0);
}

export function totalTirada(t: Tirada): number {
  return t.dados[0] + t.dados[1] + t.modificaciones.reduce((s, m) => s + m.valor, 0);
}

export function enRango(total: number, rango: RangoTirada): boolean {
  return rango.tipo === 'min' ? total >= rango.valor : total <= rango.valor;
}

/** Todas las ubicaciones de cartas del estado; sirve para comprobar que ninguna se pierde ni se duplica. */
export function todasLasUbicaciones(estado: GameState): Uid[] {
  const uids: Uid[] = [
    ...estado.mazo,
    ...estado.descarte,
    ...estado.mazoMonstruos,
    ...estado.monstruosCentro,
  ];
  for (const j of estado.jugadores) {
    uids.push(j.lider, ...j.mano, ...j.monstruos);
    for (const r of j.grupo) {
      uids.push(r.heroe);
      if (r.objeto !== null) uids.push(r.objeto);
    }
  }
  for (const p of estado.pila) {
    if (p.tipo === 'ventanaDesafio') uids.push(p.jugada.uid);
    if (p.tipo === 'ventanaModificadores' && p.contexto.tipo === 'desafio') {
      uids.push(p.contexto.jugada.uid);
    }
  }
  return uids;
}

/** Devuelve la descripción del primer problema de conservación de cartas, o null si no hay ninguno. */
export function problemaDeConservacion(estado: GameState): string | null {
  const vistos = new Set<Uid>();
  for (const uid of todasLasUbicaciones(estado)) {
    if (vistos.has(uid)) return `carta duplicada: ${uid}`;
    if (estado.instancias[uid] === undefined) return `carta sin instancia: ${uid}`;
    vistos.add(uid);
  }
  for (const uid of Object.keys(estado.instancias)) {
    if (!vistos.has(uid)) return `carta perdida: ${uid}`;
  }
  return null;
}
