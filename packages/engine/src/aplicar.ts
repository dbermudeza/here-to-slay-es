import { cartaDe, cimaPila, ErrorInterno, idCarta, jugador } from './consultas';
import type { Ctx } from './efectos';
import { aplicarEleccion, cerrarVentana, finTurno, iniciarTiradaHeroe } from './flujo';
import {
  abrirVentanaModificadores,
  CARTAS_MANO_INICIAL,
  descartarDeMano,
  quitar,
  robar,
  tirar,
  type Emitir,
} from './ops';
import type { Envio, GameState, Jugada } from './tipos';

/** Aplica una acción YA VALIDADA sobre el borrador `d`. */
export function aplicar(ctx: Ctx, d: GameState, { actor, accion }: Envio, emitir: Emitir): void {
  const cima = cimaPila(d);

  switch (accion.tipo) {
    case 'CERRAR_VENTANA':
      cerrarVentana(ctx, d, emitir);
      return;

    case 'ROBAR': {
      d.turno.pa -= 1;
      robar(d, jugador(d, actor), 1, emitir);
      return;
    }

    case 'RENOVAR_MANO': {
      // R-023: descartar toda la mano (si hay) y robar 5.
      const j = jugador(d, actor);
      d.turno.pa -= 3;
      descartarDeMano(d, j, [...j.mano], emitir);
      emitir({ tipo: 'manoRenovada', jugador: j.id });
      robar(d, j, CARTAS_MANO_INICIAL, emitir);
      return;
    }

    case 'JUGAR_CARTA': {
      const j = jugador(d, actor);
      const carta = cartaDe(ctx.catalogo, d, accion.uid);
      d.turno.pa -= 1;
      quitar(j.mano, accion.uid);
      let jugada: Jugada;
      if (carta.tipo === 'heroe') jugada = { tipo: 'heroe', jugador: j.id, uid: accion.uid };
      else if (carta.tipo === 'magia') jugada = { tipo: 'magia', jugador: j.id, uid: accion.uid };
      else if (accion.objetivo !== undefined) {
        jugada = { tipo: 'objeto', jugador: j.id, uid: accion.uid, objetivo: accion.objetivo };
      } else throw new ErrorInterno('Objeto sin objetivo');
      emitir({
        tipo: 'cartaJugada',
        jugador: j.id,
        uid: accion.uid,
        carta: carta.id,
        objetivo: accion.objetivo ?? null,
      });
      // R-070: los demás pueden desafiar la carta antes de que tenga efecto.
      d.secuencia += 1;
      const duracionMs = d.opciones.duracionVentanaDesafioMs;
      d.pila.push({
        tipo: 'ventanaDesafio',
        secuencia: d.secuencia,
        duracionMs,
        jugada,
        pasaron: [],
      });
      emitir({ tipo: 'ventanaDesafioAbierta', secuencia: d.secuencia, duracionMs });
      return;
    }

    case 'TIRAR_HEROE':
      d.turno.pa -= 1;
      iniciarTiradaHeroe(d, actor, accion.uid, emitir);
      return;

    case 'ATACAR': {
      d.turno.pa -= 2;
      emitir({ tipo: 'ataque', jugador: actor, monstruo: idCarta(d, accion.uid) });
      const t = tirar(d, actor, emitir);
      abrirVentanaModificadores(d, [t], { tipo: 'ataque', monstruo: accion.uid }, emitir);
      return;
    }

    case 'FIN_TURNO':
      finTurno(ctx, d, emitir);
      return;

    case 'DESAFIAR': {
      if (cima?.tipo !== 'ventanaDesafio') throw new ErrorInterno('Desafío sin ventana');
      const desafiante = jugador(d, actor);
      d.pila.pop();
      emitir({ tipo: 'ventanaCerrada', secuencia: cima.secuencia });
      // D-11: la carta de Desafío va al descarte de inmediato.
      quitar(desafiante.mano, accion.uid);
      d.descarte.push(accion.uid);
      emitir({
        tipo: 'desafio',
        desafiante: actor,
        desafiado: cima.jugada.jugador,
        carta: idCarta(d, cima.jugada.uid),
      });
      // R-071: ambos tiran; una única ventana de modificadores cubre las dos tiradas (D-09).
      const tiradaDesafiado = tirar(d, cima.jugada.jugador, emitir);
      const tiradaDesafiante = tirar(d, actor, emitir);
      abrirVentanaModificadores(
        d,
        [tiradaDesafiado, tiradaDesafiante],
        { tipo: 'desafio', jugada: cima.jugada, desafiante: actor },
        emitir,
      );
      return;
    }

    case 'PASAR': {
      if (cima?.tipo !== 'ventanaDesafio') throw new ErrorInterno('Pasar sin ventana');
      cima.pasaron.push(actor);
      emitir({ tipo: 'pasa', jugador: actor });
      const rivales = d.jugadores.filter((j) => j.id !== cima.jugada.jugador);
      if (rivales.every((j) => cima.pasaron.includes(j.id))) cerrarVentana(ctx, d, emitir);
      return;
    }

    case 'JUGAR_MODIFICADOR': {
      if (cima?.tipo !== 'ventanaModificadores') throw new ErrorInterno('Modificador sin ventana');
      const j = jugador(d, actor);
      const tirada = cima.tiradas[accion.tirada];
      if (tirada === undefined) throw new ErrorInterno('Tirada inexistente');
      quitar(j.mano, accion.uid);
      d.descarte.push(accion.uid);
      tirada.modificaciones.push({ jugador: actor, uid: accion.uid, valor: accion.valor });
      emitir({
        tipo: 'modificadorJugado',
        jugador: actor,
        carta: idCarta(d, accion.uid),
        valor: accion.valor,
        sobre: tirada.jugador,
      });
      // R-067: cada Modificador reinicia la cuenta regresiva.
      d.secuencia += 1;
      cima.secuencia = d.secuencia;
      emitir({ tipo: 'ventanaReiniciada', secuencia: d.secuencia, duracionMs: cima.duracionMs });
      return;
    }

    case 'TIRADA_INMEDIATA': {
      if (cima?.tipo !== 'tiradaInmediata')
        throw new ErrorInterno('Sin tirada inmediata pendiente');
      d.pila.pop();
      // D-05: la tirada inmediata no cuesta PA, pero cuenta como el uso de ese turno.
      if (accion.tirar) iniciarTiradaHeroe(d, actor, cima.heroe, emitir);
      return;
    }

    case 'ELEGIR': {
      if (cima?.tipo !== 'elegir') throw new ErrorInterno('Sin elección pendiente');
      d.pila.pop();
      aplicarEleccion(d, jugador(d, actor), cima.accion, accion.uids, emitir);
      return;
    }
  }
}
