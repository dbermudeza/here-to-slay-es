import { IMAGEN_LOGO } from '@hts/cards';
import { t } from '../i18n';
import { useImagen } from './useImagen';

/**
 * Logo del juego (/cartas/logo.png). El nombre accesible es siempre "Here to Slay"; sin la imagen
 * (instalación sin recursos) se muestra el texto como reserva.
 */
export function Logo({
  className = '',
  textoClassName = '',
  prioritario = false,
}: {
  /** Clases de la imagen (tamaño). */
  className?: string;
  /** Clases del texto de reserva. */
  textoClassName?: string;
  /** Carga inmediata (portada) en lugar de diferida. */
  prioritario?: boolean;
}) {
  const img = useImagen(IMAGEN_LOGO);
  if (!img.mostrar) return <span className={textoClassName}>{t('app.titulo')}</span>;
  return (
    <img
      key={img.clave}
      src={img.src}
      alt={t('app.titulo')}
      loading={prioritario ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`rounded-xl bg-stone-900 object-contain ${className}`}
      onError={img.onError}
      onLoad={img.onLoad}
    />
  );
}
