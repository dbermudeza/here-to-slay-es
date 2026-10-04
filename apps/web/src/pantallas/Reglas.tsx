import { lista, t } from '../i18n';
import { Boton } from '../ui/Boton';

interface SeccionReglas {
  titulo: string;
  parrafos: string[];
}

/** Resumen de reglas en español (contenido en es.json, a partir de docs/REGLAS.md). */
export function ContenidoReglas() {
  return (
    <div className="space-y-5">
      {lista<SeccionReglas>('reglas.secciones').map((s) => (
        <section key={s.titulo}>
          <h2 className="font-titulo text-xl font-semibold text-amber-700 dark:text-amber-400">
            {s.titulo}
          </h2>
          {s.parrafos.map((p) => (
            <p key={p} className="mt-2 leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

export function Reglas({ onVolver }: { onVolver: () => void }) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="font-titulo text-3xl font-bold">{t('reglas.titulo')}</h1>
      <ContenidoReglas />
      <Boton onClick={onVolver}>{t('comun.volver')}</Boton>
    </main>
  );
}
