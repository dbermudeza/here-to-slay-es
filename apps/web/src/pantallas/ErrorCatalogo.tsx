import { t } from '../i18n';

export function ErrorCatalogo({
  motivo,
  detalle,
}: {
  motivo: 'falta' | 'invalido';
  detalle: string;
}) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="font-titulo text-3xl font-bold">{t(`catalogo.${motivo}Titulo`)}</h1>
      <p className="mt-4 leading-relaxed">{t(`catalogo.${motivo}Texto`)}</p>
      {motivo === 'invalido' && detalle !== '' && (
        <p className="mt-3 font-mono text-sm text-red-700 dark:text-red-400">
          {t('catalogo.detalle', { detalle })}
        </p>
      )}
    </main>
  );
}
