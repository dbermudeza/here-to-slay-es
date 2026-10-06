import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useAhora } from '../../../estado/contexto';
import { useReducirAnimaciones } from '../../../estado/app';
import { conSigno, t } from '../../../i18n';
import { Boton } from '../../../ui/Boton';
import { useMesa } from '../contexto';

/** Posiciones (0-8, rejilla de 3×3) de los puntos de cada cara del dado. */
const PUNTOS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Un dado con su cara dibujada. Rueda al aparecer (salvo con "Reducir animaciones"). */
export function Dado({ valor, retardo = 0 }: { valor: number; retardo?: number }) {
  const reducir = useReducirAnimaciones();
  const puntos = PUNTOS[valor] ?? [];
  return (
    <motion.div
      role="img"
      aria-label={t('ventana.dado', { n: valor })}
      className="grid h-14 w-14 grid-cols-3 grid-rows-3 gap-0.5 rounded-xl bg-white p-2 shadow-lg ring-2 ring-stone-300 sm:h-[4.5rem] sm:w-[4.5rem] dark:bg-stone-100 dark:ring-stone-400"
      initial={reducir ? false : { rotate: -420, scale: 0.2, opacity: 0, y: -40 }}
      animate={reducir ? { opacity: 1 } : { rotate: 0, scale: 1, opacity: 1, y: 0 }}
      transition={
        reducir
          ? { duration: 0.12 }
          : { type: 'spring', stiffness: 140, damping: 14, delay: retardo }
      }
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`m-auto h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 ${
            puntos.includes(i) ? 'bg-stone-900' : 'bg-transparent'
          }`}
        />
      ))}
    </motion.div>
  );
}

const CIRCUNFERENCIA = 2 * Math.PI * 22;

/** Cuenta atrás circular (SVG) con los segundos que quedan en el centro. */
export function AnilloCuenta() {
  const { director } = useMesa();
  useAhora(true);
  const restante = director.restanteMs();
  const total = director.plazo?.duracionMs ?? 1;
  if (restante === null) {
    return (
      <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-800 shadow-lg dark:bg-stone-900 dark:text-amber-300">
        {t('ventana.pausa')}
      </div>
    );
  }
  const fraccion = Math.max(0, Math.min(1, restante / total));
  const segundos = Math.ceil(restante / 1000);
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={t('ventana.cuentaAtras')}
      className="relative h-14 w-14 rounded-full bg-white shadow-lg dark:bg-stone-900"
    >
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="26"
          cy="26"
          r="22"
          fill="none"
          strokeWidth="4"
          className="stroke-stone-200 dark:stroke-stone-700"
        />
        <circle
          cx="26"
          cy="26"
          r="22"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-amber-600 transition-[stroke-dashoffset] duration-100 ease-linear dark:stroke-amber-400"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - fraccion)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums text-stone-900 dark:text-stone-50">
        {t('ventana.segundos', { s: segundos })}
      </span>
    </div>
  );
}

/** Título de cada escena: un rótulo opaco (legible sobre la mesa oscurecida). */
export function Titular({
  titulo,
  subtitulo,
  impacto = false,
}: {
  titulo: string;
  subtitulo?: string | undefined;
  impacto?: boolean;
}) {
  const reducir = useReducirAnimaciones();
  return (
    <motion.div
      className="max-w-[min(36rem,92vw)] text-balance rounded-2xl bg-white px-5 py-3 text-center shadow-2xl ring-1 ring-stone-300 dark:bg-stone-900 dark:ring-stone-600"
      initial={reducir ? false : { opacity: 0, scale: impacto ? 1.7 : 0.9, y: -12 }}
      animate={reducir ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
      transition={
        reducir
          ? { duration: 0.12 }
          : impacto
            ? { type: 'spring', stiffness: 260, damping: 16 }
            : { duration: 0.3, ease: 'easeOut' }
      }
    >
      <h2
        className={`font-titulo font-bold ${
          impacto
            ? 'text-2xl uppercase tracking-wide text-red-800 sm:text-4xl dark:text-red-300'
            : 'text-xl text-stone-900 sm:text-2xl dark:text-stone-50'
        }`}
      >
        {titulo}
      </h2>
      {subtitulo !== undefined && (
        <p className="mt-0.5 text-sm text-stone-700 dark:text-stone-300">{subtitulo}</p>
      )}
    </motion.div>
  );
}

export interface ModificacionVista {
  valor: number;
  /** Quién jugó el Modificador. */
  jugador: string;
  carta: string;
}

/** Ficha de una tirada: jugador, dados, Modificadores que se van sumando y total. */
export function FichaTirada({
  nombre,
  etiqueta,
  dados,
  modificaciones,
  total,
  estado = 'normal',
  children,
}: {
  nombre: string;
  etiqueta?: string | undefined;
  dados: [number, number];
  modificaciones: ModificacionVista[];
  total: number;
  /** En el resultado de un duelo: quién gana y quién pierde. */
  estado?: 'normal' | 'ganador' | 'perdedor';
  children?: ReactNode;
}) {
  const reducir = useReducirAnimaciones();
  return (
    <div
      data-ficha=""
      className={`flex w-full max-w-[17rem] flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-2xl ring-2 transition dark:bg-stone-900 ${
        estado === 'ganador'
          ? 'ring-amber-500 dark:ring-amber-400'
          : estado === 'perdedor'
            ? 'opacity-80 ring-stone-300 dark:ring-stone-600'
            : 'ring-stone-300 dark:ring-stone-600'
      }`}
    >
      <div className="text-center leading-tight">
        {etiqueta !== undefined && (
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
            {etiqueta}
          </div>
        )}
        <div className="font-titulo text-lg font-bold text-stone-900 dark:text-stone-50">
          {nombre}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Dado valor={dados[0]} />
        <Dado valor={dados[1]} retardo={0.1} />
      </div>
      <ul className="flex min-h-9 flex-wrap items-center justify-center gap-1.5">
        {modificaciones.map((x, i) => (
          <motion.li
            key={i}
            title={x.carta}
            aria-label={t('ventana.modificadorDe', { valor: conSigno(x.valor), nombre: x.jugador })}
            className={`flex flex-col items-center rounded-lg px-2 py-0.5 leading-tight ${
              x.valor >= 0
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50'
                : 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-50'
            }`}
            initial={reducir ? false : { opacity: 0, scale: 0.2, y: -30, rotate: -12 }}
            animate={reducir ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
            transition={
              reducir ? { duration: 0.12 } : { type: 'spring', stiffness: 300, damping: 15 }
            }
          >
            <span className="text-lg font-bold" aria-hidden="true">
              {conSigno(x.valor)}
            </span>
            <span className="text-[11px]" aria-hidden="true">
              {x.jugador}
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="flex items-baseline gap-2 text-stone-900 dark:text-stone-50">
        <span className="text-sm font-semibold">{t('ventana.total')}</span>
        <motion.span
          key={total}
          className="font-titulo text-4xl font-bold tabular-nums"
          initial={reducir ? false : { scale: 1.6, opacity: 0.4 }}
          animate={reducir ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={
            reducir ? { duration: 0.12 } : { type: 'spring', stiffness: 300, damping: 14 }
          }
        >
          {total}
        </motion.span>
      </div>
      {children}
    </div>
  );
}

/** Botones "Responde X" (modo este dispositivo) y "He terminado". */
export function Respondedores() {
  const m = useMesa();
  const { director } = m;
  if (director.config.modo !== 'local') return null;
  if (director.respondiendo !== null) {
    return director.respondiendo === m.yo ? (
      <Boton data-terminar-respuesta onClick={() => director.terminarRespuesta()}>
        {t('ventana.terminarRespuesta')}
      </Boton>
    ) : null;
  }
  const otros = director.respondedoresPosibles().filter((id) => id !== m.yo);
  if (otros.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 shadow-xl dark:bg-stone-900">
      <span className="text-sm text-stone-900 dark:text-stone-100">
        {t('ventana.responderAqui')}
      </span>
      {otros.map((id) => (
        <Boton key={id} pequeno data-responde={id} onClick={() => director.responder(id)}>
          {t('ventana.responde', { nombre: m.nombreJugador(id) })}
        </Boton>
      ))}
    </div>
  );
}
