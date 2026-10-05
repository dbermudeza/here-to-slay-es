import type { Carta as DatosCarta, Clase, RangoTirada } from '@hts/cards';
import { useState } from 'react';
import { useCarta } from '../estado/contexto';
import { t } from '../i18n';

export type Tamano = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const ANCHO: Record<Tamano, string> = {
  xs: 'w-10',
  sm: 'w-16',
  md: 'w-24',
  lg: 'w-40',
  xl: 'w-64',
};

const COLOR_CLASE: Record<Clase | 'heroe', string> = {
  luchador: 'var(--color-luchador)',
  bardo: 'var(--color-bardo)',
  guardian: 'var(--color-guardian)',
  cazador: 'var(--color-cazador)',
  ladron: 'var(--color-ladron)',
  mago: 'var(--color-mago)',
  heroe: 'var(--color-cualquiera)',
};

function colorDe(c: DatosCarta): string {
  switch (c.tipo) {
    case 'heroe':
    case 'lider':
      return COLOR_CLASE[c.clase];
    case 'objeto':
      return '#0e7490';
    case 'objeto_maldito':
      return '#9d174d';
    case 'magia':
      return '#4338ca';
    case 'modificador':
      return '#047857';
    case 'desafio':
      return '#a16207';
    case 'monstruo':
      return '#1e293b';
  }
}

const rango = (r: RangoTirada): string => (r.tipo === 'min' ? `${r.valor}+` : `${r.valor}−`);

const esGrande = (c: DatosCarta | undefined): boolean =>
  c?.tipo === 'monstruo' || c?.tipo === 'lider';

interface Props {
  /** Id de catálogo; null = carta boca abajo. */
  cartaId: string | null;
  /** Uid de la carta en la partida (atributo data-uid, para las pruebas). */
  uid?: string | undefined;
  /** Posición en una selección a ciegas (atributo data-indice). */
  indice?: number | undefined;
  tamano?: Tamano;
  seleccionada?: boolean;
  resaltada?: boolean;
  atenuada?: boolean;
  /** Número de orden (selecciones ordenadas). */
  orden?: number | undefined;
  onClick?: (() => void) | undefined;
  onZoom?: ((cartaId: string) => void) | undefined;
  onDoubleClick?: (() => void) | undefined;
  /** Texto de ayuda al pasar el ratón. */
  titulo?: string | undefined;
  className?: string;
}

/** Una carta: imagen local si existe; si no, una carta genérica con su texto (juego 100 % jugable sin imágenes). */
export function Carta({
  cartaId,
  uid,
  indice,
  tamano = 'md',
  seleccionada = false,
  resaltada = false,
  atenuada = false,
  orden,
  onClick,
  onZoom,
  onDoubleClick,
  titulo,
  className = '',
}: Props) {
  const carta = useCarta(cartaId);
  const [sinImagen, setSinImagen] = useState(false);
  const proporcion = esGrande(carta) ? 'aspect-[300/518]' : 'aspect-[5/7]';
  const anillo = seleccionada
    ? 'ring-4 ring-amber-400'
    : resaltada
      ? 'ring-4 ring-emerald-400 animate-pulse'
      : 'ring-1 ring-black/10 dark:ring-white/10';
  const nombre = carta?.nombre ?? t('carta.reverso');
  const Contenedor = onClick ? 'button' : 'div';

  return (
    <Contenedor
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={titulo}
      onMouseEnter={carta && onZoom ? () => onZoom(carta.id) : undefined}
      aria-label={nombre}
      data-uid={uid}
      data-indice={indice}
      aria-pressed={onClick ? seleccionada : undefined}
      className={`relative shrink-0 overflow-hidden rounded-lg text-left shadow-md transition ${ANCHO[tamano]} ${proporcion} ${anillo} ${
        atenuada ? 'opacity-50' : ''
      } ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : ''} ${className}`}
    >
      {carta === undefined ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-900 to-stone-900 p-1 text-center font-titulo text-[10px] font-bold text-amber-200">
          {tamano === 'xs' ? 'HtS' : t('carta.reverso')}
        </div>
      ) : carta.imagen !== undefined && !sinImagen ? (
        <img
          src={`/cartas/${carta.imagen}`}
          alt={nombre}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setSinImagen(true)}
        />
      ) : (
        <CartaGenerica carta={carta} tamano={tamano} />
      )}
      {orden !== undefined && (
        <span className="absolute right-1 top-1 rounded-full bg-amber-500 px-1.5 text-xs font-bold text-stone-950">
          {orden}
        </span>
      )}
    </Contenedor>
  );
}

function CartaGenerica({ carta, tamano }: { carta: DatosCarta; tamano: Tamano }) {
  const color = colorDe(carta);
  const conTexto = tamano === 'md' || tamano === 'lg' || tamano === 'xl';
  const letra = tamano === 'xl' ? 'text-sm' : tamano === 'lg' ? 'text-[11px]' : 'text-[8px]';
  const subtitulo =
    carta.tipo === 'heroe' || carta.tipo === 'lider'
      ? `${t(`tipos.${carta.tipo}`)} · ${t(`clases.${carta.clase}`)}`
      : t(`tipos.${carta.tipo}`);
  return (
    <div
      className={`flex h-full w-full flex-col border-[3px] bg-stone-50 p-1 text-stone-900 dark:bg-stone-800 dark:text-stone-100 ${letra}`}
      style={{ borderColor: color }}
    >
      <div
        className="rounded px-1 py-0.5 text-center font-titulo font-bold leading-tight text-white"
        style={{ background: color }}
      >
        {tamano === 'xs' ? carta.nombre.slice(0, 6) : carta.nombre}
      </div>
      {tamano !== 'xs' && <div className="mt-0.5 text-center opacity-75">{subtitulo}</div>}
      {conTexto && carta.tipo === 'monstruo' && (
        <div className="mt-1 space-y-0.5">
          <div>
            {t('carta.requisitos')}: {carta.requisitos.map((r) => t(`clases.${r}`)).join(' + ')}
          </div>
          <div className="text-red-700 dark:text-red-400">
            {rango(carta.fracaso.rango)} {carta.fracaso.texto}
          </div>
          <div className="text-emerald-700 dark:text-emerald-400">
            {rango(carta.exito.rango)} {carta.exito.texto}
          </div>
        </div>
      )}
      {conTexto && carta.texto !== undefined && (
        <div className="mt-1 flex-1 overflow-hidden leading-snug">{carta.texto}</div>
      )}
      {carta.tipo === 'modificador' && (
        <div className="mt-auto text-center font-titulo text-lg font-bold">
          {carta.opciones.map((o) => (o > 0 ? `+${o}` : `−${Math.abs(o)}`)).join(' / ')}
        </div>
      )}
      {carta.tipo === 'heroe' && (
        <div className="mt-auto self-start rounded bg-emerald-700 px-1 font-bold text-white">
          {carta.tirada}+
        </div>
      )}
    </div>
  );
}
