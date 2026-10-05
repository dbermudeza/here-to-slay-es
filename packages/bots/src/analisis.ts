/**
 * Utilidades para razonar sobre la vista de un jugador: clases, amenaza de cada rival,
 * probabilidades de 2d6 y bonos de tirada estimados a partir de la información pública.
 */
import {
  CLASES,
  DEFINICIONES_EFECTOS,
  type Carta,
  type Clase,
  type Programa,
  type RangoTirada,
} from '@hts/cards';
import {
  desgloseClases,
  type JugadorVista,
  type PendienteVista,
  type Tirada,
  type Uid,
  type VistaJugador,
} from '@hts/engine';
import type { EntradaBot } from './tipos';

/** P(2d6 = s) para s = 2..12. */
const DIST_2D6: ReadonlyMap<number, number> = (() => {
  const m = new Map<number, number>();
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++) m.set(a + b, (m.get(a + b) ?? 0) + 1 / 36);
  return m;
})();

/** Probabilidad de que 2d6 + bono caiga en el rango. */
export function probRango(rango: RangoTirada, bono: number): number {
  let p = 0;
  for (const [s, ps] of DIST_2D6) {
    const t = s + bono;
    if (rango.tipo === 'min' ? t >= rango.valor : t <= rango.valor) p += ps;
  }
  return p;
}

export const probAlMenos = (n: number, bono: number): number =>
  probRango({ tipo: 'min', valor: n }, bono);

export class Analisis {
  readonly vista: VistaJugador;
  readonly yo: JugadorVista;

  constructor(readonly entrada: EntradaBot) {
    this.vista = entrada.vista;
    const yo = this.vista.jugadores.find((j) => j.id === this.vista.yo);
    if (yo === undefined) throw new Error('El bot no está en la partida');
    this.yo = yo;
  }

  carta(uid: Uid): Carta | undefined {
    const id = this.vista.cartas[uid];
    return id === undefined ? undefined : this.entrada.catalogo.get(id);
  }

  jugador(id: string): JugadorVista | undefined {
    return this.vista.jugadores.find((j) => j.id === id);
  }

  get rivales(): JugadorVista[] {
    return this.vista.jugadores.filter((j) => j.id !== this.yo.id);
  }

  get cima(): PendienteVista | undefined {
    return this.vista.pila[this.vista.pila.length - 1];
  }

  claseDeHeroe(heroe: Uid, objeto: Uid | null): Clase | undefined {
    const o = objeto === null ? undefined : this.carta(objeto);
    if ((o?.tipo === 'objeto' || o?.tipo === 'objeto_maldito') && o.otorgaClase !== undefined)
      return o.otorgaClase;
    const h = this.carta(heroe);
    return h?.tipo === 'heroe' ? h.clase : undefined;
  }

  clases(j: JugadorVista): Set<Clase> {
    const { porClase } = desgloseClases(
      this.entrada.catalogo,
      (uid) => this.vista.cartas[uid],
      j.lider,
      j.grupo,
    );
    return new Set(CLASES.filter((c) => porClase[c].length > 0));
  }

  /** Lo cerca que está un jugador de ganar (más alto = más peligroso). */
  amenaza(j: JugadorVista): number {
    const monstruos = j.monstruos.length;
    const clases = this.clases(j).size;
    return this.vista.opciones.modo === 'normal'
      ? Math.max(monstruos * 33, clases * 16) + j.grupo.length * 2
      : Math.max(monstruos * 25 + clases * 5, clases * 14 + monstruos * 10) + j.grupo.length * 2;
  }

  /** El rival más peligroso. */
  get rivalLider(): JugadorVista | undefined {
    return [...this.rivales].sort((a, b) => this.amenaza(b) - this.amenaza(a))[0];
  }

  /** ¿Gana `j` si mata un Monstruo más? */
  ganaConUnMonstruo(j: JugadorVista): boolean {
    const m = j.monstruos.length + 1;
    const c = this.clases(j).size;
    return this.vista.opciones.modo === 'normal' ? m >= 3 : m >= 4 && c >= 3;
  }

  /** ¿Gana `j` al terminar el turno con estas clases? */
  ganaConClases(j: JugadorVista, clases: number): boolean {
    return this.vista.opciones.modo === 'normal'
      ? clases >= 6
      : clases >= 6 && j.monstruos.length >= 1;
  }

  /**
   * Bono estimado (pasivas visibles y efectos temporales públicos) para una tirada de `jugadorId`.
   * `heroe`: Héroe por el que se tira (para Objetos equipados).
   */
  bono(
    jugadorId: string,
    contexto: 'heroe' | 'ataque' | 'desafio',
    heroe?: Uid,
    tirada?: Tirada,
  ): number {
    const j = this.jugador(jugadorId);
    if (j === undefined) return 0;
    let total = 0;
    const fuentes: { uid: Uid; equipadoA: Uid | null }[] = [
      { uid: j.lider, equipadoA: null },
      ...j.monstruos.map((uid) => ({ uid, equipadoA: null })),
      ...j.grupo.flatMap((r) => (r.objeto === null ? [] : [{ uid: r.objeto, equipadoA: r.heroe }])),
    ];
    for (const f of fuentes) {
      const id = this.vista.cartas[f.uid];
      for (const p of (id === undefined ? undefined : DEFINICIONES_EFECTOS[id])?.pasivas ?? []) {
        if (p.tipo === 'bonoTirada') {
          if (p.soloHeroeEquipado && (contexto !== 'heroe' || f.equipadoA !== heroe)) continue;
          if (p.contexto === 'cualquiera' || p.contexto === contexto) total += p.valor;
        } else if (p.tipo === 'bonoPorModificadorRival' && tirada !== undefined) {
          total +=
            p.valor *
            tirada.modificaciones.filter((m) => m.uid !== null && m.jugador !== jugadorId).length;
        }
      }
    }
    for (const t of this.vista.temporales)
      if (t.jugador === jugadorId && t.tipo === 'bonoTirada') total += t.valor;
    return total;
  }
}

/** Valor aproximado del efecto de una carta según los pasos de su programa. */
export function valorPrograma(programa: Programa | undefined): number {
  if (programa === undefined) return 0;
  let v = 0;
  for (const p of programa) {
    switch (p.paso) {
      case 'robar':
        v += 8 * p.cantidad;
        break;
      case 'robarHasta':
        v += 20;
        break;
      case 'destruir':
        v += 25 * (typeof p.cantidad === 'number' ? p.cantidad : 1);
        break;
      case 'arrebatar':
        v += 28;
        break;
      case 'sacar':
      case 'sacarDeCada':
      case 'tomarDeManoVista':
        v += 10;
        break;
      case 'jugadorDebe':
        v += p.accion === 'sacrificar' ? 22 : 9 * p.cantidad;
        break;
      case 'descartar':
        v -= 5 * p.min;
        break;
      case 'buscarDescarte':
      case 'tomarDeDescarte':
        v += 10;
        break;
      case 'jugarInmediato':
        v += 6;
        break;
      case 'bonoTurno':
      case 'proteccion':
        v += 7;
        break;
      case 'custom':
        v += 15;
        break;
      default:
        v += 3;
    }
  }
  return v;
}

/** Valor aproximado de tener una carta en la mano (para elegir qué descartar o qué tomar). */
export function valorEnMano(carta: Carta | undefined): number {
  if (carta === undefined) return 0;
  switch (carta.tipo) {
    case 'heroe':
      return 25 + valorPrograma(DEFINICIONES_EFECTOS[carta.id]?.programa) / 2 + (12 - carta.tirada);
    case 'magia':
      return 18 + valorPrograma(DEFINICIONES_EFECTOS[carta.id]?.programa) / 2;
    case 'objeto':
      return 20;
    case 'objeto_maldito':
      return 16;
    case 'modificador':
      return 12 + Math.max(...carta.opciones.map(Math.abs));
    case 'desafio':
      return 22;
    default:
      return 0;
  }
}
