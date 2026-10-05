import { useState, useSyncExternalStore } from 'react';
import { intentoActual, marcarCargada, marcarFallida, suscribirIntentos } from './imagenesFallidas';

export interface ImagenReintentable {
  /** false si la imagen falló y aún no toca reintentar (hay que mostrar la reserva). */
  mostrar: boolean;
  clave: string;
  src: string;
  onError: () => void;
  onLoad: () => void;
}

/**
 * Carga de una imagen de /cartas con el reintento compartido (`imagenesFallidas`): al fallar se
 * muestra la reserva y, al recuperar el foco o la conexión, se vuelve a pedir con otro parámetro.
 * El fallo se asocia a la imagen concreta; las que no fallan mantienen key y src estables.
 */
export function useImagen(imagen: string | undefined): ImagenReintentable {
  const intento = useSyncExternalStore(suscribirIntentos, intentoActual);
  const [fallo, setFallo] = useState<{ imagen: string; intento: number; cargada: boolean } | null>(
    null,
  );
  const propio = fallo !== null && fallo.imagen === imagen ? fallo : null;
  const sinImagen = propio !== null && !propio.cargada && propio.intento === intento;
  const reintento = propio === null ? 0 : propio.cargada ? propio.intento : intento;
  const nombre = imagen ?? '';
  return {
    mostrar: imagen !== undefined && !sinImagen,
    clave: `${nombre}#${reintento}`,
    src: `/cartas/${nombre}${reintento > 0 ? `?r=${reintento}` : ''}`,
    onError: () => {
      marcarFallida(nombre);
      setFallo({ imagen: nombre, intento, cargada: false });
    },
    onLoad: () => {
      marcarCargada(nombre);
      if (propio !== null && !propio.cargada) {
        setFallo({ imagen: propio.imagen, intento: reintento, cargada: true });
      }
    },
  };
}
