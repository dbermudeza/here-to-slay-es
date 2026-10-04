import type { Accion } from '@hts/engine';
import type { Bot, EntradaBot } from './tipos';

const PROB_RESPONDER = 0.1;

function alAzar<T>(lista: readonly T[], azar: () => number): T | undefined {
  return lista[Math.floor(azar() * lista.length)];
}

/** Bot fácil: elige al azar entre sus acciones legales, con dos ajustes de sentido común. */
export const botFacil: Bot = {
  nivel: 'facil',
  elegir({ vista, legales, azar }: EntradaBot): Accion | null {
    if (legales.length === 0) return null;
    const cima = vista.pila[vista.pila.length - 1];

    if (cima?.tipo === 'ventanaDesafio') {
      const desafios = legales.filter((a) => a.tipo === 'DESAFIAR');
      if (desafios.length > 0 && azar() < PROB_RESPONDER) return alAzar(desafios, azar) ?? null;
      return legales.find((a) => a.tipo === 'PASAR') ?? null;
    }
    if (cima?.tipo === 'ventanaModificadores') {
      return azar() < PROB_RESPONDER ? (alAzar(legales, azar) ?? null) : null;
    }
    if (cima === undefined && vista.turno.jugador === vista.yo) {
      // No termina el turno mientras le queden otras acciones.
      const utiles = legales.filter((a) => a.tipo !== 'FIN_TURNO');
      return alAzar(utiles.length > 0 ? utiles : legales, azar) ?? null;
    }
    return alAzar(legales, azar) ?? null;
  },
};
