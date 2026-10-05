import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useReducirAnimaciones } from '../../estado/app';
import { t } from '../../i18n';
import { CELEBRACION_MS } from '../../juego/fuente';
import { Carta } from '../../ui/Carta';
import { CAPA } from '../../ui/capas';

/** Fases de la secuencia, con su inicio (ms) sobre la duración nominal de 4 s. */
type Fase = 'carta' | 'espada' | 'corte' | 'texto';
const INICIO: Record<Fase, number> = { carta: 0, espada: 500, corte: 900, texto: 1700 };
const ORDEN: Fase[] = ['carta', 'espada', 'corte', 'texto'];
/** Con "Reducir animaciones": la carta y, enseguida, el texto. */
const INICIO_TEXTO_REDUCIDO = 1200;

/** Diagonal del corte: de la esquina superior derecha a la inferior izquierda. */
const MITAD_ARRIBA = 'polygon(0 0, 100% 0, 0 100%)';
const MITAD_ABAJO = 'polygon(100% 0, 100% 100%, 0 100%)';

interface Props {
  cartaId: string;
  nombreJugador: string;
  nombreMonstruo: string;
  /** Duración total de la celebración (ms). */
  duracionMs: number;
  /** Lo que queda al montar (ms): permite arrancar a mitad si se reconecta. */
  restanteMs: number;
}

function faseEn(transcurrido: number, factor: number, reducir: boolean): Fase {
  if (reducir) return transcurrido >= INICIO_TEXTO_REDUCIDO * factor ? 'texto' : 'carta';
  let fase: Fase = 'carta';
  for (const f of ORDEN) if (transcurrido >= INICIO[f] * factor) fase = f;
  return fase;
}

/** Espada dibujada en SVG: hoja, guarda y empuñadura. Apunta hacia abajo. */
function Espada() {
  return (
    <svg viewBox="0 0 40 220" className="h-[58vmin] w-auto drop-shadow-2xl" aria-hidden="true">
      <defs>
        <linearGradient id="hoja" x1="0" x2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="0.5" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="oro" x1="0" x2="1">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="0.5" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
      </defs>
      {/* Pomo, empuñadura y guarda (arriba) */}
      <circle cx="20" cy="8" r="7" fill="url(#oro)" />
      <rect x="16" y="14" width="8" height="36" rx="3" fill="#44403c" />
      <path d="M17 20h6M17 28h6M17 36h6M17 44h6" stroke="#a8a29e" strokeWidth="1.5" />
      <path d="M2 52c8-7 28-7 36 0l-3 7H5z" fill="url(#oro)" />
      {/* Hoja (hacia abajo) */}
      <path d="M12 59h16l-1 140-7 20-7-20z" fill="url(#hoja)" />
      <path d="M20 59v158" stroke="#475569" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

/**
 * Celebración al derrotar a un Monstruo: la carta aparece en grande, una espada la parte en dos y
 * aparece "¡X ha derrotado a Y!". Tapa y bloquea la mesa (nadie puede jugar mientras dure). Es solo
 * visual (`aria-hidden`): el historial ya anuncia la muerte del Monstruo.
 */
export function CelebracionMonstruo({
  cartaId,
  nombreJugador,
  nombreMonstruo,
  duracionMs,
  restanteMs,
}: Props) {
  const reducir = useReducirAnimaciones();
  const factor = Math.min(1, Math.max(duracionMs, 1) / CELEBRACION_MS);
  const [fase, setFase] = useState<Fase>(() =>
    faseEn(Math.max(0, duracionMs - restanteMs), factor, reducir),
  );

  useEffect(() => {
    const transcurrido = Math.max(0, duracionMs - restanteMs);
    const ids: number[] = [];
    const inicios: [Fase, number][] = reducir
      ? [['texto', INICIO_TEXTO_REDUCIDO * factor]]
      : ORDEN.slice(1).map((f) => [f, INICIO[f] * factor]);
    for (const [f, inicio] of inicios) {
      if (inicio > transcurrido)
        ids.push(window.setTimeout(() => setFase(f), inicio - transcurrido));
    }
    return () => ids.forEach((id) => window.clearTimeout(id));
    // Solo al montar (o si cambia el modo de animación): el tiempo corre por los temporizadores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducir]);

  const carta = (clip?: string, clase = '') => (
    <div style={clip === undefined ? undefined : { clipPath: clip }} className={clase}>
      <Carta
        cartaId={cartaId}
        tamano="xl"
        className="w-[min(20rem,60vw,36vh)]! ring-2! ring-amber-300/60! shadow-2xl"
      />
    </div>
  );

  let contenido;
  if (fase === 'texto') {
    contenido = (
      <motion.div
        key="texto"
        initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
        animate={reducir ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: reducir ? 0.2 : 0.45, ease: 'easeOut' }}
        className="max-w-3xl rounded-3xl border border-amber-400/40 bg-stone-950/85 px-8 py-6 text-center shadow-2xl"
      >
        <p
          data-celebracion-texto=""
          className="font-titulo text-4xl font-bold text-amber-300 sm:text-6xl"
        >
          {t('celebracion.titulo', { nombre: nombreJugador, monstruo: nombreMonstruo })}
        </p>
      </motion.div>
    );
  } else if (reducir) {
    contenido = (
      <motion.div
        key="carta"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {carta()}
      </motion.div>
    );
  } else if (fase === 'corte') {
    // Dos copias de la carta, recortadas por la diagonal, se separan, giran y se desvanecen.
    const mitad = (clip: string, signo: 1 | -1) => (
      <motion.div
        key={clip}
        data-mitad=""
        className="absolute inset-0 flex items-center justify-center"
        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
        animate={{ x: signo * 70, y: signo * 70, rotate: signo * 9, opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeIn' }}
      >
        {carta(clip)}
      </motion.div>
    );
    contenido = (
      <div className="relative flex items-center justify-center">
        <div className="invisible">{carta()}</div>
        {mitad(MITAD_ARRIBA, -1)}
        {mitad(MITAD_ABAJO, 1)}
      </div>
    );
  } else {
    contenido = (
      <motion.div
        key="carta"
        className="relative flex items-center justify-center"
        initial={fase === 'carta' ? { opacity: 0, scale: 0.7 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {carta()}
        {fase === 'espada' && (
          <>
            <motion.div
              data-espada=""
              className="absolute inset-0 flex items-center justify-center"
              initial={{ x: '38vmin', y: '-38vmin', rotate: 45, opacity: 1 }}
              animate={{ x: '-38vmin', y: '38vmin', rotate: 45, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeIn' }}
            >
              <Espada />
            </motion.div>
            <motion.div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.4, times: [0, 0.7, 1] }}
            >
              <div className="h-1.5 w-[140%] rotate-[-55deg] rounded-full bg-white shadow-[0_0_30px_12px_rgba(253,230,138,0.9)]" />
            </motion.div>
          </>
        )}
      </motion.div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-celebracion=""
      className={`fixed inset-0 ${CAPA.celebracion} flex items-center justify-center overflow-hidden bg-stone-950/70 p-4 backdrop-blur-sm`}
    >
      {contenido}
    </div>
  );
}
