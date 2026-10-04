import { useState } from 'react';
import { t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { Carta } from '../../ui/Carta';
import { Modal } from '../../ui/Modal';
import { useMesa } from './contexto';

/** Monstruos atacables, mazo y pila de descarte. */
export function Centro() {
  const m = useMesa();
  const { vista } = m;
  const [verDescarte, setVerDescarte] = useState(false);
  const superior = vista.descarte[vista.descarte.length - 1];

  return (
    <section className="flex flex-wrap items-start justify-center gap-4 rounded-xl bg-emerald-900/10 p-3 dark:bg-emerald-950/30">
      <div>
        <h2 className="mb-1 text-center text-sm font-semibold">{t('mesa.monstruos')}</h2>
        <div className="flex gap-3">
          {vista.monstruosCentro.map((uid) => {
            const atacar = { tipo: 'ATACAR' as const, uid };
            return (
              <div key={uid} className="flex flex-col items-center gap-1">
                <Carta cartaId={m.idDe(uid)} tamano="md" onZoom={m.ampliar} />
                {m.esMiTurnoLibre && (
                  <Boton pequeno motivo={m.motivo(atacar)} onClick={() => m.enviar(atacar)}>
                    {t('mesa.acciones.atacar')} · {t('mesa.acciones.coste', { n: 2 })}
                  </Boton>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-center text-xs text-stone-500">
          {t('mesa.mazoMonstruos', { n: vista.cartasEnMazoMonstruos })}
        </p>
      </div>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <Carta cartaId={null} tamano="sm" />
          <span className="text-xs">
            {t('mesa.mazo')} ({vista.cartasEnMazo})
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          {superior === undefined ? (
            <div className="flex aspect-[5/7] w-16 items-center justify-center rounded-lg border-2 border-dashed border-stone-400 text-xs text-stone-500">
              {t('mesa.vacia')}
            </div>
          ) : (
            <Carta
              cartaId={m.idDe(superior)}
              tamano="sm"
              onClick={() => setVerDescarte(true)}
              onZoom={m.ampliar}
            />
          )}
          <span className="text-xs">
            {t('mesa.descarte')} ({vista.descarte.length})
          </span>
        </div>
      </div>
      <Modal
        abierto={verDescarte}
        titulo={t('mesa.pilaDescarte', { n: vista.descarte.length })}
        onCerrar={() => setVerDescarte(false)}
        ancho="xl"
      >
        <div className="flex flex-wrap gap-2">
          {[...vista.descarte].reverse().map((uid) => (
            <Carta key={uid} cartaId={m.idDe(uid)} tamano="md" onZoom={m.ampliar} />
          ))}
        </div>
        <div className="mt-4 text-right">
          <Boton onClick={() => setVerDescarte(false)}>{t('comun.cerrar')}</Boton>
        </div>
      </Modal>
    </section>
  );
}
