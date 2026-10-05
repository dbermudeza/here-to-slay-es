import type { JugadorId } from '@hts/engine';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { CAPA } from '../../ui/capas';
import { useMesa } from './contexto';

const CARAS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const DURACION_MS = 1600;

interface TiradaVisible {
  id: number;
  jugador: JugadorId;
  dados: [number, number];
}

/** Animación de dados, visible para todos, cada vez que alguien tira. */
export function Dados() {
  const m = useMesa();
  const eventos = m.director.eventos;
  const visto = useRef(eventos.length);
  const [tiradas, setTiradas] = useState<TiradaVisible[]>([]);

  useEffect(() => {
    const nuevos = eventos.slice(visto.current);
    visto.current = eventos.length;
    const nuevas: TiradaVisible[] = [];
    nuevos.forEach((e, i) => {
      if (e.tipo === 'dadosTirados')
        nuevas.push({ id: visto.current + i, jugador: e.jugador, dados: e.dados });
    });
    if (nuevas.length === 0) return undefined;
    setTiradas(nuevas);
    const id = window.setTimeout(() => setTiradas([]), DURACION_MS);
    return () => window.clearTimeout(id);
  }, [eventos, eventos.length]);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-16 ${CAPA.dados} flex justify-center gap-3`}
    >
      <AnimatePresence>
        {tiradas.map((tir) => (
          <motion.div
            key={tir.id}
            role="status"
            aria-label={t('dados.titulo')}
            className="rounded-2xl bg-white/95 px-5 py-3 text-center shadow-2xl ring-1 ring-stone-300 dark:bg-stone-900/95 dark:ring-stone-600"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="text-sm font-semibold">{m.nombreJugador(tir.jugador)}</div>
            <div className="flex items-center justify-center gap-2 text-5xl leading-none">
              {tir.dados.map((d, i) => (
                <motion.span
                  key={i}
                  initial={{ rotate: -360, scale: 0.4 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                >
                  {CARAS[d - 1]}
                </motion.span>
              ))}
              <span className="text-2xl font-bold">
                {t('dados.suma', { n: tir.dados[0] + tir.dados[1] })}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
