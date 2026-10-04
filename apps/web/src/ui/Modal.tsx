import { AnimatePresence, motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';

interface Props {
  abierto: boolean;
  titulo?: string;
  onCerrar?: () => void;
  ancho?: 'sm' | 'md' | 'lg' | 'xl';
  /** Opaco: tapa por completo la mesa (pantalla de pasar el dispositivo). */
  opaco?: boolean;
  children: ReactNode;
}

const ANCHOS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ abierto, titulo, onCerrar, ancho = 'md', opaco = false, children }: Props) {
  const idTitulo = useId();
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className={`fixed inset-0 z-40 flex items-center justify-center p-4 ${
            opaco ? 'bg-stone-950' : 'bg-stone-950/60 backdrop-blur-[2px]'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onCerrar?.();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titulo === undefined ? undefined : idTitulo}
            className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-stone-900 ${ANCHOS[ancho]}`}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
