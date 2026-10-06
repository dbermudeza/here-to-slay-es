import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-amber-700 text-white hover:bg-amber-800 shadow-sm dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400',
  secundario:
    'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-600 dark:hover:bg-stone-700',
  peligro: 'bg-red-700 text-white hover:bg-red-600',
  fantasma: 'text-stone-700 hover:bg-stone-200 dark:text-stone-200 dark:hover:bg-stone-800',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  pequeno?: boolean;
  /** Si se indica, el botón está desactivado y este texto explica por qué (tooltip). */
  motivo?: string | null;
  children: ReactNode;
}

export function Boton({
  variante = 'secundario',
  pequeno = false,
  motivo,
  className = '',
  children,
  ...resto
}: Props) {
  const desactivado = resto.disabled === true || (motivo !== undefined && motivo !== null);
  const boton = (
    <button
      type="button"
      {...resto}
      disabled={desactivado}
      aria-disabled={desactivado}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-45 ${
        pequeno ? 'px-2.5 py-1 text-sm' : 'px-4 py-2'
      } ${VARIANTES[variante]} ${className}`}
    >
      {children}
    </button>
  );
  // Los botones desactivados no reciben eventos de ratón: el tooltip va en un envoltorio.
  return motivo ? (
    <span title={motivo} className="inline-flex" data-motivo={motivo}>
      {boton}
    </span>
  ) : (
    boton
  );
}
