import type { Uid } from '@hts/engine';
import { useState } from 'react';
import { useCarta } from '../../estado/contexto';
import { t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { Carta } from '../../ui/Carta';
import { useMesa } from './contexto';

/** La mano del jugador que mira, con las acciones de la carta seleccionada. */
export function Mano() {
  const m = useMesa();
  const yo = m.vista.jugadores.find((j) => j.id === m.yo);
  const [sel, setSel] = useState<Uid | null>(null);
  const mano = yo?.mano ?? [];
  const seleccionada = sel !== null && mano.includes(sel) ? sel : null;

  return (
    <section aria-label={t('mesa.mano')}>
      <h2 className="mb-1 text-sm font-semibold">{t('mesa.mano')}</h2>
      {mano.length === 0 ? (
        <p className="text-sm text-stone-500">{t('mesa.manoVacia')}</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {mano.map((uid) => (
            <Carta
              key={uid}
              cartaId={m.idDe(uid)}
              tamano="md"
              seleccionada={uid === seleccionada}
              onZoom={m.ampliar}
              titulo={t('mesa.acciones.dobleClic')}
              onDoubleClick={() => m.detalleDe(uid)}
              onClick={() => {
                m.setEquipando(null);
                setSel(uid === seleccionada ? null : uid);
              }}
            />
          ))}
        </div>
      )}
      {seleccionada !== null && (
        <AccionesCarta uid={seleccionada} alTerminar={() => setSel(null)} />
      )}
    </section>
  );
}

function AccionesCarta({ uid, alTerminar }: { uid: Uid; alTerminar: () => void }) {
  const m = useMesa();
  const carta = useCarta(m.idDe(uid));
  if (carta === undefined) return null;

  let contenido;
  if (carta.tipo === 'heroe' || carta.tipo === 'magia') {
    const jugar = { tipo: 'JUGAR_CARTA' as const, uid };
    contenido = (
      <Boton
        variante="primario"
        motivo={m.motivo(jugar)}
        onClick={() => {
          m.enviar(jugar);
          alTerminar();
        }}
      >
        {t('mesa.acciones.jugar')} · {t('mesa.acciones.coste', { n: 1 })}
      </Boton>
    );
  } else if (carta.tipo === 'objeto' || carta.tipo === 'objeto_maldito') {
    const posibles = m.legales.filter((a) => a.tipo === 'JUGAR_CARTA' && a.uid === uid);
    const primerHueco = m.vista.jugadores
      .flatMap((j) => j.grupo)
      .find((r) => r.objeto === null)?.heroe;
    const motivo =
      posibles.length > 0
        ? null
        : m.motivo({ tipo: 'JUGAR_CARTA', uid, objetivo: primerHueco ?? '' });
    contenido =
      m.equipando === uid ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            {t('mesa.acciones.eligeObjetivo', { carta: carta.nombre })}
          </span>
          <Boton pequeno variante="fantasma" onClick={() => m.setEquipando(null)}>
            {t('mesa.acciones.cancelar')}
          </Boton>
        </div>
      ) : (
        <Boton variante="primario" motivo={motivo} onClick={() => m.setEquipando(uid)}>
          {t('mesa.acciones.equipar')} · {t('mesa.acciones.coste', { n: 1 })}
        </Boton>
      );
  } else {
    contenido = (
      <span className="text-sm text-stone-600 dark:text-stone-400">
        {t('mesa.acciones.soloRespuesta')}
      </span>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-3 rounded-lg bg-white p-2 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
      <span className="font-semibold">{carta.nombre}</span>
      {contenido}
      <Boton pequeno variante="fantasma" onClick={() => m.verDetalle({ cartaId: carta.id })}>
        {t('mesa.acciones.verDetalle')}
      </Boton>
    </div>
  );
}
