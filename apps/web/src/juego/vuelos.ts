/**
 * Animaciones de cartas que cambian de sitio ("vuelos"): robar del mazo, recuperar del descarte,
 * sacar o recibir de una mano ajena y arrebatar o mover Héroes entre Grupos.
 *
 * Los eventos se agrupan aquí (varias cartas del mismo robo = un solo vuelo). Qué se ve de cada
 * carta se decide al reproducir el vuelo, con el jugador que mira en ese momento (información
 * oculta: los demás solo ven el reverso).
 */
import { eventoParaJugador, type Evento, type JugadorId } from '@hts/engine';
import { t } from '../i18n';

type EventoVuelo = Extract<
  Evento,
  {
    tipo:
      | 'cartaRobada'
      | 'cartaRecuperada'
      | 'cartaSacada'
      | 'cartaDada'
      | 'heroeArrebatado'
      | 'heroeMovido';
  }
>;

export interface Vuelo {
  id: number;
  eventos: EventoVuelo[];
}

const TIPOS = new Set<Evento['tipo']>([
  'cartaRobada',
  'cartaRecuperada',
  'cartaSacada',
  'cartaDada',
  'heroeArrebatado',
  'heroeMovido',
]);

const esVuelo = (e: Evento): e is EventoVuelo => TIPOS.has(e.tipo);

/** Actor y "otro jugador" de un evento de vuelo (para agrupar). */
function clave(e: EventoVuelo): string {
  switch (e.tipo) {
    case 'cartaRobada':
    case 'cartaRecuperada':
      return `${e.tipo}:${e.jugador}`;
    case 'cartaSacada':
    case 'heroeArrebatado':
      return `${e.tipo}:${e.jugador}:${e.de}`;
    case 'cartaDada':
      return `${e.tipo}:${e.jugador}:${e.a}`;
    case 'heroeMovido':
      return `${e.tipo}:${e.de}:${e.a}`;
  }
}

/** Agrupa los eventos consecutivos del mismo tipo y jugadores en vuelos. */
export function agruparVuelos(eventos: readonly Evento[], primerId: number): Vuelo[] {
  const vuelos: Vuelo[] = [];
  let anterior: string | null = null;
  for (const e of eventos) {
    if (!esVuelo(e)) {
      anterior = null;
      continue;
    }
    const k = clave(e);
    const ultimo = vuelos[vuelos.length - 1];
    if (k === anterior && ultimo !== undefined && ultimo.eventos.length < 5) ultimo.eventos.push(e);
    else vuelos.push({ id: primerId + vuelos.length, eventos: [e] });
    anterior = k;
  }
  return vuelos;
}

export interface VueloVisible {
  /** Ids de catálogo de las cartas (null = boca abajo). */
  cartas: (string | null)[];
  /** Zonas de la mesa (atributo data-zona) de origen y destino. */
  origen: string;
  destino: string;
  texto: string;
}

/** Lo que ve `yo` de un vuelo. */
export function verVuelo(
  vuelo: Vuelo,
  yo: JugadorId | null,
  nombre: (id: JugadorId) => string,
  nombreCarta: (id: string) => string,
): VueloVisible | null {
  const eventos = vuelo.eventos.map((e) => eventoParaJugador(e, yo) as EventoVuelo);
  const [e] = eventos;
  if (e === undefined) return null;
  const n = eventos.length;
  const cartasTexto = n === 1 ? t('animacion.unaCarta') : t('animacion.variasCartas', { n });
  const soyYo = (id: JugadorId): boolean => id === yo;
  const carta = (x: EventoVuelo): string | null => ('carta' in x ? x.carta : null);
  const cartas = eventos.map(carta);
  switch (e.tipo) {
    case 'cartaRobada':
      return {
        cartas,
        origen: 'mazo',
        destino: `mano:${e.jugador}`,
        texto: soyYo(e.jugador)
          ? t('animacion.mazoYo', { cartas: cartasTexto })
          : t('animacion.mazo', { nombre: nombre(e.jugador), cartas: cartasTexto }),
      };
    case 'cartaRecuperada':
      return {
        cartas,
        origen: 'descarte',
        destino: `mano:${e.jugador}`,
        texto: soyYo(e.jugador)
          ? t('animacion.descarteYo', { cartas: cartasTexto })
          : t('animacion.descarte', { nombre: nombre(e.jugador), cartas: cartasTexto }),
      };
    case 'cartaSacada':
      return {
        cartas,
        origen: `mano:${e.de}`,
        destino: `mano:${e.jugador}`,
        texto: soyYo(e.jugador)
          ? t('animacion.sacarYo', { cartas: cartasTexto, de: nombre(e.de) })
          : soyYo(e.de)
            ? t('animacion.sacarAMi', { nombre: nombre(e.jugador), cartas: cartasTexto })
            : t('animacion.sacar', {
                nombre: nombre(e.jugador),
                cartas: cartasTexto,
                de: nombre(e.de),
              }),
      };
    case 'cartaDada':
      return {
        cartas,
        origen: `mano:${e.jugador}`,
        destino: `mano:${e.a}`,
        texto: soyYo(e.jugador)
          ? t('animacion.darYo', { cartas: cartasTexto, a: nombre(e.a) })
          : soyYo(e.a)
            ? t('animacion.darAMi', { nombre: nombre(e.jugador), cartas: cartasTexto })
            : t('animacion.dar', {
                nombre: nombre(e.jugador),
                cartas: cartasTexto,
                a: nombre(e.a),
              }),
      };
    case 'heroeArrebatado': {
      const nombreHeroe = nombreCarta(e.carta);
      return {
        cartas,
        origen: `grupo:${e.de}`,
        destino: `grupo:${e.jugador}`,
        texto: soyYo(e.jugador)
          ? t('animacion.arrebatarYo', { carta: nombreHeroe, de: nombre(e.de) })
          : soyYo(e.de)
            ? t('animacion.arrebatarAMi', { nombre: nombre(e.jugador), carta: nombreHeroe })
            : t('animacion.arrebatar', {
                nombre: nombre(e.jugador),
                carta: nombreHeroe,
                de: nombre(e.de),
              }),
      };
    }
    case 'heroeMovido':
      return {
        cartas,
        origen: `grupo:${e.de}`,
        destino: `grupo:${e.a}`,
        texto: t('animacion.mover', {
          carta: nombreCarta(e.carta),
          de: nombre(e.de),
          a: nombre(e.a),
        }),
      };
  }
}
