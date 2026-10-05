import { DEFINICIONES_EFECTOS } from '@hts/cards';
import type { Accion } from '@hts/engine';
import { t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { clave, useMesa } from './contexto';

/** Acciones generales del turno: robar, renovar mano, habilidad del Líder/Monstruos y terminar. */
export function AccionesTurno() {
  const m = useMesa();
  const yo = m.vista.jugadores.find((j) => j.id === m.yo);
  if (yo === undefined || !m.esMiTurnoLibre) return null;

  const conHabilidad = [yo.lider, ...yo.monstruos].filter((uid) => {
    const id = m.idDe(uid);
    return (
      id !== null && (DEFINICIONES_EFECTOS[id]?.pasivas ?? []).some((p) => p.tipo === 'habilidad')
    );
  });

  const boton = (accion: Accion, texto: string, coste: number | null, primario = false) => (
    <Boton
      key={texto}
      variante={primario ? 'primario' : 'secundario'}
      motivo={m.motivo(accion)}
      data-accion={clave(accion)}
      onClick={() => m.enviar(accion)}
    >
      {texto}
      {coste !== null && (
        <span className="opacity-75">· {t('mesa.acciones.coste', { n: coste })}</span>
      )}
    </Boton>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {boton({ tipo: 'ROBAR' }, t('mesa.acciones.robar'), 1)}
      {boton({ tipo: 'RENOVAR_MANO' }, t('mesa.acciones.renovar'), 3)}
      {conHabilidad.map((uid) =>
        boton(
          { tipo: 'USAR_HABILIDAD', uid },
          t('mesa.acciones.habilidad', { carta: m.nombreCarta(m.idDe(uid) ?? '') }),
          1,
        ),
      )}
      {boton({ tipo: 'FIN_TURNO' }, t('mesa.acciones.terminar'), null, true)}
    </div>
  );
}
