import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useReducirAnimaciones } from '../../estado/app';
import { agruparVuelos, verVuelo, type Vuelo } from '../../juego/vuelos';
import { Carta } from '../../ui/Carta';
import { useMesa } from './contexto';

/** Duración de un vuelo; más corta si hay cola, para no quedarse atrás. */
const DURACION_MS = 1900;
const DURACION_RAPIDA_MS = 1000;
/** Con "reducir animaciones" la carta no vuela: aparece en el centro con su texto y se desvanece. */
const DURACION_REDUCIDA_MS = 1200;
/** Vuelos pendientes como máximo (si se acumulan más, se descartan los más antiguos). */
const MAX_COLA = 4;

/** Desplazamiento desde el centro de la pantalla hasta el centro de una zona de la mesa. */
function desplazamiento(zona: string): { x: number; y: number } {
  const el = document.querySelector<HTMLElement>(`[data-zona="${zona}"]`);
  const r = el?.getBoundingClientRect();
  if (r === undefined || (r.width === 0 && r.height === 0)) return { x: 0, y: 0 };
  return {
    x: r.left + r.width / 2 - window.innerWidth / 2,
    y: r.top + r.height / 2 - window.innerHeight / 2,
  };
}

/**
 * Animación de cartas que cambian de sitio: salen de su origen, se detienen en el centro con un texto
 * que explica qué ha pasado (y qué carta es, si el que mira puede verla) y vuelan a su destino.
 */
export function Vuelos() {
  const m = useMesa();
  const { director } = m;
  const n = director.eventos.length;
  const visto = useRef(n);
  const siguienteId = useRef(1);
  const [cola, setCola] = useState<Vuelo[]>([]);

  // Nuevos eventos → nuevos vuelos en la cola.
  useEffect(() => {
    const nuevos = director.eventos.slice(visto.current);
    visto.current = n;
    const vuelos = agruparVuelos(nuevos, siguienteId.current);
    if (vuelos.length === 0) return;
    siguienteId.current += vuelos.length;
    setCola((c) => [...c, ...vuelos].slice(-MAX_COLA));
  }, [director, n]);

  // En modo "este dispositivo" no se anima nada mientras se pasa el dispositivo.
  const enPausa = director.traspaso !== null;
  const actual = enPausa ? undefined : cola[0];
  const reducir = useReducirAnimaciones();
  const duracion = reducir
    ? DURACION_REDUCIDA_MS
    : cola.length > 2
      ? DURACION_RAPIDA_MS
      : DURACION_MS;

  useEffect(() => {
    if (actual === undefined) return undefined;
    const id = window.setTimeout(
      () => setCola((c) => c.filter((v) => v.id !== actual.id)),
      duracion,
    );
    return () => window.clearTimeout(id);
  }, [actual, duracion]);

  const visible =
    actual === undefined ? null : verVuelo(actual, m.yo, m.nombreJugador, m.nombreCarta);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      aria-live="polite"
    >
      <AnimatePresence>
        {actual !== undefined && visible !== null && (
          <VueloAnimado
            key={actual.id}
            visible={visible}
            duracion={duracion}
            nombreCarta={m.nombreCarta}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function VueloAnimado({
  visible,
  duracion,
  nombreCarta,
}: {
  visible: NonNullable<ReturnType<typeof verVuelo>>;
  duracion: number;
  nombreCarta: (id: string) => string;
}) {
  // Las posiciones se miden una vez, al empezar el vuelo.
  const [ruta] = useState(() => ({
    desde: desplazamiento(visible.origen),
    hasta: desplazamiento(visible.destino),
  }));
  return (
    <motion.div
      role="status"
      aria-label={visible.texto}
      className="flex flex-col items-center gap-2"
      initial={{ x: ruta.desde.x, y: ruta.desde.y, scale: 0.3, opacity: 0 }}
      animate={{
        x: [ruta.desde.x, 0, 0, ruta.hasta.x],
        y: [ruta.desde.y, 0, 0, ruta.hasta.y],
        scale: [0.3, 1, 1, 0.25],
        opacity: [0, 1, 1, 0],
      }}
      transition={{ duration: duracion / 1000, times: [0, 0.22, 0.72, 1], ease: 'easeInOut' }}
    >
      <div className="flex gap-2">
        {visible.cartas.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Carta cartaId={c} tamano="lg" className="shadow-2xl" />
            {c !== null && (
              <span className="rounded bg-white/95 px-2 text-sm font-semibold shadow dark:bg-stone-900/95">
                {nombreCarta(c)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-stone-900/90 px-4 py-2 text-center font-semibold text-white shadow-xl">
        {visible.texto}
      </div>
    </motion.div>
  );
}
