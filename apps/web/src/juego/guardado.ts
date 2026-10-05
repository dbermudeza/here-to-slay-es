/**
 * Guardar y cargar partidas: guardado automático en el navegador y exportación/importación como
 * archivo. El estado se valida con el motor al cargar (ErrorCarga si no es válido).
 */
import type { Evento, Motor } from '@hts/engine';
import type { ConfigLocal } from './config';
import { CLAVE_AUTO } from './autoguardado';
import { DirectorVivo, type OpcionesDirector, type Reloj } from './director-vivo';

const FORMATO = 'hts-guardado';
const MAX_EVENTOS = 600;

interface Guardado {
  formato: typeof FORMATO;
  version: 1;
  fecha: string;
  config: ConfigLocal;
  /** Partida serializada por el motor. */
  partida: string;
  eventos: Evento[];
}

export class ErrorGuardado extends Error {}

export function serializarGuardado(d: DirectorVivo): string {
  const g: Guardado = {
    formato: FORMATO,
    version: 1,
    fecha: new Date().toISOString(),
    config: d.config,
    partida: d.motor.serializar(d.estado),
    eventos: d.eventos.slice(-MAX_EVENTOS),
  };
  return JSON.stringify(g);
}

export function restaurarGuardado(
  motor: Motor,
  texto: string,
  reloj?: Reloj,
  opciones?: OpcionesDirector,
): DirectorVivo {
  let g: unknown;
  try {
    g = JSON.parse(texto);
  } catch {
    throw new ErrorGuardado('El archivo no es JSON válido.');
  }
  if (typeof g !== 'object' || g === null || (g as Guardado).formato !== FORMATO) {
    throw new ErrorGuardado('El archivo no es una partida guardada de Here to Slay.');
  }
  const { config, partida, eventos } = g as Guardado;
  // motor.cargar valida la estructura, el catálogo y la conservación de cartas.
  const estado = motor.cargar(partida);
  return new DirectorVivo(
    motor,
    config,
    estado,
    reloj,
    opciones,
    Array.isArray(eventos) ? eventos : [],
  );
}

/** Guardado automático. El almacenamiento puede no estar disponible (modo privado): se ignora. */
export function guardarAuto(d: DirectorVivo): void {
  try {
    if (d.estado.ganador !== null) localStorage.removeItem(CLAVE_AUTO);
    else localStorage.setItem(CLAVE_AUTO, serializarGuardado(d));
  } catch {
    // Sin almacenamiento: la partida sigue sin guardado automático.
  }
}

export { borrarAuto, leerAuto } from './autoguardado';

export function descargar(d: DirectorVivo): void {
  const blob = new Blob([serializarGuardado(d)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `here-to-slay-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
