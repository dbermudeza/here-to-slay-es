import type { Sesion } from '@hts/anfitrion';
import { useRef, useState } from 'react';
import { useApp } from '../estado/app';
import { useCatalogo } from '../estado/contexto';
import { leerSesion } from '../enlinea/sesion';
import { leerAuto } from '../juego/autoguardado';
import { OPCIONES_DIRECTOR } from '../juego/opciones';
import { t } from '../i18n';
import { Boton } from '../ui/Boton';
import { Ajustes } from '../ui/Ajustes';
import { Logo } from '../ui/Logo';

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
  const { irA, empezar, mostrarTutorial, abrirEnLinea } = useApp();
  const sesion = leerSesion();
  const archivo = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const guardada = leerAuto();

  // La partida y el cliente en línea se cargan al usarlos (no hacen falta en la portada).
  const cargarTexto = async (texto: string): Promise<void> => {
    try {
      const { restaurarGuardado } = await import('../juego/guardado');
      empezar(restaurarGuardado(motor, texto, undefined, OPCIONES_DIRECTOR));
    } catch (e) {
      setError(t('inicio.errorCarga', { motivo: e instanceof Error ? e.message : String(e) }));
    }
  };

  const abrirCliente = async (s: Sesion | null, pantalla: 'sala' | 'enLinea'): Promise<void> => {
    const { ClienteEnLinea } = await import('../enlinea/cliente');
    abrirEnLinea(new ClienteEnLinea(undefined, s), pantalla);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="flex justify-center font-titulo text-5xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
          <Logo prioritario className="h-40 w-40 p-3 sm:h-48 sm:w-48" />
        </h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">{t('app.subtitulo')}</p>
      </header>

      <div className="space-y-3">
        {guardada !== null && (
          <Opcion
            titulo={t('inicio.continuar')}
            descripcion={t('inicio.continuarDesc')}
            onClick={() => void cargarTexto(guardada)}
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
        {sesion !== null && (
          <Opcion
            titulo={t('inicio.volverASala', { codigo: sesion.codigo })}
            descripcion={t('inicio.volverASalaDesc')}
            onClick={() => void abrirCliente(sesion, 'sala')}
          />
        )}
        <Opcion
          titulo={t('inicio.enLinea')}
          descripcion={t('inicio.enLineaDesc')}
          onClick={() => void abrirCliente(null, 'enLinea')}
        />
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
            if (f !== undefined) await cargarTexto(await f.text());
            e.target.value = '';
          }}
        />
      </div>
      <div className="flex justify-center">
        <Ajustes />
      </div>
    </main>
  );
}
