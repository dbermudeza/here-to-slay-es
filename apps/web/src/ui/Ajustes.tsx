import { useReducirAnimaciones, useApp } from '../estado/app';
import { t } from '../i18n';
import { SelectorTema } from './SelectorTema';

/** Interruptor accesible (role="switch"). */
export function Interruptor({
  activo,
  etiqueta,
  onCambiar,
}: {
  activo: boolean;
  etiqueta: string;
  onCambiar: (activo: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onCambiar(!activo)}
      className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      <span
        aria-hidden
        className={`relative h-5 w-9 rounded-full transition-colors ${
          activo ? 'bg-amber-600 dark:bg-amber-500' : 'bg-stone-400 dark:bg-stone-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${
            activo ? 'left-4.5' : 'left-0.5'
          }`}
        />
      </span>
      {etiqueta}
    </button>
  );
}

/** Ajustes de presentación: tema y animaciones. */
export function Ajustes() {
  const reducir = useReducirAnimaciones();
  const cambiar = useApp((s) => s.cambiarReducirAnimaciones);
  return (
    <div className="flex flex-col items-center gap-2">
      <SelectorTema />
      <Interruptor activo={reducir} etiqueta={t('comun.reducirAnimaciones')} onCambiar={cambiar} />
    </div>
  );
}
