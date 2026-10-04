import { describirEvento, eventoParaJugador } from '@hts/engine';
import { useEffect, useMemo, useRef } from 'react';
import { t } from '../../i18n';
import { useMesa } from './contexto';

/** Historial de la partida en español. En modo "este dispositivo" se muestra como espectador. */
export function Historial() {
  const m = useMesa();
  const { director } = m;
  const lista = useRef<HTMLOListElement>(null);
  const espectador = director.config.modo === 'local' ? null : m.yo;
  const n = director.eventos.length;

  const lineas = useMemo(() => {
    const nombres = { carta: m.nombreCarta, jugador: m.nombreJugador };
    return director.eventos
      .map((e) => describirEvento(eventoParaJugador(e, espectador), nombres))
      .filter((x): x is string => x !== null)
      .slice(-200);
    // `n` cambia cuando llegan eventos nuevos (el array se muta en el director).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, espectador]);

  useEffect(() => {
    lista.current?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }, [lineas.length]);

  return (
    <aside aria-label={t('mesa.log')} className="flex min-h-0 flex-col">
      <h2 className="mb-1 text-sm font-semibold">{t('mesa.log')}</h2>
      <ol
        ref={lista}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-sm leading-snug"
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
