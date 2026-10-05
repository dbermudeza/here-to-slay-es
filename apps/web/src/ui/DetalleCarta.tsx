import type { Carta as DatosCarta, RangoTirada } from '@hts/cards';
import type { ReactNode } from 'react';
import { useCarta } from '../estado/contexto';
import { conSigno, t } from '../i18n';
import { Boton } from './Boton';
import { Carta } from './Carta';
import { Modal } from './Modal';

export interface Detalle {
  cartaId: string;
  /** Si es un Héroe en un Grupo, el Objeto que lleva equipado. */
  objetoId?: string | undefined;
  /** Si es un Objeto equipado, el Héroe que lo lleva. */
  heroeId?: string | undefined;
}

const rango = (r: RangoTirada): string => (r.tipo === 'min' ? `${r.valor}+` : `${r.valor}−`);

function Apartado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
        {titulo}
      </h3>
      <div className="mt-0.5 leading-relaxed">{children}</div>
    </div>
  );
}

function subtitulo(c: DatosCarta): string {
  return c.tipo === 'heroe' || c.tipo === 'lider'
    ? `${t(`tipos.${c.tipo}`)} · ${t(`clases.${c.clase}`)}`
    : t(`tipos.${c.tipo}`);
}

function Informacion({ carta, detalle }: { carta: DatosCarta; detalle: Detalle }) {
  const objeto = useCarta(detalle.objetoId);
  const heroe = useCarta(detalle.heroeId);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-stone-600 dark:text-stone-400">{subtitulo(carta)}</p>
        {carta.nombreOriginal !== carta.nombre && (
          <p className="text-xs text-stone-600 dark:text-stone-400">
            {t('detalle.nombreOriginal', { nombre: carta.nombreOriginal })}
          </p>
        )}
      </div>

      {carta.tipo === 'heroe' && (
        <Apartado titulo={t('detalle.tirada')}>
          <span className="rounded bg-emerald-700 px-2 py-0.5 font-bold text-white">
            {carta.tirada}+
          </span>
        </Apartado>
      )}

      {carta.tipo === 'monstruo' && (
        <>
          <Apartado titulo={t('detalle.requisitos')}>
            {carta.requisitos.map((r) => t(`clases.${r}`)).join(' + ')}
          </Apartado>
          <Apartado titulo={t('detalle.fracaso', { rango: rango(carta.fracaso.rango) })}>
            <span className="text-red-700 dark:text-red-400">{carta.fracaso.texto}</span>
          </Apartado>
          <Apartado titulo={t('detalle.exito', { rango: rango(carta.exito.rango) })}>
            <span className="text-emerald-700 dark:text-emerald-400">{carta.exito.texto}</span>
          </Apartado>
        </>
      )}

      {carta.tipo === 'modificador' && (
        <Apartado titulo={t('detalle.valores')}>
          <span className="font-titulo text-xl font-bold">
            {carta.opciones.map(conSigno).join(' / ')}
          </span>
        </Apartado>
      )}

      {carta.texto !== undefined && (
        <Apartado
          titulo={
            carta.tipo === 'monstruo'
              ? t('detalle.habilidadMonstruo')
              : carta.tipo === 'lider'
                ? t('detalle.habilidad')
                : t('detalle.efecto')
          }
        >
          {carta.texto}
        </Apartado>
      )}

      {(carta.tipo === 'objeto' || carta.tipo === 'objeto_maldito') &&
        carta.otorgaClase !== undefined && (
          <p className="text-sm">
            {t('detalle.claseOtorgada', { clase: t(`clases.${carta.otorgaClase}`) })}
          </p>
        )}
      {objeto !== undefined && (
        <p className="text-sm">{t('detalle.objetoEquipado', { objeto: objeto.nombre })}</p>
      )}
      {heroe !== undefined && (
        <p className="text-sm">{t('detalle.equipadoA', { heroe: heroe.nombre })}</p>
      )}
      {carta.tipo !== 'lider' && carta.tipo !== 'monstruo' && (
        <p className="text-xs text-stone-600 dark:text-stone-400">
          {t('detalle.copias', { n: carta.copias })}
        </p>
      )}
    </div>
  );
}

/** Ventana con la carta en grande y toda su información en español. */
export function DetalleCarta({
  detalle,
  onCerrar,
}: {
  detalle: Detalle | null;
  onCerrar: () => void;
}) {
  const carta = useCarta(detalle?.cartaId);
  return (
    <Modal
      abierto={detalle !== null && carta !== undefined}
      titulo={carta?.nombre ?? ''}
      onCerrar={onCerrar}
      ancho="lg"
    >
      {detalle !== null && carta !== undefined && (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <Carta cartaId={carta.id} tamano="xl" className="max-w-[60vw]" />
          <div className="min-w-0 flex-1 self-stretch">
            <Informacion carta={carta} detalle={detalle} />
          </div>
        </div>
      )}
      <div className="mt-5 text-right">
        <Boton onClick={onCerrar}>{t('detalle.cerrar')}</Boton>
      </div>
    </Modal>
  );
}
