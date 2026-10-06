import type { Evento, JugadorId } from '@hts/engine';
import { useEffect, useRef, useState } from 'react';
import type { FuenteMesa } from '../../juego/fuente';

/**
 * Cuenta las activaciones de la habilidad del Líder de `jugador` que NO llevan la presentación
 * completa y deben producir un destello breve sobre su carta. Misma regla que el anfitrión: la
 * primera activación de cada Líder en cada turno tiene presentación (nunca destella); las
 * siguientes del mismo turno destellan. Al montar, o si el historial se reinicia (reconexión), se
 * reconstruye el estado del turno sin destellar.
 */
export function useDestelloLider(director: FuenteMesa, jugador: JugadorId): number {
  const n = director.eventos.length;
  const visto = useRef(0);
  const turno = useRef<number | null>(null);
  const activados = useRef(new Set<string>());
  const [cuenta, setCuenta] = useState(0);

  /** Procesa eventos; devuelve cuántos destellos producen. */
  const procesar = (eventos: readonly Evento[]): number => {
    let destellos = 0;
    for (const e of eventos) {
      if (e.tipo === 'turnoIniciado' && e.numero !== turno.current) {
        turno.current = e.numero;
        activados.current.clear();
      }
      if (e.tipo !== 'liderActivado') continue;
      const clave = `${e.jugador}:${e.carta}`;
      if (activados.current.has(clave)) {
        if (e.jugador === jugador) destellos += 1;
      } else {
        activados.current.add(clave);
      }
    }
    return destellos;
  };

  // Estado inicial: lo ocurrido antes de montar no destella.
  const inicial = useRef(true);
  if (inicial.current) {
    inicial.current = false;
    procesar(director.eventos);
    visto.current = n;
  }

  useEffect(() => {
    if (n < visto.current) {
      // El historial se reinició: se reconstruye el turno sin destellar.
      turno.current = null;
      activados.current.clear();
      procesar(director.eventos);
      visto.current = n;
      return;
    }
    const nuevos = director.eventos.slice(visto.current);
    visto.current = n;
    const destellos = procesar(nuevos);
    if (destellos > 0) setCuenta((c) => c + destellos);
    // El director es mutable: `n` indica que llegaron eventos nuevos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  return cuenta;
}
