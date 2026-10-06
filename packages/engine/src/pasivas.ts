/**
 * Habilidades permanentes de Líderes, Monstruos matados y Objetos equipados (definidas como
 * `pasivas` en el DSL): bonos de tirada, restricciones, reemplazos y disparadores.
 */
import type { Carta, Pasiva, TipoFiltro } from '@hts/cards';
import { buscarRanura, cartaDe, idCarta } from './consultas';
import type { Ctx } from './efectos';
import { apilarMarco, type DatosMarco } from './marcos';
import type {
  Bono,
  ContextoTirada,
  Emitir,
  GameState,
  Jugada,
  Jugador,
  JugadorId,
  Ranura,
  Tirada,
  TipoTemporal,
  Uid,
} from './tipos';

export interface PasivaActiva {
  pasiva: Pasiva;
  indice: number;
  /** Id de catálogo de la carta que tiene la pasiva. */
  carta: string;
  uid: Uid;
  dueno: Jugador;
  /** Si la pasiva es de un Objeto, el Héroe que lo lleva equipado. */
  heroe: Uid | null;
}

export function coincideTipo(carta: Carta, tipos: readonly TipoFiltro[]): boolean {
  return tipos.some((t) =>
    t === 'objeto' ? carta.tipo === 'objeto' || carta.tipo === 'objeto_maldito' : carta.tipo === t,
  );
}

function pasivasDeCarta(
  ctx: Ctx,
  d: GameState,
  uid: Uid,
  dueno: Jugador,
  heroe: Uid | null,
): PasivaActiva[] {
  const carta = idCarta(d, uid);
  const pasivas = ctx.definiciones[carta]?.pasivas ?? [];
  return pasivas.map((pasiva, indice) => ({ pasiva, indice, carta, uid, dueno, heroe }));
}

/** Pasivas activas de un jugador: su Líder, sus Monstruos y los Objetos equipados a sus Héroes. */
export function pasivasDeJugador(ctx: Ctx, d: GameState, j: Jugador): PasivaActiva[] {
  const resultado = [
    ...pasivasDeCarta(ctx, d, j.lider, j, null),
    ...j.monstruos.flatMap((m) => pasivasDeCarta(ctx, d, m, j, null)),
  ];
  for (const r of j.grupo) {
    if (r.objeto !== null) resultado.push(...pasivasDeCarta(ctx, d, r.objeto, j, r.heroe));
  }
  return resultado;
}

/** Todas las pasivas activas, empezando por el jugador del turno y en sentido horario. */
export function todasLasPasivas(ctx: Ctx, d: GameState): PasivaActiva[] {
  const i = d.jugadores.findIndex((j) => j.id === d.turno.jugador);
  const orden = [...d.jugadores.slice(i), ...d.jugadores.slice(0, i)];
  // D-43: el Líder y los Monstruos de quien se ha rendido ya no tienen efecto.
  return orden
    .filter((j) => !d.rendidos.includes(j.id))
    .flatMap((j) => pasivasDeJugador(ctx, d, j));
}

function tieneRegla(
  ctx: Ctx,
  d: GameState,
  j: Jugador,
  tipo: 'restriccion' | 'reemplazo',
  regla: string,
): boolean {
  return pasivasDeJugador(ctx, d, j).some(
    (p) => p.heroe === null && p.pasiva.tipo === tipo && p.pasiva.regla === regla,
  );
}

export function temporalActivo(d: GameState, jugador: JugadorId, tipo: TipoTemporal): boolean {
  return d.temporales.some((t) => t.jugador === jugador && t.tipo === tipo);
}

/** Terratuga y Mighty Blade. */
export function puedeSerDestruido(ctx: Ctx, d: GameState, dueno: Jugador): boolean {
  return (
    !tieneRegla(ctx, d, dueno, 'restriccion', 'heroesNoDestruibles') &&
    !temporalActivo(d, dueno.id, 'noDestruible')
  );
}

/** Calming Voice. */
export function puedeSerArrebatado(d: GameState, dueno: Jugador): boolean {
  return !temporalActivo(d, dueno.id, 'noArrebatable');
}

/** Iron Resolve y Osolechuza Veterano. */
export function jugadaIndesafiable(ctx: Ctx, d: GameState, jugada: Jugada): boolean {
  if (temporalActivo(d, jugada.jugador, 'noDesafiable')) return true;
  const j = d.jugadores.find((x) => x.id === jugada.jugador);
  return (
    jugada.tipo === 'objeto' &&
    j !== undefined &&
    tieneRegla(ctx, d, j, 'restriccion', 'objetosNoDesafiables')
  );
}

/** Dientes de Sable Corrupto. */
export function puedeArrebatarEnLugarDeDestruir(ctx: Ctx, d: GameState, j: Jugador): boolean {
  return tieneRegla(ctx, d, j, 'reemplazo', 'destruirPorArrebatar');
}

function objetoTiene(ctx: Ctx, d: GameState, ranura: Ranura, tipo: string, regla: string): boolean {
  if (ranura.objeto === null) return false;
  const pasivas = ctx.definiciones[idCarta(d, ranura.objeto)]?.pasivas ?? [];
  return pasivas.some((p) => p.tipo === tipo && 'regla' in p && p.regla === regla);
}

/** Llave Selladora: no se puede usar el efecto del Héroe equipado. */
export function heroeSellado(ctx: Ctx, d: GameState, heroe: Uid): boolean {
  const ub = buscarRanura(d, heroe);
  return ub !== null && objetoTiene(ctx, d, ub.ranura, 'restriccion', 'sinEfectoEquipado');
}

/** Muñeco Señuelo. */
export function tieneSenuelo(ctx: Ctx, d: GameState, ranura: Ranura): boolean {
  return objetoTiene(ctx, d, ranura, 'reemplazo', 'senuelo');
}

/** PA adicionales por turno (Megababosa). */
export function paExtra(ctx: Ctx, d: GameState, j: Jugador): number {
  return pasivasDeJugador(ctx, d, j).reduce(
    (n, p) => n + (p.pasiva.tipo === 'paExtra' ? p.pasiva.valor : 0),
    0,
  );
}

/** Habilidad de una carta propia (Líder o Monstruo) que se usa como acción. */
export function habilidadDe(ctx: Ctx, d: GameState, j: Jugador, uid: Uid): PasivaActiva | null {
  if (uid !== j.lider && !j.monstruos.includes(uid)) return null;
  return pasivasDeCarta(ctx, d, uid, j, null).find((p) => p.pasiva.tipo === 'habilidad') ?? null;
}

/**
 * Bonos de pasivas y efectos temporales que se suman a una tirada.
 */
export function bonosDeTirada(
  ctx: Ctx,
  d: GameState,
  tirada: Tirada,
  contexto: ContextoTirada,
): Bono[] {
  const j = d.jugadores.find((x) => x.id === tirada.jugador);
  if (j === undefined) return [];
  const bonos: Bono[] = [];
  for (const pa of pasivasDeJugador(ctx, d, j)) {
    const p = pa.pasiva;
    if (p.tipo === 'bonoTirada') {
      if (p.soloHeroeEquipado && !(contexto.tipo === 'heroe' && pa.heroe === contexto.heroe))
        continue;
      const aplica =
        p.contexto === 'cualquiera' ||
        (p.contexto === 'heroe' && contexto.tipo === 'heroe') ||
        (p.contexto === 'ataque' && contexto.tipo === 'ataque') ||
        // D-33: los bonos de desafío cuentan tanto si desafías como si te desafían.
        (p.contexto === 'desafio' && contexto.tipo === 'desafio');
      if (aplica) bonos.push({ carta: pa.carta, valor: p.valor });
    } else if (p.tipo === 'bonoPorModificadorRival') {
      const n = tirada.modificaciones.filter((m) => m.uid !== null && m.jugador !== j.id).length;
      if (n > 0) bonos.push({ carta: pa.carta, valor: p.valor * n });
    }
  }
  for (const t of d.temporales) {
    if (t.jugador === j.id && t.tipo === 'bonoTirada')
      bonos.push({ carta: t.carta, valor: t.valor });
  }
  return bonos;
}

/** Sucesos que pueden activar disparadores. */
export type Suceso =
  | { tipo: 'robo'; jugador: JugadorId; uid: Uid }
  | { tipo: 'magiaJugada'; jugador: JugadorId }
  | { tipo: 'modificadorJugado'; jugador: JugadorId; tirada: number }
  | { tipo: 'desafiado'; desafiado: JugadorId; desafiante: JugadorId }
  | { tipo: 'heroeDestruido'; dueno: JugadorId }
  | { tipo: 'tiradaHeroe'; jugador: JugadorId; heroe: Uid; exito: boolean };

function marcoSiCoincide(ctx: Ctx, d: GameState, pa: PasivaActiva, s: Suceso): DatosMarco | null {
  const p = pa.pasiva;
  if (p.tipo !== 'disparador') return null;
  const marco = (vars: DatosMarco['vars'] = {}): DatosMarco => ({
    jugador: pa.dueno.id,
    fuente: pa.uid,
    carta: pa.carta,
    pasiva: pa.indice,
    vars,
  });
  const esDueno = (id: JugadorId): boolean => pa.dueno.id === id;
  switch (p.evento) {
    case 'robas':
      if (s.tipo !== 'robo' || !esDueno(s.jugador)) return null;
      if (p.tipos !== undefined && !coincideTipo(cartaDe(ctx.catalogo, d, s.uid), p.tipos))
        return null;
      return marco({ carta: [s.uid] });
    case 'juegasMagia':
      return s.tipo === 'magiaJugada' && esDueno(s.jugador) ? marco() : null;
    case 'cualquieraJuegaModificador':
      return s.tipo === 'modificadorJugado' ? marco() : null;
    case 'juegasModificador':
      return s.tipo === 'modificadorJugado' && esDueno(s.jugador)
        ? marco({ tirada: s.tirada })
        : null;
    case 'teDesafian':
      return s.tipo === 'desafiado' && esDueno(s.desafiado)
        ? marco({ desafiante: s.desafiante })
        : null;
    case 'heroePropioDestruido':
      return s.tipo === 'heroeDestruido' && esDueno(s.dueno) ? marco() : null;
    case 'exitoTiradaHeroe':
      return s.tipo === 'tiradaHeroe' && s.exito && esDueno(s.jugador) && pa.heroe === null
        ? marco()
        : null;
    case 'exitoTiradaEquipado':
      return s.tipo === 'tiradaHeroe' && s.exito && pa.heroe === s.heroe ? marco() : null;
    case 'falloTiradaEquipado':
      return s.tipo === 'tiradaHeroe' && !s.exito && pa.heroe === s.heroe ? marco() : null;
  }
}

/**
 * Apila los disparadores que activan los sucesos, de modo que se ejecuten en el orden de los
 * sucesos y, para cada suceso, empezando por el jugador del turno (R-082, R-083).
 */
export function notificar(
  ctx: Ctx,
  d: GameState,
  sucesos: readonly Suceso[],
  emitir: Emitir,
): void {
  if (sucesos.length === 0) return;
  const pasivas = todasLasPasivas(ctx, d);
  const marcos: DatosMarco[] = [];
  for (const s of sucesos) {
    for (const pa of pasivas) {
      const m = marcoSiCoincide(ctx, d, pa, s);
      if (m !== null) marcos.push(m);
    }
  }
  // `disparadorActivado` y `liderActivado` se emiten al apilar el disparador, no cuando su programa
  // actúa: el efecto se resuelve a continuación (o después del efecto de la carta, D-37), sin
  // posibilidad de cancelarlo, así que el anuncio va en el orden del suceso que lo activa.
  for (const m of marcos) {
    emitir({ tipo: 'disparadorActivado', jugador: m.jugador, carta: m.carta });
    if (d.jugadores.some((j) => j.id === m.jugador && j.lider === m.fuente)) {
      emitir({ tipo: 'liderActivado', jugador: m.jugador, carta: m.carta });
    }
  }
  for (const m of [...marcos].reverse()) apilarMarco(d, m);
}
