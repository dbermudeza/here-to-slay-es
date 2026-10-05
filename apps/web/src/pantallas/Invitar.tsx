import { useState } from 'react';
import type { ClienteEnLinea } from '../enlinea/cliente';
import { t } from '../i18n';
import { Boton } from '../ui/Boton';
import { Seccion } from './Configurar';

/** Enlace que abre directamente "Unirse" con el código de la sala ya escrito. */
export const enlaceInvitacion = (origen: string, codigo: string): string =>
  `${origen.replace(/\/$/, '')}/?sala=${codigo}`;

function Enlace({ titulo, url }: { titulo: string; url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold">{titulo}</div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-stone-100 px-2 py-1.5 text-sm dark:bg-stone-800">
          {url}
        </code>
        <Boton
          pequeno
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => setCopiado(true));
          }}
        >
          {copiado ? t('enLinea.sala.copiado') : t('enLinea.sala.copiar')}
        </Boton>
      </div>
    </div>
  );
}

/**
 * Cómo invitar a la sala. En el equipo del servidor: enlaces de la red local y el túnel de
 * Cloudflare para jugar por internet. En los demás: el enlace por el que han entrado.
 */
export function Invitar({ cliente, codigo }: { cliente: ClienteEnLinea; codigo: string }) {
  const { info, tunel } = cliente;
  if (info === null) return null;

  const enlaceTunel =
    tunel.fase === 'activo' && tunel.url !== null ? enlaceInvitacion(tunel.url, codigo) : null;

  if (!info.esEquipoServidor) {
    return (
      <Seccion titulo={t('enLinea.invitar.titulo')}>
        <Enlace
          titulo={t('enLinea.invitar.enlace')}
          url={enlaceTunel ?? enlaceInvitacion(window.location.origin, codigo)}
        />
      </Seccion>
    );
  }

  return (
    <Seccion titulo={t('enLinea.invitar.titulo')}>
      <div className="space-y-4">
        {info.redLocal.map((origen) => (
          <Enlace
            key={origen}
            titulo={t('enLinea.invitar.redLocal')}
            url={enlaceInvitacion(origen, codigo)}
          />
        ))}

        <div className="space-y-2 rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200 dark:bg-stone-800/50 dark:ring-stone-700">
          <div className="font-semibold">{t('enLinea.invitar.internet')}</div>
          {tunel.fase === 'apagado' && (
            <>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {t('enLinea.invitar.internetDesc')}
              </p>
              <Boton variante="primario" onClick={() => void cliente.abrirTunel()}>
                {t('enLinea.invitar.abrir')}
              </Boton>
            </>
          )}
          {tunel.fase === 'conectando' && (
            <p role="status" className="text-sm">
              {t('enLinea.invitar.conectando')}
            </p>
          )}
          {enlaceTunel !== null && (
            <>
              <Enlace titulo={t('enLinea.invitar.enlaceInternet')} url={enlaceTunel} />
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {t('enLinea.invitar.aviso')}
              </p>
              <Boton pequeno variante="fantasma" onClick={() => void cliente.cerrarTunel()}>
                {t('enLinea.invitar.cerrar')}
              </Boton>
            </>
          )}
          {tunel.fase === 'error' && (
            <>
              <p
                role="alert"
                className="rounded-lg bg-red-100 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
              >
                {t(`enLinea.invitar.errores.${tunel.error ?? 'FALLO'}`)}
              </p>
              {tunel.error === 'NO_INSTALADO' && (
                <code className="block rounded-lg bg-stone-100 px-2 py-1.5 text-sm dark:bg-stone-800">
                  winget install --id Cloudflare.cloudflared
                </code>
              )}
              <Boton onClick={() => void cliente.abrirTunel()}>
                {t('enLinea.invitar.reintentar')}
              </Boton>
            </>
          )}
        </div>
      </div>
    </Seccion>
  );
}
