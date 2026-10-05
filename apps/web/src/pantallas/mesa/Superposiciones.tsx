import { t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { Modal } from '../../ui/Modal';
import { useMesa } from './contexto';

/** Modo "este dispositivo": tapa la mesa hasta que el siguiente jugador confirma que es él. */
export function Traspaso() {
  const m = useMesa();
  const id = m.director.traspaso;
  if (id === null) return null;
  const nombre = m.nombreJugador(id);
  return (
    <Modal abierto opaco ancho="sm">
      <div className="space-y-4 text-center">
        <h2 className="font-titulo text-2xl font-bold">{t('traspaso.titulo', { nombre })}</h2>
        <p className="text-stone-600 dark:text-stone-400">{t('traspaso.texto')}</p>
        <Boton
          variante="primario"
          data-traspaso={id}
          onClick={() => m.director.confirmarTraspaso()}
        >
          {t('traspaso.soy', { nombre })}
        </Boton>
      </div>
    </Modal>
  );
}

export function Victoria({
  onRevancha,
  onInicio,
  textoRevancha,
}: {
  onRevancha: () => void;
  onInicio: () => void;
  textoRevancha?: string | undefined;
}) {
  const m = useMesa();
  const g = m.vista.ganador;
  if (g === null) return null;
  return (
    <Modal abierto ancho="sm">
      <div className="space-y-3 text-center">
        <div className="text-5xl" aria-hidden>
          🏆
        </div>
        <h2 className="font-titulo text-2xl font-bold">
          {t('victoria.titulo', { nombre: m.nombreJugador(g.jugador) })}
        </h2>
        <p>{t(`victoria.motivos.${g.motivo}`)}</p>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {t('victoria.turnos', { n: m.vista.turno.numero })}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Boton variante="primario" onClick={onRevancha}>
            {textoRevancha ?? t('victoria.revancha')}
          </Boton>
          <Boton onClick={onInicio}>{t('victoria.inicio')}</Boton>
        </div>
      </div>
    </Modal>
  );
}
