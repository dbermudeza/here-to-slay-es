import { useState } from 'react';
import type { ClienteEnLinea } from '../enlinea/cliente';
import { useDirector } from '../estado/contexto';
import { t } from '../i18n';
import { Boton } from '../ui/Boton';
import { campo, Seccion } from './Configurar';

/** Crear una sala o unirse con un código. */
export function EnLinea({
  cliente,
  onDentro,
  onVolver,
}: {
  cliente: ClienteEnLinea;
  onDentro: () => void;
  onVolver: () => void;
}) {
  useDirector(cliente);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const intentar = async (accion: () => Promise<boolean>): Promise<void> => {
    setEnviando(true);
    const ok = await accion();
    setEnviando(false);
    if (ok) onDentro();
  };

  const sinNombre = nombre.trim() === '';
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <h1 className="font-titulo text-3xl font-bold">{t('enLinea.titulo')}</h1>

      {cliente.red !== 'conectado' && (
        <p
          role="status"
          className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {cliente.red === 'conectando' ? t('enLinea.conectando') : t('enLinea.sinServidor')}
        </p>
      )}

      <Seccion titulo={t('enLinea.tuNombre')}>
        <input
          aria-label={t('enLinea.tuNombre')}
          value={nombre}
          maxLength={20}
          onChange={(e) => setNombre(e.target.value)}
          className={campo}
        />
      </Seccion>

      <Seccion titulo={t('enLinea.crear')}>
        <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">{t('enLinea.crearDesc')}</p>
        <Boton
          variante="primario"
          disabled={sinNombre || enviando || cliente.red !== 'conectado'}
          onClick={() => void intentar(() => cliente.crear(nombre.trim()))}
        >
          {t('enLinea.crear')}
        </Boton>
      </Seccion>

      <Seccion titulo={t('enLinea.unirse')}>
        <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">{t('enLinea.unirseDesc')}</p>
        <div className="flex gap-2">
          <input
            aria-label={t('enLinea.codigo')}
            value={codigo}
            maxLength={5}
            placeholder="ABCDE"
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            className={`${campo} font-mono uppercase tracking-widest`}
          />
          <Boton
            disabled={
              sinNombre || codigo.trim().length !== 5 || enviando || cliente.red !== 'conectado'
            }
            onClick={() => void intentar(() => cliente.unirse(codigo, nombre.trim()))}
          >
            {t('enLinea.unirse')}
          </Boton>
        </div>
      </Seccion>

      {cliente.error !== null && (
        <p
          role="alert"
          className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {t(`enLinea.errores.${cliente.error}`)}
        </p>
      )}

      <Boton variante="fantasma" onClick={onVolver}>
        {t('comun.volver')}
      </Boton>
    </main>
  );
}
