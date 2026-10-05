import { useState } from 'react';
import { lista, t } from '../i18n';
import { Boton } from '../ui/Boton';
import { Modal } from '../ui/Modal';

interface Paso {
  titulo: string;
  texto: string;
}

export function Tutorial({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const pasos = lista<Paso>('tutorial.pasos');
  const [i, setI] = useState(0);
  const paso = pasos[i];
  const cerrar = (): void => {
    setI(0);
    onCerrar();
  };
  return (
    <Modal abierto={abierto} titulo={t('tutorial.titulo')} onCerrar={cerrar}>
      {paso !== undefined && (
        <div>
          <div className="mb-1 text-sm text-stone-600 dark:text-stone-400">
            {i + 1} / {pasos.length}
          </div>
          <h3 className="font-titulo text-lg font-semibold">{paso.titulo}</h3>
          <p className="mt-2 leading-relaxed">{paso.texto}</p>
        </div>
      )}
      <div className="mt-6 flex justify-between">
        <Boton
          variante="fantasma"
          onClick={() => setI(i - 1)}
          motivo={i === 0 ? '' : null}
          disabled={i === 0}
        >
          {t('comun.anterior')}
        </Boton>
        {i < pasos.length - 1 ? (
          <Boton variante="primario" onClick={() => setI(i + 1)}>
            {t('comun.siguiente')}
          </Boton>
        ) : (
          <Boton variante="primario" onClick={cerrar}>
            {t('comun.cerrar')}
          </Boton>
        )}
      </div>
    </Modal>
  );
}
