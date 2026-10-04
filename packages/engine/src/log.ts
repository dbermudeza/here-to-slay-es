import type { AccionElegir, Evento, MotivoVictoria } from './tipos';

export interface Nombres {
  carta: (id: string) => string;
  jugador: (id: string) => string;
}

const MOTIVOS: Record<MotivoVictoria, string> = {
  tresMonstruos: 'ha matado 3 Monstruos',
  grupoCompleto: 'ha completado un Grupo con las 6 clases',
  grupoCompletoYMonstruo: 'tiene las 6 clases y al menos 1 Monstruo',
  cuatroMonstruosTresClases: 'tiene 4 Monstruos y al menos 3 clases',
};

const VERBOS: Record<AccionElegir, string> = { sacrificar: 'sacrificar', descartar: 'descartar' };

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;
const conSigno = (n: number): string => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/** Texto del historial de la partida, en español. Devuelve null para eventos sin interés para el log. */
export function describirEvento(e: Evento, n: Nombres): string | null {
  const J = (id: string) => n.jugador(id);
  const C = (id: string) => n.carta(id);
  switch (e.tipo) {
    case 'partidaCreada':
      return `Empieza una partida de ${e.jugadores.length} jugadores (reglas ${e.modo === 'normal' ? 'normales' : 'difíciles'}).`;
    case 'liderAsignado':
      return `${J(e.jugador)} lidera el grupo con ${C(e.carta)}.`;
    case 'turnoIniciado':
      return `Turno ${e.numero}: le toca a ${J(e.jugador)}.`;
    case 'turnoTerminado':
      return `${J(e.jugador)} termina su turno.`;
    case 'cartaRobada':
      return e.carta === null
        ? `${J(e.jugador)} roba una carta.`
        : `${J(e.jugador)} roba ${C(e.carta)}.`;
    case 'mazoRebarajado':
      return `El mazo se ha agotado: se baraja la pila de descarte (${plural(e.cartas, 'carta', 'cartas')}).`;
    case 'mazoAgotado':
      return 'No quedan cartas en el mazo ni en la pila de descarte.';
    case 'manoRenovada':
      return `${J(e.jugador)} descarta su mano y roba 5 cartas.`;
    case 'cartasDescartadas':
      return `${J(e.jugador)} descarta ${e.cartas.map(C).join(', ')}.`;
    case 'cartaJugada':
      return `${J(e.jugador)} intenta jugar ${C(e.carta)}.`;
    case 'ventanaDesafioAbierta':
    case 'ventanaModificadoresAbierta':
    case 'ventanaReiniciada':
    case 'ventanaCerrada':
    case 'efectoActivado':
      return null;
    case 'pasa':
      return `${J(e.jugador)} no desafía.`;
    case 'desafio':
      return `¡${J(e.desafiante)} DESAFÍA ${C(e.carta)} de ${J(e.desafiado)}!`;
    case 'dadosTirados':
      return `${J(e.jugador)} tira los dados: ${e.dados[0]} + ${e.dados[1]} = ${e.dados[0] + e.dados[1]}.`;
    case 'modificadorJugado':
      return `${J(e.jugador)} juega ${C(e.carta)} (${conSigno(e.valor)}) sobre la tirada de ${J(e.sobre)}.`;
    case 'desafioResuelto':
      return e.ganador === 'desafiante'
        ? `El desafío tiene éxito (${e.totalDesafiante} contra ${e.totalDesafiado}).`
        : `El desafío fracasa (${e.totalDesafiante} contra ${e.totalDesafiado}).`;
    case 'cartaAnulada':
      return `${C(e.carta)} de ${J(e.jugador)} va a la pila de descarte sin efecto.`;
    case 'heroeEntra':
      return `${C(e.carta)} se une al Grupo de ${J(e.jugador)}.`;
    case 'objetoEquipado':
      return e.dueno === e.jugador
        ? `${J(e.jugador)} equipa ${C(e.carta)} a ${C(e.heroe)}.`
        : `${J(e.jugador)} equipa ${C(e.carta)} a ${C(e.heroe)} de ${J(e.dueno)}.`;
    case 'magiaResuelta':
      return `${C(e.carta)} se resuelve y va a la pila de descarte.`;
    case 'tiradaHeroe':
      return e.exito
        ? `${C(e.heroe)}: tirada de ${e.total}, ¡éxito!`
        : `${C(e.heroe)}: tirada de ${e.total}, no es suficiente.`;
    case 'ataque':
      return `${J(e.jugador)} ATACA a ${C(e.monstruo)}.`;
    case 'ataqueResuelto':
      return e.resultado === 'exito'
        ? `Tirada de ${e.total} contra ${C(e.monstruo)}: ¡lo derrota!`
        : e.resultado === 'fracaso'
          ? `Tirada de ${e.total} contra ${C(e.monstruo)}: el ataque sale mal.`
          : `Tirada de ${e.total} contra ${C(e.monstruo)}: no pasa nada.`;
    case 'monstruoMatado':
      return `${J(e.jugador)} MATA a ${C(e.carta)}.`;
    case 'monstruoRevelado':
      return `Aparece un nuevo Monstruo: ${C(e.carta)}.`;
    case 'decisionPendiente':
      return `${J(e.jugador)} debe ${VERBOS[e.accion]} ${plural(e.cantidad, 'carta', 'cartas')}.`;
    case 'heroeSacrificado':
      return e.objeto === null
        ? `${J(e.jugador)} sacrifica a ${C(e.carta)}.`
        : `${J(e.jugador)} sacrifica a ${C(e.carta)} (y su ${C(e.objeto)}).`;
    case 'victoria':
      return `🏆 ¡${J(e.jugador)} gana la partida! ${MOTIVOS[e.motivo]}.`;
  }
}
