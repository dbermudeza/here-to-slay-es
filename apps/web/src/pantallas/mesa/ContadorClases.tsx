import { CLASES } from '@hts/cards';
import type { DesgloseClases } from '@hts/engine';
import { useId, useState } from 'react';
import { t } from '../../i18n';

export type EstadoClases = 'normal' | 'cerca' | 'listo';

/**
 * Criterio del color: "listo" (verde) solo si las clases YA bastan para ganar según las reglas
 * (normales: 6; difíciles: 6 con 1 Monstruo, o 3 con 4 Monstruos). "cerca" (ámbar): 5 clases, o
 * 6 que todavía no bastan (difíciles sin Monstruo). No promete nada que no sea una victoria real.
 */
export function estadoClases(
  total: number,
  monstruos: number,
  modo: 'normal' | 'dificil',
): EstadoClases {
  const gana =
    modo === 'normal'
      ? total >= 6
      : (total >= 6 && monstruos >= 1) || (total >= 3 && monstruos >= 4);
  if (gana) return 'listo';
  return total >= 5 ? 'cerca' : 'normal';
}

const COLOR_TEXTO: Record<EstadoClases, string> = {
  normal: 'text-stone-600 dark:text-stone-400',
  cerca: 'font-semibold text-amber-800 dark:text-amber-300',
  listo: 'font-semibold text-emerald-800 dark:text-emerald-300',
};

interface Props {
  jugadorId: string;
  nombreJugador: string;
  desglose: DesgloseClases;
  monstruos: number;
  modo: 'normal' | 'dificil';
  nombreCarta: (cartaId: string) => string;
}

/** «Clases: N/6» con un desglose desplegable (botón con aria-expanded: ratón, teclado y táctil). */
export function ContadorClases({
  jugadorId,
  nombreJugador,
  desglose,
  monstruos,
  modo,
  nombreCarta,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const estado = estadoClases(desglose.total, monstruos, modo);

  return (
    <span className="inline-block" data-contador-clases={jugadorId}>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className={`rounded px-1 underline decoration-dotted underline-offset-2 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-amber-700 dark:hover:bg-stone-700 ${COLOR_TEXTO[estado]}`}
      >
        {t('mesa.contadorClases.etiqueta', { n: desglose.total })}
        {estado !== 'normal' && <span> {t(`mesa.contadorClases.estado.${estado}`)}</span>}
      </button>
      {
        <div
          id={id}
          hidden={!abierto}
          role="group"
          aria-label={t('mesa.contadorClases.titulo', { nombre: nombreJugador })}
          className="mt-1 w-72 max-w-full rounded-lg bg-white p-2 text-xs text-stone-800 shadow ring-1 ring-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-600"
        >
          <ul className="space-y-1">
            {CLASES.map((clase) => {
              const aportes = desglose.porClase[clase];
              return (
                <li key={clase} data-clase={clase} className="flex items-baseline gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 shrink-0 self-center rounded-full ring-1 ring-stone-400"
                    style={{ backgroundColor: `var(--color-${clase})` }}
                  />
                  <span className="font-semibold">{t(`clases.${clase}`)}:</span>
                  {aportes.length === 0 ? (
                    <span className="text-stone-600 dark:text-stone-400">
                      {t('mesa.contadorClases.falta')}
                    </span>
                  ) : (
                    <span>
                      {aportes.map((a, i) => (
                        <span key={a.uid}>
                          {i > 0 && ', '}
                          {nombreCarta(a.carta)}
                          {a.origen === 'lider' && ` ${t('mesa.contadorClases.lider')}`}
                          {a.origen === 'mascara' &&
                            ` ${t('mesa.contadorClases.mascara', {
                              objeto: a.objeto === undefined ? '' : nombreCarta(a.objeto),
                            })}`}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-stone-600 dark:text-stone-400">
            {t(`mesa.contadorClases.nota.${modo}`)}
          </p>
        </div>
      }
    </span>
  );
}
