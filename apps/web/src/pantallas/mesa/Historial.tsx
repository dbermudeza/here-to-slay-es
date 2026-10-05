import { describirEvento, eventoParaJugador } from '@hts/engine';
import { useEffect, useMemo, useRef } from 'react';
import { t } from '../../i18n';
import { useMesa } from './contexto';

/** Líneas del historial en español. En modo "este dispositivo" se ven como espectador. */
function useLineas(): string[] {
  const m = useMesa();
  const { director } = m;
  const espectador = director.config.modo === 'local' ? null : m.yo;
  const n = director.eventos.length;

  return useMemo(() => {
    const nombres = { carta: m.nombreCarta, jugador: m.nombreJugador };
    return director.eventos
      .map((e) => describirEvento(eventoParaJugador(e, espectador), nombres))
      .filter((x): x is string => x !== null)
      .slice(-200);
    // `n` cambia cuando llegan eventos nuevos (el array se muta en el director).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, espectador]);
}

/** Historial de la partida. */
export function Historial() {
  const lista = useRef<HTMLOListElement>(null);
  const lineas = useLineas();

  useEffect(() => {
    lista.current?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }, [lineas.length]);

  return (
    <aside aria-label={t('mesa.log')} className="flex min-h-0 flex-col">
      <h2 className="mb-1 text-sm font-semibold">{t('mesa.log')}</h2>
      <ol
        ref={lista}
        // Lista con desplazamiento: enfocable para poder recorrerla con el teclado.
        tabIndex={0}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded pr-1 text-sm leading-snug focus-visible:outline-2 focus-visible:outline-amber-500"
      >
        {lineas.map((l, i) => (
          <li key={i} className="rounded px-1 odd:bg-stone-200/50 dark:odd:bg-stone-800/50">
            {l}
          </li>
        ))}
      </ol>
    </aside>
  );
}

/** Lee en voz alta (lectores de pantalla) cada nueva línea del historial. Va una sola vez en la mesa. */
export function Anunciador() {
  const lineas = useLineas();
  return (
    <p className="sr-only" role="log" aria-live="polite" aria-atomic="true">
      {lineas[lineas.length - 1] ?? ''}
    </p>
  );
}
