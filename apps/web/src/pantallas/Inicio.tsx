import { useRef, useState } from 'react';
import { useApp } from '../estado/app';
import { useCatalogo } from '../estado/contexto';
import { leerAuto, restaurarGuardado } from '../juego/guardado';
import { t } from '../i18n';
import { Boton } from '../ui/Boton';
import { SelectorTema } from '../ui/SelectorTema';

function Opcion({
  titulo,
  descripcion,
  onClick,
  desactivada = false,
}: {
  titulo: string;
  descripcion: string;
  onClick?: () => void;
  desactivada?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivada}
      className="w-full rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-900 dark:ring-stone-700"
    >
      <div className="font-titulo text-lg font-semibold">{titulo}</div>
      <div className="text-sm text-stone-600 dark:text-stone-400">{descripcion}</div>
    </button>
  );
}

export function Inicio({ onNueva }: { onNueva: (modo: 'local' | 'bots') => void }) {
  const { motor } = useCatalogo();
  const { irA, empezar, mostrarTutorial } = useApp();
  const archivo = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const guardada = leerAuto();

  const cargarTexto = (texto: string): void => {
    try {
      empezar(restaurarGuardado(motor, texto));
    } catch (e) {
      setError(t('inicio.errorCarga', { motivo: e instanceof Error ? e.message : String(e) }));
    }
  };

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="font-titulo text-5xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
          {t('app.titulo')}
        </h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">{t('app.subtitulo')}</p>
      </header>

      <div className="space-y-3">
        {guardada !== null && (
          <Opcion
            titulo={t('inicio.continuar')}
            descripcion={t('inicio.continuarDesc')}
            onClick={() => cargarTexto(guardada)}
          />
        )}
        <Opcion
          titulo={t('inicio.jugarLocal')}
          descripcion={t('inicio.jugarLocalDesc')}
          onClick={() => onNueva('local')}
        />
        <Opcion
          titulo={t('inicio.jugarBots')}
          descripcion={t('inicio.jugarBotsDesc')}
          onClick={() => onNueva('bots')}
        />
        <Opcion titulo={t('inicio.enLinea')} descripcion={t('inicio.enLineaDesc')} desactivada />
      </div>

      {error !== null && (
        <p
          role="alert"
          className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Boton onClick={() => archivo.current?.click()}>{t('inicio.cargar')}</Boton>
        <Boton onClick={() => irA('reglas')}>{t('inicio.reglas')}</Boton>
        <Boton onClick={() => mostrarTutorial(true)}>{t('inicio.tutorial')}</Boton>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label={t('inicio.cargar')}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f !== undefined) cargarTexto(await f.text());
            e.target.value = '';
          }}
        />
      </div>
      <div className="flex justify-center">
        <SelectorTema />
      </div>
    </main>
  );
}
