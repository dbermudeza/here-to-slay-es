import { useAhora } from '../../estado/contexto';
import { t } from '../../i18n';
import { useMesa } from './contexto';

/** Tiempo que le queda al jugador que debe decidir (solo si la partida tiene límite por decisión). */
export function TiempoDecision() {
  const m = useMesa();
  const plazo = m.director.plazoDecision;
  useAhora(plazo !== null, 250);
  const restante = m.director.restanteDecisionMs();
  if (plazo === null || restante === null) return null;
  const segundos = Math.ceil(restante / 1000);
  const texto =
    plazo.jugador === m.yo
      ? t('mesa.tiempoTuyo', { s: segundos })
      : t('mesa.tiempoDe', { nombre: m.nombreJugador(plazo.jugador), s: segundos });
  return (
    <span
      className={`rounded px-2 py-0.5 text-sm tabular-nums ${
        plazo.jugador === m.yo && segundos <= 10
          ? 'bg-red-600 text-white'
          : 'bg-stone-200 dark:bg-stone-800'
      }`}
    >
      {texto}
    </span>
  );
}
