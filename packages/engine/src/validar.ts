import { buscarJugador, buscarRanura, cartaDe, cimaPila, cumpleRequisitos } from './consultas';
import type { Ctx } from './efectos';
import { habilidadDe, heroeSellado } from './pasivas';
import {
  SISTEMA,
  type CodigoError,
  type Envio,
  type GameState,
  type Jugador,
  type Pregunta,
  type Respuesta,
} from './tipos';

const TIPOS_JUGABLES = new Set(['heroe', 'objeto', 'objeto_maldito', 'magia']);

/**
 * Devuelve por qué una acción es ilegal en el estado dado, o null si es legal.
 * El reducer la usa antes de aplicar nada; la UI, para explicar las acciones deshabilitadas.
 */
export function validar(ctx: Ctx, s: GameState, { actor, accion }: Envio): CodigoError | null {
  if (s.ganador !== null) return 'PARTIDA_TERMINADA';
  const cima = cimaPila(s);

  if (accion.tipo === 'CERRAR_VENTANA') {
    if (actor !== SISTEMA) return 'SOLO_SISTEMA';
    if (cima?.tipo !== 'ventanaDesafio' && cima?.tipo !== 'ventanaModificadores')
      return 'NO_ES_MOMENTO';
    return cima.secuencia === accion.secuencia ? null : 'SECUENCIA_OBSOLETA';
  }

  const j = buscarJugador(s, actor);
  if (j === undefined) return 'JUGADOR_DESCONOCIDO';
  const enMano = (uid: string): boolean => j.mano.includes(uid);

  switch (accion.tipo) {
    case 'ROBAR':
    case 'JUGAR_CARTA':
    case 'TIRAR_HEROE':
    case 'ATACAR':
    case 'RENOVAR_MANO':
    case 'USAR_HABILIDAD':
    case 'FIN_TURNO': {
      if (actor !== s.turno.jugador) return 'NO_ES_TU_TURNO';
      if (cima !== undefined) return 'HAY_DECISION_PENDIENTE';
      return validarAccionDeTurno(ctx, s, j, accion);
    }

    case 'DESAFIAR':
    case 'PASAR': {
      if (cima?.tipo !== 'ventanaDesafio') return 'NO_ES_MOMENTO';
      if (actor === cima.jugada.jugador) return 'NO_PUEDES_DESAFIARTE';
      if (cima.pasaron.includes(actor)) return 'YA_PASASTE';
      if (accion.tipo === 'PASAR') return null;
      if (!enMano(accion.uid)) return 'CARTA_NO_EN_MANO';
      return cartaDe(ctx.catalogo, s, accion.uid).tipo === 'desafio'
        ? null
        : 'TIPO_DE_CARTA_INVALIDO';
    }

    case 'JUGAR_MODIFICADOR': {
      if (cima?.tipo !== 'ventanaModificadores') return 'NO_ES_MOMENTO';
      if (!enMano(accion.uid)) return 'CARTA_NO_EN_MANO';
      const carta = cartaDe(ctx.catalogo, s, accion.uid);
      if (carta.tipo !== 'modificador') return 'TIPO_DE_CARTA_INVALIDO';
      if (!carta.opciones.includes(accion.valor)) return 'VALOR_INVALIDO';
      if (!Number.isInteger(accion.tirada) || cima.tiradas[accion.tirada] === undefined) {
        return 'TIRADA_INVALIDA';
      }
      return null;
    }

    case 'TIRADA_INMEDIATA':
      return cima?.tipo === 'tiradaInmediata' && cima.jugador === actor ? null : 'NO_ES_MOMENTO';

    case 'ELEGIR': {
      if (cima?.tipo !== 'elegir' || cima.jugador !== actor) return 'NO_ES_MOMENTO';
      const unicos = new Set(accion.uids);
      if (unicos.size !== accion.uids.length || unicos.size !== cima.cantidad)
        return 'SELECCION_INVALIDA';
      const validos =
        cima.accion === 'descartar'
          ? accion.uids.every(enMano)
          : accion.uids.every((u) => j.grupo.some((r) => r.heroe === u));
      return validos ? null : 'SELECCION_INVALIDA';
    }

    case 'RESPONDER':
      if (cima?.tipo !== 'decision' || cima.jugador !== actor) return 'NO_ES_MOMENTO';
      return respuestaValida(s, cima.pregunta, accion.respuesta) ? null : 'RESPUESTA_INVALIDA';
  }
}

/** Comprueba que la respuesta tenga la forma y los valores que admite la pregunta. */
export function respuestaValida(s: GameState, p: Pregunta, r: Respuesta): boolean {
  switch (p.tipo) {
    case 'jugador':
      return 'jugador' in r && p.opciones.includes(r.jugador);
    case 'cartas': {
      if (!('cartas' in r) || !Array.isArray(r.cartas)) return false;
      const unicas = new Set(r.cartas);
      return (
        unicas.size === r.cartas.length &&
        r.cartas.length >= p.min &&
        r.cartas.length <= p.max &&
        r.cartas.every((c) => p.opciones.includes(c))
      );
    }
    case 'oculta': {
      const de = buscarJugador(s, p.de);
      return (
        'indice' in r &&
        Number.isInteger(r.indice) &&
        de !== undefined &&
        r.indice >= 0 &&
        r.indice < de.mano.length
      );
    }
    case 'confirmar':
      return 'si' in r && typeof r.si === 'boolean';
    case 'valor':
      return 'valor' in r && p.opciones.includes(r.valor);
    case 'ver':
      return 'ok' in r && r.ok === true;
  }
}

function validarAccionDeTurno(
  ctx: Ctx,
  s: GameState,
  j: Jugador,
  accion: Extract<
    Envio['accion'],
    {
      tipo:
        | 'ROBAR'
        | 'JUGAR_CARTA'
        | 'TIRAR_HEROE'
        | 'ATACAR'
        | 'RENOVAR_MANO'
        | 'USAR_HABILIDAD'
        | 'FIN_TURNO';
    }
  >,
): CodigoError | null {
  const pa = s.turno.pa;
  switch (accion.tipo) {
    case 'FIN_TURNO':
      return null;
    case 'ROBAR':
      return pa >= 1 ? null : 'PA_INSUFICIENTES';
    case 'RENOVAR_MANO':
      return pa >= 3 ? null : 'PA_INSUFICIENTES';
    case 'JUGAR_CARTA': {
      if (pa < 1) return 'PA_INSUFICIENTES';
      if (!j.mano.includes(accion.uid)) return 'CARTA_NO_EN_MANO';
      const carta = cartaDe(ctx.catalogo, s, accion.uid);
      if (!TIPOS_JUGABLES.has(carta.tipo)) return 'TIPO_DE_CARTA_INVALIDO';
      const esObjeto = carta.tipo === 'objeto' || carta.tipo === 'objeto_maldito';
      if (!esObjeto) return accion.objetivo === undefined ? null : 'OBJETIVO_INVALIDO';
      // R-041..R-043, D-06: cualquier Héroe sin Objeto, propio o ajeno.
      if (accion.objetivo === undefined) return 'OBJETIVO_INVALIDO';
      const destino = buscarRanura(s, accion.objetivo);
      return destino !== null && destino.ranura.objeto === null ? null : 'OBJETIVO_INVALIDO';
    }
    case 'TIRAR_HEROE':
      if (pa < 1) return 'PA_INSUFICIENTES';
      if (!j.grupo.some((r) => r.heroe === accion.uid)) return 'HEROE_NO_EN_GRUPO';
      if (s.turno.heroesUsados.includes(accion.uid)) return 'HEROE_YA_USADO';
      // Llave Selladora.
      return heroeSellado(ctx, s, accion.uid) ? 'HEROE_SELLADO' : null;
    case 'USAR_HABILIDAD': {
      const hab = habilidadDe(ctx, s, j, accion.uid);
      if (hab === null || hab.pasiva.tipo !== 'habilidad') return 'HABILIDAD_NO_DISPONIBLE';
      if (pa < hab.pasiva.costePa) return 'PA_INSUFICIENTES';
      return hab.pasiva.unaVezPorTurno && s.turno.habilidadesUsadas.includes(accion.uid)
        ? 'HABILIDAD_NO_DISPONIBLE'
        : null;
    }
    case 'ATACAR': {
      if (pa < 2) return 'PA_INSUFICIENTES';
      if (!s.monstruosCentro.includes(accion.uid)) return 'MONSTRUO_NO_DISPONIBLE';
      const monstruo = cartaDe(ctx.catalogo, s, accion.uid);
      if (monstruo.tipo !== 'monstruo') return 'MONSTRUO_NO_DISPONIBLE';
      return cumpleRequisitos(ctx.catalogo, s, j, monstruo.requisitos)
        ? null
        : 'REQUISITOS_NO_CUMPLIDOS';
    }
  }
}
