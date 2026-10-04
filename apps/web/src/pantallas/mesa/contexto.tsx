import type { Accion, JugadorId, Uid, VistaJugador } from '@hts/engine';
import { createContext, useContext } from 'react';
import type { DirectorVivo } from '../../juego/director-vivo';
import type { Detalle } from '../../ui/DetalleCarta';

export interface ValorMesa {
  director: DirectorVivo;
  vista: VistaJugador;
  legales: Accion[];
  /** Jugador cuya vista se muestra. */
  yo: JugadorId;
  esMiTurnoLibre: boolean;
  enviar: (accion: Accion) => void;
  /** null si la acción es legal; si no, el texto que explica por qué no. */
  motivo: (accion: Accion) => string | null;
  nombreJugador: (id: JugadorId) => string;
  nombreCarta: (cartaId: string) => string;
  /** Id de catálogo de una carta visible, o null si está oculta. */
  idDe: (uid: Uid) => string | null;
  ampliar: (cartaId: string) => void;
  /** Abre la ventana con la carta en grande y toda su información. */
  verDetalle: (detalle: Detalle) => void;
  /** Abre el detalle de la carta `uid` si es visible. */
  detalleDe: (uid: Uid, extra?: Omit<Detalle, 'cartaId'>) => void;
  /** Objeto de la mano que se está equipando (elección de Héroe), o null. */
  equipando: Uid | null;
  setEquipando: (uid: Uid | null) => void;
  objetivosEquipar: ReadonlySet<Uid>;
}

export const MesaContexto = createContext<ValorMesa | null>(null);

export function useMesa(): ValorMesa {
  const v = useContext(MesaContexto);
  if (v === null) throw new Error('Falta MesaContexto');
  return v;
}

export const mismaAccion = (a: Accion, b: Accion): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
