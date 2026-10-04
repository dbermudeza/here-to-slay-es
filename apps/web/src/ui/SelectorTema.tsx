import { useApp, type Tema } from '../estado/app';
import { t } from '../i18n';

const TEMAS: Tema[] = ['sistema', 'claro', 'oscuro'];

export function SelectorTema() {
  const { tema, cambiarTema } = useApp();
  return (
    <div
      role="radiogroup"
      aria-label={t('comun.tema')}
      className="inline-flex rounded-lg bg-stone-200 p-1 dark:bg-stone-800"
    >
      {TEMAS.map((x) => (
        <button
          key={x}
          type="button"
          role="radio"
          aria-checked={tema === x}
          onClick={() => cambiarTema(x)}
          className={`rounded-md px-3 py-1 text-sm ${
            tema === x ? 'bg-white shadow dark:bg-stone-600' : 'text-stone-600 dark:text-stone-400'
          }`}
        >
          {t(`comun.temas.${x}`)}
        </button>
      ))}
    </div>
  );
}
