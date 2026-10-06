/**
 * Piloto para las pruebas e2e (solo en la compilación `--mode e2e`; no existe en la normal).
 *
 * Expone `window.__hts.sugerencia()`: lo que haría el bot normal en el lugar del jugador que mira la
 * mesa. La prueba de Playwright lo ejecuta pulsando la interfaz real (botones, cartas y diálogos),
 * así que las partidas e2e terminan con un ganador y recorren todas las pantallas de la mesa.
 */
import { Anfitrion } from '@hts/anfitrion';
import { BOTS } from '@hts/bots';
import { crearRng, siguienteRng, type Accion, type JugadorId, type Motor } from '@hts/engine';
import type { FuenteMesa } from '../juego/fuente';
import { clave } from '../pantallas/mesa/contexto';

export type Paso =
  | { tipo: 'accion'; accion: Accion; clave: string }
  /** Modo este dispositivo: confirmar que el jugador indicado tiene el dispositivo. */
  | { tipo: 'traspaso'; jugador: JugadorId }
  /** Modo este dispositivo: pulsar "Responde X" para que otro humano responda en la ventana. */
  | { tipo: 'responder'; jugador: JugadorId }
  /** Modo este dispositivo: el que respondía no quiere hacer nada más. */
  | { tipo: 'terminarRespuesta' }
  /** Nadie de los que manejan esta página debe actuar ahora. */
  | { tipo: 'esperar' }
  | { tipo: 'fin'; ganador: JugadorId };

export interface EstadoPiloto {
  version: number;
  observador: JugadorId;
  turno: number;
  ganador: JugadorId | null;
}

interface MesaRegistrada {
  director: FuenteMesa;
  motor: Motor;
}

declare global {
  interface Window {
    __htsMesa?: MesaRegistrada | undefined;
    __hts?: {
      estado: () => EstadoPiloto | null;
      sugerencia: () => Paso | null;
    };
  }
}

let rng = crearRng('piloto-e2e');
const azar = (): number => {
  const [x, siguiente] = siguienteRng(rng);
  rng = siguiente;
  return x;
};

/** Respondedores ya invitados en cada ventana (`secuencia:jugador`), para no repetir en bucle. */
const invitados = new Set<string>();

const comoPaso = (accion: Accion): Paso => ({ tipo: 'accion', accion, clave: clave(accion) });

function sugerencia({ director: d, motor }: MesaRegistrada): Paso {
  const vista = d.vista();
  // Monstruo derrotado: nadie puede jugar hasta que acabe la celebración.
  if (d.celebracion !== null) return { tipo: 'esperar' };
  // Se está enseñando un resultado: nadie actúa hasta que acabe la pausa.
  if (d.pausaResultado !== null) return { tipo: 'esperar' };
  if (vista.ganador !== null) return { tipo: 'fin', ganador: vista.ganador.jugador };
  if (d.traspaso !== null) return { tipo: 'traspaso', jugador: d.traspaso };

  const cima = vista.pila[vista.pila.length - 1];
  const enVentana = cima?.tipo === 'ventanaDesafio' || cima?.tipo === 'ventanaModificadores';
  const legales = d.legales();
  if (legales.length > 0) {
    const accion = BOTS.normal.elegir({ vista, legales, catalogo: motor.catalogo, azar });
    if (accion !== null) return comoPaso(accion);
    if (!enVentana && legales[0] !== undefined) return comoPaso(legales[0]);
  }

  // Este dispositivo: ¿algún otro humano quiere responder en la ventana?
  if (enVentana && d.config.modo === 'local' && d instanceof Anfitrion) {
    if (d.respondiendo !== null) {
      return d.respondiendo === d.observador ? { tipo: 'terminarRespuesta' } : { tipo: 'esperar' };
    }
    for (const id of d.respondedoresPosibles()) {
      const marca = `${cima.secuencia}:${id}`;
      if (id === d.observador || invitados.has(marca)) continue;
      const suyas = d.legalesDe(id);
      if (suyas.length === 0) continue;
      const accion = BOTS.normal.elegir({
        vista: d.vistaDe(id),
        legales: suyas,
        catalogo: motor.catalogo,
        azar,
      });
      if (accion !== null) {
        invitados.add(marca);
        return { tipo: 'responder', jugador: id };
      }
    }
  }
  return { tipo: 'esperar' };
}

window.__hts = {
  estado: () => {
    const mesa = window.__htsMesa;
    if (mesa === undefined) return null;
    const vista = mesa.director.vista();
    return {
      version: mesa.director.version,
      observador: mesa.director.observador,
      turno: vista.turno.numero,
      ganador: vista.ganador?.jugador ?? null,
    };
  },
  sugerencia: () => {
    const mesa = window.__htsMesa;
    return mesa === undefined ? null : sugerencia(mesa);
  },
};
