import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useReducirAnimaciones } from '../../estado/app';
import { useCarta } from '../../estado/contexto';
import { t } from '../../i18n';
import { Carta } from '../../ui/Carta';
import { CAPA } from '../../ui/capas';

/**
 * Instantes de la secuencia (ms). El giro dura siempre lo mismo (salvo que la presentación sea más
 * corta que ~4 s): el tiempo restante es la permanencia con rayos, chispas y texto.
 */
const FIN_GIRO = 1200;
const INICIO_TEXTO = 1300;
/** Velocidad de giro de los rayos (grados por segundo). */
const GRADOS_RAYOS_POR_S = 12;
/** Con "Reducir animaciones": la carta y, enseguida, el texto. */
const INICIO_TEXTO_REDUCIDO = 500;
/** Vueltas completas sobre el eje Y al entrar. */
const VUELTAS = 2;

/** Chispas: [x %, y %, tamaño (rem), retardo (s), duración (s)]. Posiciones fijas, sin azar. */
const CHISPAS: readonly (readonly [number, number, number, number, number])[] = [
  [12, 22, 1.1, 0, 1.3],
  [24, 70, 0.8, 0.3, 1.1],
  [8, 48, 0.6, 0.6, 1.2],
  [34, 12, 0.7, 0.9, 1.0],
  [40, 84, 1.0, 0.15, 1.4],
  [66, 10, 0.9, 0.45, 1.2],
  [78, 76, 1.2, 0, 1.3],
  [90, 40, 0.7, 0.7, 1.1],
  [88, 18, 1.0, 0.25, 1.4],
  [60, 88, 0.7, 0.8, 1.0],
  [52, 6, 0.6, 0.5, 1.2],
  [18, 88, 0.8, 0.95, 1.1],
  [94, 66, 0.6, 0.1, 1.3],
  [4, 78, 0.9, 0.55, 1.2],
];

const ESTRELLA = 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)';

interface Props {
  /** Id de catálogo del Líder cuya habilidad se activa. */
  cartaId: string;
  nombreJugador: string;
  nombreLider: string;
  /** Duración total de la presentación (ms). */
  duracionMs: number;
  /** Lo que queda al montar (ms): permite arrancar a mitad si se reconecta. */
  restanteMs: number;
}

/**
 * Presentación de la habilidad de un Líder: la carta entra girando sobre su eje Y, estalla un
 * destello con rayos de luz y chispas, y aparece "¡X activa la habilidad de su Líder!". Tapa y
 * bloquea la mesa (nadie juega mientras dure). Es solo visual (`aria-hidden`): el historial ya
 * anuncia el evento. Solo se anima `transform` y `opacity`.
 */
export function PresentacionLider({
  cartaId,
  nombreJugador,
  nombreLider,
  duracionMs,
  restanteMs,
}: Props) {
  const reducir = useReducirAnimaciones();
  const carta = useCarta(cartaId);
  const efecto = carta?.tipo === 'lider' ? carta.texto : '';
  const total = Math.max(duracionMs, 1);
  const finGiro = Math.min(FIN_GIRO, total * 0.3);
  const transcurrido = Math.max(0, duracionMs - restanteMs);
  /** Si se monta con la secuencia ya avanzada (reconexión), se salta el giro. */
  const yaGirada = transcurrido >= finGiro;
  /** Segundos que quedan de permanencia (con rayos) desde que arranca el brillo. */
  const permanenciaS = Math.max((total - Math.max(finGiro, transcurrido)) / 1000, 0.05);
  const [brillo, setBrillo] = useState(yaGirada);

  useEffect(() => {
    if (reducir || brillo) return undefined;
    const id = window.setTimeout(() => setBrillo(true), finGiro - transcurrido);
    return () => window.clearTimeout(id);
    // Solo al montar (o si cambia el modo de animación): el tiempo corre por el temporizador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducir]);

  const inicioTexto = reducir ? INICIO_TEXTO_REDUCIDO : Math.min(INICIO_TEXTO, total * 0.33);
  const retardoTexto = Math.max(0, inicioTexto - transcurrido) / 1000;
  const textoYaVisible = transcurrido >= inicioTexto;
  const anchoCarta = 'w-[min(18rem,50vw,32vh)]!';

  const frente = (
    <Carta
      cartaId={cartaId}
      tamano="xl"
      className={`${anchoCarta} ring-2! ring-amber-300/70! shadow-[0_0_40px_8px_rgba(251,191,36,0.45)]`}
    />
  );

  let tarjeta;
  if (reducir) {
    tarjeta = (
      <motion.div
        data-carta-lider=""
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {frente}
      </motion.div>
    );
  } else {
    tarjeta = (
      <div style={{ perspective: 1400 }}>
        <motion.div
          data-carta-lider=""
          data-giro=""
          className="relative"
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
          initial={yaGirada ? false : { rotateY: -360 * VUELTAS, scale: 0.45, opacity: 0 }}
          animate={{ rotateY: 0, scale: [null, 1.1, 1], opacity: 1 }}
          transition={{
            duration: finGiro / 1000,
            ease: [0.22, 0.7, 0.3, 1],
            scale: { times: [0, 0.8, 1], duration: finGiro / 1000 },
            opacity: { duration: 0.25 },
          }}
        >
          <div style={{ backfaceVisibility: 'hidden' }}>{frente}</div>
          {/* Dorso: se ve mientras la carta está de espaldas. */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <Carta
              cartaId={null}
              tamano="xl"
              className="h-full! w-full! aspect-auto! ring-2! ring-amber-300/70!"
            />
          </div>
          {brillo && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
              <motion.div
                data-reflejo=""
                className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                initial={{ x: '-50%' }}
                animate={{ x: '350%' }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
              />
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-presentacion-lider=""
      className={`fixed inset-0 ${CAPA.presentacionLider} flex flex-col items-center justify-center gap-5 overflow-hidden p-4`}
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(120,53,15,0.55) 0%, rgba(12,10,9,0.9) 68%)',
      }}
    >
      {!reducir && brillo && (
        <>
          {/* Resplandor cálido y destello inicial detrás de la carta. */}
          <motion.div
            data-destello=""
            className="pointer-events-none absolute left-1/2 top-[42%] h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(254,243,199,0.95) 0%, rgba(251,191,36,0.45) 30%, transparent 65%)',
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0.45], scale: [0.4, 1.15, 1] }}
            transition={{ duration: 0.9, times: [0, 0.35, 1], ease: 'easeOut' }}
          />
          {/* Rayos de luz que giran despacio mientras dura la presentación. */}
          <motion.div
            data-rayos=""
            className="pointer-events-none absolute left-1/2 top-[42%] h-[100vmax] w-[100vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'repeating-conic-gradient(from 0deg, rgba(253,224,71,0.42) 0deg 5deg, transparent 5deg 22deg)',
              maskImage: 'radial-gradient(circle closest-side, black 4%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(circle closest-side, black 4%, transparent 100%)',
              willChange: 'transform',
            }}
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: GRADOS_RAYOS_POR_S * permanenciaS }}
            transition={{
              opacity: { duration: 0.5 },
              rotate: { duration: permanenciaS, ease: 'linear' },
            }}
          />
          {/* Chispas. */}
          {CHISPAS.map(([x, y, tam, retardo, dur], i) => (
            <motion.div
              key={i}
              data-chispa=""
              className="pointer-events-none absolute bg-amber-200"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${tam * 1.5}rem`,
                height: `${tam * 1.5}rem`,
                clipPath: ESTRELLA,
              }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3], rotate: [0, 45] }}
              transition={{
                duration: dur,
                delay: retardo,
                // Repite mientras dure la permanencia, un número finito de veces.
                repeat: Math.max(0, Math.ceil((permanenciaS - retardo) / dur) - 1),
              }}
            />
          ))}
        </>
      )}

      <div className="relative flex items-center justify-center">{tarjeta}</div>

      <motion.div
        data-presentacion-texto-caja=""
        className="relative max-w-3xl rounded-3xl bg-stone-950/60 px-6 py-3 text-center"
        initial={
          textoYaVisible ? false : reducir ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 12 }
        }
        animate={reducir ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        transition={{
          duration: reducir ? 0.2 : 0.45,
          delay: retardoTexto,
          ease: 'easeOut',
        }}
      >
        <p
          data-presentacion-texto=""
          className="font-titulo text-3xl font-bold text-amber-300 [text-shadow:0_2px_24px_rgba(251,191,36,0.65)] sm:text-5xl"
        >
          {t('presentacionLider.titulo', { nombre: nombreJugador })}
        </p>
        <p className="mt-2 font-titulo text-lg text-amber-100 sm:text-2xl">{nombreLider}</p>
        {efecto !== '' && (
          <p className="mx-auto mt-1 line-clamp-2 max-w-xl text-sm text-stone-300 sm:text-base">
            {efecto}
          </p>
        )}
      </motion.div>
    </div>
  );
}
