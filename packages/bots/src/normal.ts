/**
 * Bot normal: heurísticas por prioridades sobre la información visible.
 *   1. Ganar si puede (Monstruo decisivo, Grupo completo).
 *   2. Atacar Monstruos con buena probabilidad.
 *   3. Jugar Héroes de clases que faltan y tirar por los efectos más útiles.
 *   4. Objetos (máscaras útiles, malditos al rival más peligroso), Magias.
 *   5. Desafiar cartas peligrosas; Modificadores solo si cambian el resultado a su favor.
 *   6. En las decisiones de efectos, perjudicar al rival más peligroso y perder lo menos valioso.
 */
import { DEFINICIONES_EFECTOS, type RangoTirada } from '@hts/cards';
import type { Accion, DecisionVista, PendienteVista, Respuesta, Tirada, Uid } from '@hts/engine';
import { Analisis, probAlMenos, probRango, valorEnMano, valorPrograma } from './analisis';
import type { Bot, EntradaBot } from './tipos';

type Ventana = Extract<PendienteVista, { tipo: 'ventanaModificadores' }>;

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const enRango = (total: number, r: RangoTirada): boolean =>
  r.tipo === 'min' ? total >= r.valor : total <= r.valor;

function mejor<T>(
  lista: readonly T[],
  puntuar: (x: T) => number,
  azar: () => number,
): { x: T; p: number } | null {
  let res: { x: T; p: number } | null = null;
  for (const x of lista) {
    // Desempate aleatorio pequeño para no ser totalmente predecible.
    const p = puntuar(x) + azar() * 0.01;
    if (res === null || p > res.p) res = { x, p };
  }
  return res;
}

// ---------------------------------------------------------------------------------------------
// Turno propio
// ---------------------------------------------------------------------------------------------

function puntuarAccionDeTurno(a: Analisis, accion: Accion): number {
  const { yo, vista } = a;
  const misClases = a.clases(yo);
  switch (accion.tipo) {
    case 'FIN_TURNO':
      return 0;
    case 'ROBAR':
      return 9;
    case 'RENOVAR_MANO':
      return yo.mano !== null && yo.mano.length <= 1 && vista.turno.pa >= 3 ? 12 : -5;
    case 'USAR_HABILIDAD':
      return a.rivales.some((r) => r.cartasEnMano > 0) ? 14 : -1;
    case 'ATACAR': {
      const m = a.carta(accion.uid);
      if (m?.tipo !== 'monstruo') return -1;
      const bono = a.bono(yo.id, 'ataque');
      const pExito = probRango(m.exito.rango, bono);
      const pFracaso = probRango(m.fracaso.rango, bono);
      const coste = m.fracaso.accion.tipo === 'sacrificar' ? 45 : 20;
      const premio = a.ganaConUnMonstruo(yo) ? 600 : 110;
      return pExito * premio - pFracaso * coste - 15;
    }
    case 'TIRAR_HEROE': {
      const h = a.carta(accion.uid);
      if (h?.tipo !== 'heroe') return -1;
      const p = probAlMenos(h.tirada, a.bono(yo.id, 'heroe', accion.uid));
      return p * valorPrograma(DEFINICIONES_EFECTOS[h.id]?.programa) - 4;
    }
    case 'JUGAR_CARTA': {
      const c = a.carta(accion.uid);
      if (c === undefined) return -1;
      if (c.tipo === 'heroe') {
        const nueva = !misClases.has(c.clase);
        const completa = nueva && a.ganaConClases(yo, misClases.size + 1);
        const pEfecto = probAlMenos(c.tirada, a.bono(yo.id, 'heroe'));
        return (
          22 +
          (nueva ? 30 : 0) +
          (completa ? 500 : 0) +
          pEfecto * valorPrograma(DEFINICIONES_EFECTOS[c.id]?.programa) * 0.6
        );
      }
      if (c.tipo === 'magia') {
        const v = valorPrograma(DEFINICIONES_EFECTOS[c.id]?.programa);
        const hayHeroesRivales = a.rivales.some((r) => r.grupo.length > 0);
        return 10 + v * (hayHeroesRivales ? 0.8 : 0.4);
      }
      if ((c.tipo === 'objeto' || c.tipo === 'objeto_maldito') && accion.objetivo !== undefined) {
        const dueno = a.vista.jugadores.find((j) =>
          j.grupo.some((r) => r.heroe === accion.objetivo),
        );
        if (dueno === undefined) return -1;
        const propio = dueno.id === yo.id;
        if (c.tipo === 'objeto_maldito') {
          return propio ? -50 : 14 + a.amenaza(dueno) / 6;
        }
        if (!propio) return -50;
        if (c.otorgaClase !== undefined) {
          const ranura = yo.grupo.find((r) => r.heroe === accion.objetivo);
          if (ranura === undefined) return -1;
          // ¿Aumenta el número de clases distintas?
          const sin = new Set(
            yo.grupo.filter((r) => r !== ranura).map((r) => a.claseDeHeroe(r.heroe, r.objeto)),
          );
          const lider = a.carta(yo.lider);
          if (lider?.tipo === 'lider') sin.add(lider.clase);
          const antes = misClases.size;
          sin.add(c.otorgaClase);
          const despues = sin.size;
          const completa = a.ganaConClases(yo, despues);
          return despues > antes ? 35 + (completa ? 500 : 0) : -10;
        }
        return 18;
      }
      return -1;
    }
    default:
      return -1;
  }
}

// ---------------------------------------------------------------------------------------------
// Ventanas de respuesta
// ---------------------------------------------------------------------------------------------

function decidirDesafio(a: Analisis, legales: readonly Accion[]): Accion | null {
  const ventana = a.cima;
  const pasar = legales.find((x) => x.tipo === 'PASAR') ?? null;
  const desafio = legales.find((x) => x.tipo === 'DESAFIAR');
  if (ventana?.tipo !== 'ventanaDesafio' || desafio === undefined) return pasar;
  const dueno = a.jugador(ventana.jugada.jugador);
  const c = a.carta(ventana.jugada.uid);
  if (dueno === undefined || c === undefined) return pasar;

  let peligro = 0;
  const lider = a.rivalLider;
  if (lider?.id === dueno.id && a.amenaza(dueno) >= a.amenaza(a.yo)) peligro += 15;
  if (c.tipo === 'heroe') {
    const clases = a.clases(dueno);
    if (!clases.has(c.clase)) peligro += 15;
    if (!clases.has(c.clase) && a.ganaConClases(dueno, clases.size + 1)) peligro += 100;
    peligro += valorPrograma(DEFINICIONES_EFECTOS[c.id]?.programa) / 3;
  } else if (c.tipo === 'magia') {
    peligro += 10 + valorPrograma(DEFINICIONES_EFECTOS[c.id]?.programa) / 2;
  } else if (ventana.jugada.tipo === 'objeto') {
    const objetivo = ventana.jugada.objetivo;
    const victima = a.vista.jugadores.find((j) => j.grupo.some((r) => r.heroe === objetivo));
    if (c.tipo === 'objeto_maldito' && victima?.id === a.yo.id) peligro += 40;
    if (c.tipo === 'objeto' && c.otorgaClase !== undefined) peligro += 20;
  }
  return peligro >= 40 ? desafio : pasar;
}

/** Puntuación (para mí) del resultado de una ventana con estos totales. Más alto = mejor. */
function puntuarResultado(a: Analisis, ventana: Ventana, totales: number[]): number {
  const yo = a.yo.id;
  const [t0] = ventana.tiradas;
  const total0 = totales[0] ?? 0;
  const ctx = ventana.contexto;
  if (t0 === undefined) return 0;
  const importa = (jugador: string): boolean => {
    const j = a.jugador(jugador);
    return j !== undefined && a.amenaza(j) >= a.amenaza(a.yo) - 10;
  };
  switch (ctx.tipo) {
    case 'heroe': {
      const h = a.carta(ctx.heroe);
      const exito = h?.tipo === 'heroe' && total0 >= h.tirada;
      if (t0.jugador === yo) return exito ? 1 : 0;
      return importa(t0.jugador) ? (exito ? 0 : 1) : 0;
    }
    case 'ataque': {
      const m = a.carta(ctx.monstruo);
      if (m?.tipo !== 'monstruo') return 0;
      const exito = enRango(total0, m.exito.rango);
      const fracaso = enRango(total0, m.fracaso.rango);
      const nivel = exito ? 2 : fracaso ? 0 : 1;
      return t0.jugador === yo ? nivel : 2 - nivel;
    }
    case 'desafio': {
      const total1 = totales[1] ?? 0;
      const ganaDesafiante = total1 >= total0;
      if (ctx.desafiante === yo) return ganaDesafiante ? 1 : 0;
      if (ctx.jugada.jugador === yo) return ganaDesafiante ? 0 : 1;
      return importa(ctx.jugada.jugador) ? (ganaDesafiante ? 1 : 0) : 0;
    }
  }
}

function totalesActuales(a: Analisis, ventana: Ventana): number[] {
  const ctx = ventana.contexto;
  const contexto = ctx.tipo === 'heroe' ? 'heroe' : ctx.tipo === 'ataque' ? 'ataque' : 'desafio';
  const heroe = ctx.tipo === 'heroe' ? ctx.heroe : undefined;
  return ventana.tiradas.map(
    (t: Tirada) =>
      t.dados[0] +
      t.dados[1] +
      t.modificaciones.reduce((s, m) => s + m.valor, 0) +
      a.bono(t.jugador, contexto, heroe, t),
  );
}

function decidirModificador(a: Analisis, legales: readonly Accion[]): Accion | null {
  const ventana = a.cima;
  if (ventana?.tipo !== 'ventanaModificadores') return null;
  const totales = totalesActuales(a, ventana);
  const actual = puntuarResultado(a, ventana, totales);
  let elegido: { accion: Accion; mejora: number; coste: number } | null = null;
  for (const accion of legales) {
    if (accion.tipo !== 'JUGAR_MODIFICADOR') continue;
    const nuevos = totales.map((t, i) => (i === accion.tirada ? t + accion.valor : t));
    const mejora = puntuarResultado(a, ventana, nuevos) - actual;
    const coste = Math.abs(accion.valor);
    if (
      mejora > 0 &&
      (elegido === null ||
        mejora > elegido.mejora ||
        (mejora === elegido.mejora && coste < elegido.coste))
    ) {
      elegido = { accion, mejora, coste };
    }
  }
  return elegido?.accion ?? null;
}

// ---------------------------------------------------------------------------------------------
// Decisiones de efectos
// ---------------------------------------------------------------------------------------------

/** Valor para mí de un Héroe (en cualquier Grupo): positivo si es mío, según lo que aporta. */
function valorHeroe(a: Analisis, heroe: Uid): number {
  const dueno = a.vista.jugadores.find((j) => j.grupo.some((r) => r.heroe === heroe));
  const ranura = dueno?.grupo.find((r) => r.heroe === heroe);
  if (dueno === undefined || ranura === undefined) return 0;
  const clase = a.claseDeHeroe(heroe, ranura.objeto);
  const repetida =
    dueno.grupo.filter((r) => r !== ranura && a.claseDeHeroe(r.heroe, r.objeto) === clase).length >
    0;
  const c = a.carta(heroe);
  const efecto = c?.tipo === 'heroe' ? valorPrograma(DEFINICIONES_EFECTOS[c.id]?.programa) : 0;
  return (repetida ? 10 : 30) + efecto / 2 + (ranura.objeto === null ? 0 : 5);
}

/** Cuánto me conviene que el Héroe `heroe` deje de estar en su Grupo actual. */
function interesEnQuitar(a: Analisis, heroe: Uid): number {
  const dueno = a.vista.jugadores.find((j) => j.grupo.some((r) => r.heroe === heroe));
  if (dueno === undefined || dueno.id === a.yo.id) return -100;
  return valorHeroe(a, heroe) + a.amenaza(dueno);
}

function respuestaPreferida(a: Analisis, d: DecisionVista, azar: () => number): Respuesta | null {
  const p = d.pregunta;
  if (p === null) return null;
  const porValor = (uids: readonly Uid[], f: (u: Uid) => number, n: number, asc: boolean): Uid[] =>
    [...uids].sort((x, y) => (asc ? f(x) - f(y) : f(y) - f(x))).slice(0, n);

  switch (p.tipo) {
    case 'ver':
      return { ok: true };
    case 'confirmar':
      return { si: true };
    case 'oculta':
      return { indice: Math.floor(azar() * p.cartas) };
    case 'valor': {
      const ventana = [...a.vista.pila]
        .reverse()
        .find((x): x is Ventana => x.tipo === 'ventanaModificadores');
      const mia = ventana?.tiradas.some((t) => t.jugador === a.yo.id) ?? false;
      return { valor: mia ? Math.max(...p.opciones) : Math.min(...p.opciones) };
    }
    case 'jugador': {
      // Intercambiar manos: con quien más cartas tenga; en general, contra el rival más peligroso.
      const puntuar = (id: string): number => {
        const j = a.jugador(id);
        if (j === undefined) return -1;
        return d.carta === 'heroe_dodgy_dealer'
          ? j.cartasEnMano
          : a.amenaza(j) + j.cartasEnMano + j.grupo.length * 3;
      };
      const elegido = porValor(p.opciones, puntuar, 1, false)[0];
      return elegido === undefined ? null : { jugador: elegido };
    }
    case 'cartas': {
      const valorMano = (u: Uid): number => valorEnMano(a.carta(u));
      let n = p.min;
      let orden: Uid[];
      switch (d.motivo) {
        case 'destruir':
        case 'arrebatar':
          orden = porValor(p.opciones, (u) => interesEnQuitar(a, u), p.opciones.length, false);
          break;
        case 'objetivoObjeto': {
          // Los Objetos que se juegan así son de la mano propia: a un Héroe propio.
          orden = porValor(
            p.opciones,
            (u) => {
              const dueno = a.vista.jugadores.find((j) => j.grupo.some((r) => r.heroe === u));
              return dueno?.id === a.yo.id ? 10 : interesEnQuitar(a, u) / 10;
            },
            p.opciones.length,
            false,
          );
          break;
        }
        case 'sacrificar':
        case 'darHeroe':
          orden = porValor(p.opciones, (u) => valorHeroe(a, u), p.opciones.length, true);
          break;
        case 'descartar':
        case 'dar':
          orden = porValor(p.opciones, valorMano, p.opciones.length, true);
          if (d.carta === 'heroe_qi_bear') {
            // Descarta cartas poco valiosas hasta el número de Héroes rivales destruibles.
            const objetivos = a.rivales.reduce((s, r) => s + r.grupo.length, 0);
            n = Math.min(p.max, objetivos, orden.filter((u) => valorMano(u) < 22).length);
          }
          break;
        case 'devolverObjeto':
          orden = porValor(
            p.opciones,
            (u) => {
              const dueno = a.vista.jugadores.find((j) => j.grupo.some((r) => r.objeto === u));
              const maldito = a.carta(u)?.tipo === 'objeto_maldito';
              return dueno?.id === a.yo.id ? (maldito ? 20 : -5) : maldito ? -5 : 10;
            },
            p.opciones.length,
            false,
          );
          break;
        case 'jugarInmediato':
          orden = porValor(p.opciones, valorMano, p.opciones.length, false);
          n = Math.max(p.min, Math.min(1, p.max));
          break;
        case 'ordenarMazo':
          orden = [...p.opciones];
          n = p.opciones.length;
          break;
        default:
          // tomarDeMano, recuperarDescarte, elegirDelMazo…: lo más valioso.
          orden = porValor(p.opciones, valorMano, p.opciones.length, false);
          n = Math.max(p.min, Math.min(1, p.max));
      }
      return { cartas: orden.slice(0, Math.max(p.min, Math.min(n, p.max))) };
    }
  }
}

// ---------------------------------------------------------------------------------------------

export const botNormal: Bot = {
  nivel: 'normal',
  elegir(entrada: EntradaBot): Accion | null {
    const { legales, azar } = entrada;
    if (legales.length === 0) return null;
    const a = new Analisis(entrada);
    const cima = a.cima;

    if (cima?.tipo === 'ventanaDesafio') return decidirDesafio(a, legales);
    if (cima?.tipo === 'ventanaModificadores') return decidirModificador(a, legales);
    if (cima?.tipo === 'tiradaInmediata') {
      return legales.find((x) => x.tipo === 'TIRADA_INMEDIATA' && x.tirar) ?? legales[0] ?? null;
    }
    if (cima?.tipo === 'elegir') {
      const opciones = legales.filter(
        (x): x is Extract<Accion, { tipo: 'ELEGIR' }> => x.tipo === 'ELEGIR',
      );
      const valor = (u: Uid): number =>
        cima.accion === 'sacrificar' ? valorHeroe(a, u) : valorEnMano(a.carta(u));
      return mejor(opciones, (x) => -x.uids.reduce((s, u) => s + valor(u), 0), azar)?.x ?? null;
    }
    if (cima?.tipo === 'decision') {
      const preferida = respuestaPreferida(a, cima, azar);
      const legal = legales.find((x) => x.tipo === 'RESPONDER' && igual(x.respuesta, preferida));
      return legal ?? legales[Math.floor(azar() * legales.length)] ?? null;
    }
    // Turno propio.
    return mejor(legales, (x) => puntuarAccionDeTurno(a, x), azar)?.x ?? null;
  },
};
