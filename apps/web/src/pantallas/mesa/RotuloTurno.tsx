import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useReducirAnimaciones } from '../../estado/app';
import { t } from '../../i18n';

/** Tiempo que el rótulo permanece visible (sin contar el fundido de salida). */
export const RETARDO_ROTULO_MS = 1800;
const RETARDO_ROTULO_REDUCIDO_MS = 1500;

interface Props {
  /** Número del turno actual. */
  numero: number;
  /** Jugador del turno. */
  jugador: string;
  /** Texto principal ya resuelto ("Tu turno" / "Turno de Ana"). */
  titulo: string;
  /** Hay una pantalla de traspaso encima: el rótulo espera a que se cierre. */
  pausado: boolean;
  /** Anunciar también el turno que ya está en curso al montar (solo el primero de la partida). */
  anunciarAlMontar: boolean;
}

interface Anuncio {
  clave: string;
  titulo: string;
  numero: number;
}

/**
 * Rótulo grande y breve al empezar cada turno. Es solo visual (`aria-hidden`): los lectores de
 * pantalla ya oyen "Turno N: le toca a X" por la región `Anunciador` del historial.
 * No intercepta el ratón ni el foco, y un turno nuevo sustituye al anterior.
 */
export function RotuloTurno({ numero, jugador, titulo, pausado, anunciarAlMontar }: Props) {
  const reducir = useReducirAnimaciones();
  const clave = `${numero}:${jugador}`;
  const ultima = useRef(clave);
  const [anuncio, setAnuncio] = useState<Anuncio | null>(
    anunciarAlMontar ? { clave, titulo, numero } : null,
  );

  // Un turno nuevo (cambia el número o el jugador) sustituye al anuncio anterior.
  useEffect(() => {
    if (ultima.current === clave) return;
    ultima.current = clave;
    setAnuncio({ clave, titulo, numero });
  }, [clave, titulo, numero]);

  // El temporizador solo corre mientras el rótulo es visible (no durante un traspaso).
  const activo = anuncio?.clave;
  useEffect(() => {
    if (activo === undefined || pausado) return undefined;
    const id = window.setTimeout(
      () => setAnuncio((a) => (a?.clave === activo ? null : a)),
      reducir ? RETARDO_ROTULO_REDUCIDO_MS : RETARDO_ROTULO_MS,
    );
    return () => window.clearTimeout(id);
  }, [activo, pausado, reducir]);

  const visible = anuncio !== null && !pausado;

  return (
    <div
      aria-hidden="true"
      data-rotulo-turno=""
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4"
    >
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={anuncio.clave}
            initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={reducir ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
            transition={{ duration: reducir ? 0.12 : 0.35, ease: 'easeOut' }}
            className="max-w-full rounded-3xl border border-amber-700/30 bg-white/85 px-10 py-6 text-center shadow-2xl backdrop-blur-md dark:border-amber-400/30 dark:bg-stone-900/85"
          >
            <p className="font-titulo text-4xl font-bold text-amber-800 sm:text-6xl dark:text-amber-300">
              {anuncio.titulo}
            </p>
            <p className="mt-1 text-base text-stone-700 sm:text-lg dark:text-stone-300">
              {t('mesa.turnoNumero', { n: anuncio.numero })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
