import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CAPA } from './capas';

interface Props {
  abierto: boolean;
  titulo?: string;
  /** Si se indica, la ventana se puede cerrar (Escape, clic fuera). Sin él, es una decisión obligatoria. */
  onCerrar?: () => void;
  ancho?: 'sm' | 'md' | 'lg' | 'xl';
  /** Opaco: tapa por completo la mesa (pantalla de pasar el dispositivo). */
  opaco?: boolean;
  children: ReactNode;
}

const ANCHOS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

const ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function enfocables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
    (el) => el.getClientRects().length > 0,
  );
}

/**
 * Panel de la ventana: al abrirse lleva el foco dentro, lo mantiene dentro con Tab/Mayús+Tab, se
 * cierra con Escape (si se puede cerrar) y al cerrarse devuelve el foco a donde estaba.
 */
function Panel({
  titulo,
  onCerrar,
  ancho,
  children,
}: Omit<Props, 'abierto' | 'opaco' | 'ancho'> & { ancho: NonNullable<Props['ancho']> }) {
  const idTitulo = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = panel.current;
    if (el !== null) (enfocables(el)[0] ?? el).focus({ preventScroll: true });
    return () => {
      if (previo !== null && previo.isConnected) previo.focus({ preventScroll: true });
    };
  }, []);

  // Si el contenido cambia (otra pregunta) y el elemento enfocado desaparece, el foco vuelve dentro
  // (solo si se ha perdido: con dos ventanas abiertas, no se le quita a la de encima).
  useEffect(() => {
    const el = panel.current;
    const activo = document.activeElement;
    if (el !== null && (activo === null || activo === document.body))
      (enfocables(el)[0] ?? el).focus({ preventScroll: true });
  });

  const teclado = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape' && onCerrar !== undefined) {
      e.stopPropagation();
      onCerrar();
      return;
    }
    if (e.key !== 'Tab' || panel.current === null) return;
    const lista = enfocables(panel.current);
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (primero === undefined || ultimo === undefined) {
      e.preventDefault();
      return;
    }
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || activo === panel.current)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titulo === undefined ? undefined : idTitulo}
      tabIndex={-1}
      onKeyDown={teclado}
      className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none dark:bg-stone-900 ${ANCHOS[ancho]}`}
      initial={{ scale: 0.96, y: 8 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.96, y: 8 }}
    >
      {titulo !== undefined && (
        <h2 id={idTitulo} className="mb-4 font-titulo text-xl font-semibold">
          {titulo}
        </h2>
      )}
      {children}
    </motion.div>
  );
}

export function Modal({ abierto, titulo, onCerrar, ancho = 'md', opaco = false, children }: Props) {
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className={`fixed inset-0 ${CAPA.modal} flex items-center justify-center p-4 ${
            opaco ? 'bg-stone-950' : 'bg-stone-950/60 backdrop-blur-[2px]'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onCerrar?.();
          }}
        >
          <Panel
            {...(titulo === undefined ? {} : { titulo })}
            {...(onCerrar === undefined ? {} : { onCerrar })}
            ancho={ancho}
          >
            {children}
          </Panel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
