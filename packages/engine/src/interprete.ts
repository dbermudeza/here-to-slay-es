/**
 * Intérprete del DSL de efectos. Ejecuta el marco de efecto de la cima de la pila paso a paso.
 * Cuando un paso necesita una decisión, apila una pregunta y devuelve 'esperar'; al responderla,
 * el mismo paso continúa con su fase interna (`f.sub`).
 */
import type { Clase, Condicion, Paso, Programa } from '@hts/cards';
import {
  buscarJugador,
  buscarRanura,
  cartaDe,
  cimaPila,
  clasesDelGrupo,
  ErrorInterno,
  idCarta,
  jugador,
} from './consultas';
import type { EntornoPaso, ResultadoPaso, Ctx } from './efectos';
import { iniciarJugada, iniciarTiradaHeroe } from './flujo';
import { arrebatarHeroe, destruirHeroe, moverHeroe, robarCartas, sacrificarHeroe } from './grupo';
import { barajar, descartarDeMano, quitar } from './ops';
import {
  coincideTipo,
  heroeSellado,
  puedeArrebatarEnLugarDeDestruir,
  puedeSerArrebatado,
  puedeSerDestruido,
} from './pasivas';
import type {
  Emitir,
  GameState,
  Jugada,
  Jugador,
  JugadorId,
  MarcoEfecto,
  MotivoPregunta,
  Pregunta,
  Uid,
  Valor,
} from './tipos';

const MAX_PASOS = 100_000;

function programaDe(ctx: Ctx, f: MarcoEfecto): Programa {
  const def = ctx.definiciones[f.carta];
  if (f.pasiva === null) return def?.programa ?? [];
  const pasiva = def?.pasivas?.[f.pasiva];
  return pasiva !== undefined && (pasiva.tipo === 'disparador' || pasiva.tipo === 'habilidad')
    ? pasiva.programa
    : [];
}

function siguientePaso(f: MarcoEfecto): void {
  f.pc += 1;
  f.sub = 0;
  f.i = 0;
  f.cola = [];
  f.respuesta = null;
}

const comoLista = (v: Valor): string[] => (Array.isArray(v) ? v : []);

function lista(f: MarcoEfecto, nombre: string | undefined): Uid[] {
  return nombre === undefined ? [] : comoLista(f.vars[nombre] ?? null);
}

function agregar(f: MarcoEfecto, nombre: string | undefined, uids: readonly Uid[]): void {
  if (nombre !== undefined) f.vars[nombre] = [...lista(f, nombre), ...uids];
}

function jugadorVar(d: GameState, f: MarcoEfecto, nombre: string): Jugador | null {
  const v = f.vars[nombre];
  return typeof v === 'string' ? (buscarJugador(d, v) ?? null) : null;
}

function tomarRespuesta(f: MarcoEfecto): Valor {
  const r = f.respuesta;
  f.respuesta = null;
  return r;
}

function cumple(ctx: Ctx, d: GameState, f: MarcoEfecto, c: Condicion): boolean {
  const v = f.vars[c.var] ?? null;
  if (c.tipos !== undefined) {
    const tipos = c.tipos;
    return comoLista(v).some((uid) => coincideTipo(cartaDe(ctx.catalogo, d, uid), tipos));
  }
  return v === true || (Array.isArray(v) && v.length > 0) || (typeof v === 'string' && v !== '');
}

function preguntar(
  e: EntornoPaso,
  jugadorId: JugadorId,
  motivo: MotivoPregunta,
  pregunta: Pregunta,
): ResultadoPaso {
  e.d.pila.push({
    tipo: 'decision',
    jugador: jugadorId,
    efecto: e.f.id,
    carta: e.f.carta,
    motivo,
    pregunta,
  });
  e.emitir({ tipo: 'esperandoDecision', jugador: jugadorId, carta: e.f.carta, motivo });
  return 'esperar';
}

/**
 * Patrón común: `jugadorId` elige entre `min` y `max` cartas de `opciones` y se aplica `alElegir`.
 * Sin opciones, se aplica con []. Si la elección es forzosa (todas), se aplica sin preguntar.
 */
function elegirCartas(
  e: EntornoPaso,
  jugadorId: JugadorId,
  motivo: MotivoPregunta,
  opciones: Uid[],
  min: number,
  max: number,
  alElegir: (uids: Uid[]) => void,
  /** Pregunta aunque la elección sea forzosa: el jugador debe ver las cartas (mirar una mano). */
  siempreMostrar = false,
): ResultadoPaso {
  const { f } = e;
  if (f.sub === 1) {
    alElegir(comoLista(tomarRespuesta(f)));
    return 'siguiente';
  }
  const mx = Math.min(max, opciones.length);
  const mn = Math.min(min, mx);
  if (mx === 0) {
    alElegir([]);
    return 'siguiente';
  }
  if (!siempreMostrar && mn === mx && mx === opciones.length) {
    alElegir([...opciones]);
    return 'siguiente';
  }
  f.sub = 1;
  return preguntar(e, jugadorId, motivo, {
    tipo: 'cartas',
    opciones,
    min: mn,
    max: mx,
    ordenado: false,
  });
}

/** Los demás jugadores en sentido horario, sin los que se han rendido (D-43). */
function otros(d: GameState, yo: Jugador): Jugador[] {
  const i = d.jugadores.indexOf(yo);
  return [...d.jugadores.slice(i + 1), ...d.jugadores.slice(0, i)].filter(
    (j) => !d.rendidos.includes(j.id),
  );
}

function heroesArrebatables(d: GameState, yo: Jugador, de: Jugador | null): Uid[] {
  return (de === null ? otros(d, yo) : [de])
    .filter((j) => j !== yo && puedeSerArrebatado(d, j))
    .flatMap((j) => j.grupo.map((r) => r.heroe));
}

function heroesDestruibles(ctx: Ctx, d: GameState, yo: Jugador): Uid[] {
  return otros(d, yo)
    .filter((j) => puedeSerDestruido(ctx, d, j))
    .flatMap((j) => j.grupo.map((r) => r.heroe));
}

function tieneClase(ctx: Ctx, d: GameState, j: Jugador, clase: Clase | undefined): boolean {
  return clase === undefined || clasesDelGrupo(ctx.catalogo, d, j).has(clase);
}

function emitirSinObjetivos(e: EntornoPaso): void {
  e.emitir({ tipo: 'sinObjetivos', jugador: e.f.jugador, carta: e.f.carta });
}

function moverDeMano(de: Jugador, a: Jugador, uid: Uid): void {
  if (quitar(de.mano, uid)) a.mano.push(uid);
}

function sacarCarta(
  e: EntornoPaso,
  yo: Jugador,
  de: Jugador,
  indice: number,
  var_: string | undefined,
): void {
  const mezcla = [...de.mano];
  // R-097: la posición elegida entre los reversos no da información: se baraja la mano.
  barajar(e.d, mezcla);
  const uid = mezcla[Math.min(Math.max(indice, 0), mezcla.length - 1)];
  if (uid === undefined) return;
  moverDeMano(de, yo, uid);
  e.emitir({ tipo: 'cartaSacada', jugador: yo.id, de: de.id, uid, carta: idCarta(e.d, uid) });
  agregar(e.f, var_, [uid]);
}

type PasoDe<T extends Paso['paso']> = Extract<Paso, { paso: T }>;

/** SACAR (posiblemente varias veces, a varios jugadores) usando la cola del marco. */
function sacarDeCola(e: EntornoPaso, yo: Jugador, var_: string | undefined): ResultadoPaso {
  const { f, d } = e;
  if (f.sub === 2) {
    const de = buscarJugador(d, f.cola[f.i] ?? '');
    const r = tomarRespuesta(f);
    if (de !== undefined && typeof r === 'number') sacarCarta(e, yo, de, r, var_);
    f.i += 1;
    f.sub = 1;
  }
  while (f.i < f.cola.length) {
    const de = buscarJugador(d, f.cola[f.i] ?? '');
    if (de === undefined || de.mano.length === 0) {
      f.i += 1;
      continue;
    }
    if (de.mano.length === 1) {
      sacarCarta(e, yo, de, 0, var_);
      f.i += 1;
      continue;
    }
    f.sub = 2;
    return preguntar(e, yo.id, 'sacar', { tipo: 'oculta', de: de.id, cartas: de.mano.length });
  }
  return 'siguiente';
}

function pasoJugadorDebe(e: EntornoPaso, yo: Jugador, p: PasoDe<'jugadorDebe'>): ResultadoPaso {
  const { f, d, ctx } = e;
  const opcionesDe = (v: Jugador): Uid[] =>
    p.accion === 'sacrificar' ? v.grupo.map((r) => r.heroe) : [...v.mano];
  const aplicar = (v: Jugador, uids: Uid[]): void => {
    if (p.accion === 'descartar') {
      descartarDeMano(d, v, uids, e.emitir);
      agregar(f, p.var, uids);
    } else if (p.accion === 'sacrificar') {
      for (const u of uids) sacrificarHeroe(ctx, d, v, u, e.emitir);
    } else {
      for (const u of uids) {
        moverDeMano(v, yo, u);
        e.emitir({ tipo: 'cartaDada', jugador: v.id, a: yo.id, uid: u, carta: idCarta(d, u) });
      }
    }
  };
  if (f.sub === 0) {
    const victimas =
      p.quien === 'cadaOtro'
        ? otros(d, yo)
        : [jugadorVar(d, f, p.quien)].filter((v): v is Jugador => v !== null);
    f.cola = victimas.filter((v) => tieneClase(ctx, d, v, p.conClase)).map((v) => v.id);
    f.sub = 1;
  }
  if (f.sub === 2) {
    const v = buscarJugador(d, f.cola[f.i] ?? '');
    const r = comoLista(tomarRespuesta(f));
    if (v !== undefined) aplicar(v, r);
    f.i += 1;
    f.sub = 1;
  }
  while (f.i < f.cola.length) {
    const v = buscarJugador(d, f.cola[f.i] ?? '');
    const opciones = v === undefined ? [] : opcionesDe(v);
    const n = Math.min(p.cantidad, opciones.length);
    if (v === undefined || n === 0) {
      f.i += 1;
      continue;
    }
    if (n === opciones.length) {
      aplicar(v, opciones);
      f.i += 1;
      continue;
    }
    f.sub = 2;
    return preguntar(e, v.id, p.accion, {
      tipo: 'cartas',
      opciones,
      min: n,
      max: n,
      ordenado: false,
    });
  }
  return 'siguiente';
}

function pasoDestruir(e: EntornoPaso, yo: Jugador, p: PasoDe<'destruir'>): ResultadoPaso {
  const { f, d, ctx } = e;
  const total = typeof p.cantidad === 'number' ? p.cantidad : lista(f, p.cantidad.contar).length;
  for (;;) {
    if (f.sub === 3) {
      const objetivo = f.cola[0];
      const enSuLugar = tomarRespuesta(f) === true;
      if (objetivo !== undefined) {
        if (enSuLugar) arrebatarHeroe(d, yo, objetivo, e.emitir);
        else destruirHeroe(ctx, d, yo, objetivo, p.objetoAMano, e.emitir);
      }
      f.i += 1;
      f.sub = 0;
      continue;
    }
    let objetivo: Uid | undefined;
    if (f.sub === 2) {
      objetivo = comoLista(tomarRespuesta(f))[0];
      f.sub = 0;
    } else {
      if (f.i >= total) return 'siguiente';
      const objetivos = heroesDestruibles(ctx, d, yo);
      if (objetivos.length === 0) {
        emitirSinObjetivos(e);
        return 'siguiente';
      }
      if (objetivos.length > 1) {
        f.sub = 2;
        return preguntar(e, yo.id, 'destruir', {
          tipo: 'cartas',
          opciones: objetivos,
          min: 1,
          max: 1,
          ordenado: false,
        });
      }
      objetivo = objetivos[0];
    }
    if (objetivo === undefined) {
      f.i += 1;
      continue;
    }
    // Dientes de Sable Corrupto: puede ARREBATAR en lugar de DESTRUIR.
    const dueno = buscarRanura(d, objetivo)?.jugador;
    if (
      dueno !== undefined &&
      puedeArrebatarEnLugarDeDestruir(ctx, d, yo) &&
      puedeSerArrebatado(d, dueno)
    ) {
      f.cola = [objetivo];
      f.sub = 3;
      return preguntar(e, yo.id, 'arrebatarEnLugarDeDestruir', { tipo: 'confirmar' });
    }
    destruirHeroe(ctx, d, yo, objetivo, p.objetoAMano, e.emitir);
    f.i += 1;
  }
}

function pasoJugarInmediato(
  e: EntornoPaso,
  yo: Jugador,
  p: PasoDe<'jugarInmediato'>,
): ResultadoPaso {
  const { f, d, ctx } = e;
  const huecos = (): Uid[] =>
    d.jugadores.flatMap((j) => j.grupo.filter((r) => r.objeto === null).map((r) => r.heroe));
  const esObjeto = (uid: Uid): boolean => coincideTipo(cartaDe(ctx.catalogo, d, uid), ['objeto']);

  const jugar = (uid: Uid, objetivo: Uid | undefined): ResultadoPaso => {
    const carta = cartaDe(ctx.catalogo, d, uid);
    let jugada: Jugada;
    if (carta.tipo === 'heroe') jugada = { tipo: 'heroe', jugador: yo.id, uid };
    else if (carta.tipo === 'magia') jugada = { tipo: 'magia', jugador: yo.id, uid };
    else if (objetivo !== undefined) jugada = { tipo: 'objeto', jugador: yo.id, uid, objetivo };
    else return 'siguiente';
    quitar(yo.mano, uid);
    if (p.var !== undefined) f.vars[p.var] = [uid];
    const antes = d.pila.length;
    // D-39: jugar "inmediatamente" no cuesta PA, pero la carta se puede desafiar.
    iniciarJugada(ctx, d, jugada, e.emitir);
    if (d.pila.length > antes) {
      f.sub = 3;
      return 'esperar';
    }
    return 'siguiente';
  };

  const elegirObjetivo = (uid: Uid): ResultadoPaso => {
    const opciones = huecos();
    if (opciones.length === 1) return jugar(uid, opciones[0]);
    f.cola = [uid];
    f.sub = 2;
    return preguntar(e, yo.id, 'objetivoObjeto', {
      tipo: 'cartas',
      opciones,
      min: 1,
      max: 1,
      ordenado: false,
    });
  };

  switch (f.sub) {
    case 3:
      return 'siguiente';
    case 2: {
      const objetivo = comoLista(tomarRespuesta(f))[0];
      const uid = f.cola[0];
      return uid !== undefined && objetivo !== undefined && yo.mano.includes(uid)
        ? jugar(uid, objetivo)
        : 'siguiente';
    }
    case 1: {
      const [uid] = comoLista(tomarRespuesta(f));
      if (uid === undefined) return 'siguiente';
      return esObjeto(uid) ? elegirObjetivo(uid) : jugar(uid, undefined);
    }
  }
  if (p.var !== undefined) f.vars[p.var] = [];
  const base =
    p.deVar === undefined ? [...yo.mano] : lista(f, p.deVar).filter((u) => yo.mano.includes(u));
  const opciones = base.filter(
    (u) =>
      coincideTipo(cartaDe(ctx.catalogo, d, u), p.tipos) && (!esObjeto(u) || huecos().length > 0),
  );
  if (opciones.length === 0) return 'siguiente';
  const [unica] = opciones;
  // D-40: si la elección es forzosa (una sola opción y no es opcional), no se pregunta.
  if (!p.opcional && opciones.length === 1 && unica !== undefined) {
    return esObjeto(unica) ? elegirObjetivo(unica) : jugar(unica, undefined);
  }
  f.sub = 1;
  return preguntar(e, yo.id, 'jugarInmediato', {
    tipo: 'cartas',
    opciones,
    min: p.opcional ? 0 : 1,
    max: 1,
    ordenado: false,
  });
}

function pasoDevolverObjeto(
  e: EntornoPaso,
  yo: Jugador,
  p: PasoDe<'devolverObjeto'>,
): ResultadoPaso {
  const { d, ctx } = e;
  const devolver = (objeto: Uid, aMano: Jugador | null): void => {
    const ub = d.jugadores
      .flatMap((j) => j.grupo.map((r) => ({ j, r })))
      .find((x) => x.r.objeto === objeto);
    if (ub === undefined) return;
    ub.r.objeto = null;
    // D-34: "a la mano de su jugador" = el dueño del Héroe; Holy Curselifter, a tu mano.
    (aMano ?? ub.j).mano.push(objeto);
    e.emitir({
      tipo: 'objetoDevuelto',
      dueno: (aMano ?? ub.j).id,
      carta: idCarta(d, objeto),
      heroe: idCarta(d, ub.r.heroe),
    });
  };
  const equipados = d.jugadores.flatMap((j) =>
    j.grupo.flatMap((r) => (r.objeto === null ? [] : [r.objeto])),
  );
  switch (p.modo) {
    case 'todos':
      for (const o of equipados) devolver(o, null);
      return 'siguiente';
    case 'cualquiera':
      if (equipados.length === 0 && e.f.sub === 0) emitirSinObjetivos(e);
      return elegirCartas(e, yo.id, 'devolverObjeto', equipados, 1, 1, (uids) => {
        for (const o of uids) devolver(o, null);
      });
    case 'malditoPropio': {
      const malditos = yo.grupo.flatMap((r) =>
        r.objeto !== null && cartaDe(ctx.catalogo, d, r.objeto).tipo === 'objeto_maldito'
          ? [r.objeto]
          : [],
      );
      if (malditos.length === 0 && e.f.sub === 0) emitirSinObjetivos(e);
      return elegirCartas(e, yo.id, 'devolverObjeto', malditos, 1, 1, (uids) => {
        for (const o of uids) devolver(o, yo);
      });
    }
  }
}

function ejecutarPaso(e: EntornoPaso, p: Paso): ResultadoPaso {
  const { f, d, ctx, emitir } = e;
  const yo = jugador(d, f.jugador);

  switch (p.paso) {
    case 'robar':
      agregar(f, p.var, robarCartas(ctx, d, yo, p.cantidad, emitir));
      return 'siguiente';

    case 'robarHasta':
      robarCartas(ctx, d, yo, Math.max(0, p.total - yo.mano.length), emitir);
      return 'siguiente';

    case 'descartar': {
      const opciones =
        p.deVar === undefined ? [...yo.mano] : lista(f, p.deVar).filter((u) => yo.mano.includes(u));
      return elegirCartas(e, yo.id, 'descartar', opciones, p.min, p.max, (uids) => {
        descartarDeMano(d, yo, uids, emitir);
        if (p.var !== undefined) f.vars[p.var] = uids;
      });
    }

    case 'elegirJugador': {
      if (f.sub === 1) {
        const r = tomarRespuesta(f);
        f.vars[p.var] = typeof r === 'string' ? r : null;
        return 'siguiente';
      }
      const opciones = otros(d, yo)
        .filter((j) => {
          switch (p.filtro) {
            case 'otro':
              return true;
            case 'otroConMano':
              return j.mano.length > 0;
            case 'otroConHeroe':
              return j.grupo.length > 0;
            case 'otroConHeroeArrebatable':
              return heroesArrebatables(d, yo, j).length > 0;
          }
        })
        .map((j) => j.id);
      if (opciones.length <= 1) {
        f.vars[p.var] = opciones[0] ?? null;
        if (opciones.length === 0) emitirSinObjetivos(e);
        return 'siguiente';
      }
      f.sub = 1;
      return preguntar(e, yo.id, 'elegirJugador', { tipo: 'jugador', opciones });
    }

    case 'sacar': {
      if (f.sub === 0) {
        const de = jugadorVar(d, f, p.de);
        f.cola = de === null ? [] : [de.id];
        f.sub = 1;
      }
      return sacarDeCola(e, yo, p.var);
    }

    case 'sacarDeCada': {
      if (f.sub === 0) {
        f.cola = otros(d, yo)
          .filter((j) => j.mano.length > 0 && tieneClase(ctx, d, j, p.conClase))
          .map((j) => j.id);
        f.sub = 1;
      }
      return sacarDeCola(e, yo, undefined);
    }

    case 'mirarMano': {
      if (f.sub === 1) {
        tomarRespuesta(f);
        return 'siguiente';
      }
      const de = jugadorVar(d, f, p.de);
      if (de === null) return 'siguiente';
      emitir({ tipo: 'manoVista', jugador: yo.id, de: de.id });
      if (de.mano.length === 0) return 'siguiente';
      f.sub = 1;
      return preguntar(e, yo.id, 'verMano', { tipo: 'ver', cartas: [...de.mano], de: de.id });
    }

    case 'tomarDeManoVista': {
      const de = jugadorVar(d, f, p.de);
      if (de === null) return 'siguiente';
      if (f.sub === 0) emitir({ tipo: 'manoVista', jugador: yo.id, de: de.id });
      // "Mirar" la mano es parte del efecto: se pregunta aunque solo tenga una carta (D-40 no aplica).
      return elegirCartas(
        e,
        yo.id,
        'tomarDeMano',
        [...de.mano],
        1,
        1,
        (uids) => {
          for (const u of uids) {
            moverDeMano(de, yo, u);
            emitir({
              tipo: 'cartaSacada',
              jugador: yo.id,
              de: de.id,
              uid: u,
              carta: idCarta(d, u),
            });
          }
        },
        true,
      );
    }

    case 'jugadorDebe':
      return pasoJugadorDebe(e, yo, p);

    case 'jugadorPuedeRobar': {
      const quien = jugadorVar(d, f, p.quien);
      if (quien === null) return 'siguiente';
      if (f.sub === 1) {
        if (tomarRespuesta(f) === true) robarCartas(ctx, d, quien, p.cantidad, emitir);
        return 'siguiente';
      }
      f.sub = 1;
      return preguntar(e, quien.id, 'robar', { tipo: 'confirmar' });
    }

    case 'tomarDeDescarte':
    case 'buscarDescarte': {
      const opciones =
        p.paso === 'tomarDeDescarte'
          ? lista(f, p.deVar).filter((u) => d.descarte.includes(u))
          : d.descarte.filter((u) => coincideTipo(cartaDe(ctx.catalogo, d, u), p.tipos));
      if (opciones.length === 0 && f.sub === 0) emitirSinObjetivos(e);
      return elegirCartas(e, yo.id, 'recuperarDescarte', opciones, 1, 1, (uids) => {
        for (const u of uids) {
          if (quitar(d.descarte, u)) yo.mano.push(u);
          emitir({ tipo: 'cartaRecuperada', jugador: yo.id, carta: idCarta(d, u) });
        }
      });
    }

    case 'destruir':
      return pasoDestruir(e, yo, p);

    case 'arrebatar': {
      const de = p.de === undefined ? null : jugadorVar(d, f, p.de);
      if (p.de !== undefined && de === null) return 'siguiente';
      const opciones = heroesArrebatables(d, yo, de);
      if (opciones.length === 0 && f.sub === 0) emitirSinObjetivos(e);
      return elegirCartas(e, yo.id, 'arrebatar', opciones, 1, 1, (uids) => {
        for (const u of uids) arrebatarHeroe(d, yo, u, emitir);
        agregar(f, p.var, uids);
      });
    }

    case 'moverFuente': {
      const a = jugadorVar(d, f, p.a);
      if (a !== null && a !== yo && yo.grupo.some((r) => r.heroe === f.fuente)) {
        moverHeroe(d, yo, a, f.fuente, emitir);
      }
      return 'siguiente';
    }

    case 'darHeroe': {
      const a = jugadorVar(d, f, p.a);
      if (a === null || a === yo) return 'siguiente';
      return elegirCartas(
        e,
        yo.id,
        'darHeroe',
        yo.grupo.map((r) => r.heroe),
        1,
        1,
        (uids) => {
          for (const u of uids) moverHeroe(d, yo, a, u, emitir);
        },
      );
    }

    case 'intercambiarManos': {
      const con = jugadorVar(d, f, p.con);
      if (con !== null && con !== yo) {
        [yo.mano, con.mano] = [con.mano, yo.mano];
        emitir({ tipo: 'manosIntercambiadas', jugador: yo.id, con: con.id });
      }
      return 'siguiente';
    }

    case 'jugarInmediato':
      return pasoJugarInmediato(e, yo, p);

    case 'confirmar': {
      const quien = p.quien === undefined ? yo : jugadorVar(d, f, p.quien);
      if (quien === null) return 'siguiente';
      if (f.sub === 1) {
        f.vars[p.var] = tomarRespuesta(f) === true;
        return 'siguiente';
      }
      f.sub = 1;
      return preguntar(e, quien.id, 'confirmar', { tipo: 'confirmar' });
    }

    case 'revelar': {
      const tipos = p.tipos;
      const carta = lista(f, p.deVar).find(
        (u) => yo.mano.includes(u) && coincideTipo(cartaDe(ctx.catalogo, d, u), tipos),
      );
      if (carta !== undefined)
        emitir({ tipo: 'cartaRevelada', jugador: yo.id, carta: idCarta(d, carta) });
      return 'siguiente';
    }

    case 'bonoTurno':
      d.temporales.push({
        jugador: yo.id,
        tipo: 'bonoTirada',
        valor: p.valor,
        expira: 'finTurno',
        carta: f.carta,
      });
      emitir({
        tipo: 'temporalActivado',
        jugador: yo.id,
        efecto: 'bonoTirada',
        valor: p.valor,
        carta: f.carta,
      });
      return 'siguiente';

    case 'proteccion':
      d.temporales.push({
        jugador: yo.id,
        tipo: p.tipo,
        valor: 0,
        expira: p.hasta,
        carta: f.carta,
      });
      emitir({
        tipo: 'temporalActivado',
        jugador: yo.id,
        efecto: p.tipo,
        valor: 0,
        carta: f.carta,
      });
      return 'siguiente';

    case 'devolverObjeto':
      return pasoDevolverObjeto(e, yo, p);

    case 'tirarPorHeroe': {
      if (f.sub === 1) return 'siguiente';
      const [heroe] = lista(f, p.var);
      if (heroe === undefined || !yo.grupo.some((r) => r.heroe === heroe)) return 'siguiente';
      if (heroeSellado(ctx, d, heroe)) {
        emitir({ tipo: 'heroeSellado', jugador: yo.id, heroe: idCarta(d, heroe) });
        return 'siguiente';
      }
      // D-31: tirada gratuita que cuenta como el uso de ese Héroe este turno.
      iniciarTiradaHeroe(d, yo.id, heroe, emitir);
      f.sub = 1;
      return 'esperar';
    }

    case 'custom': {
      const manejador = ctx.custom[p.nombre];
      if (manejador === undefined) throw new ErrorInterno(`Paso custom desconocido: ${p.nombre}`);
      return manejador(e);
    }
  }
}

/**
 * Ejecuta los efectos de la cima de la pila hasta que todos terminan o alguno queda esperando una
 * decisión o una ventana. Al terminar un efecto que estaba encima de una ventana abierta, la cuenta
 * regresiva de esa ventana se reinicia (D-08).
 */
export function ejecutarEfectos(ctx: Ctx, d: GameState, emitir: Emitir): void {
  for (let n = 0; n < MAX_PASOS; n++) {
    if (d.ganador !== null) return;
    const f = cimaPila(d);
    if (f?.tipo !== 'efecto') return;
    const paso = programaDe(ctx, f)[f.pc];
    if (paso === undefined) {
      d.pila.pop();
      const debajo = cimaPila(d);
      // D-38: un disparador encima de una ventana la pausa; al terminar, la cuenta se reinicia.
      if (debajo?.tipo === 'ventanaModificadores' || debajo?.tipo === 'ventanaDesafio') {
        d.secuencia += 1;
        debajo.secuencia = d.secuencia;
        emitir({
          tipo: 'ventanaReiniciada',
          secuencia: d.secuencia,
          duracionMs: debajo.duracionMs,
        });
      }
      continue;
    }
    if (f.sub === 0 && paso.si !== undefined && !cumple(ctx, d, f, paso.si)) {
      siguientePaso(f);
      continue;
    }
    const antes = d.pila.length;
    const resultado = ejecutarPaso({ ctx, d, f, emitir }, paso);
    if (resultado === 'siguiente') siguientePaso(f);
    else if (d.pila.length <= antes)
      throw new ErrorInterno(`El paso "${paso.paso}" espera sin apilar nada`);
  }
  throw new ErrorInterno('Demasiados pasos de efecto seguidos');
}

/** Guarda la respuesta de una decisión en el marco que la pidió. */
export function entregarRespuesta(d: GameState, efecto: number, respuesta: Valor): void {
  const marco = d.pila.find((p): p is MarcoEfecto => p.tipo === 'efecto' && p.id === efecto);
  if (marco === undefined) throw new ErrorInterno(`No existe el efecto ${efecto}`);
  marco.respuesta = respuesta;
}
