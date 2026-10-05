import type { OpcionesSala } from '@hts/anfitrion';
import type { Modo } from '@hts/engine';
import { useState } from 'react';
import type { ClienteEnLinea } from '../enlinea/cliente';
import { useDirector } from '../estado/contexto';
import { t } from '../i18n';
import { Boton } from '../ui/Boton';
import { campo, Eleccion, Seccion } from './Configurar';
import { Mesa } from './mesa/Mesa';

const LIMITES = [null, 30, 60, 90, 120, 180] as const;

function Lobby({ cliente, onSalir }: { cliente: ClienteEnLinea; onSalir: () => void }) {
  const sala = cliente.sala;
  const [copiado, setCopiado] = useState(false);
  if (sala === null) return null;
  const yo = cliente.sesion?.jugador;
  const creador = cliente.soyCreador;
  const miAsiento = sala.asientos.find((a) => a.id === yo);
  const faltanListos = sala.asientos.some(
    (a) => a.control === 'humano' && a.id !== sala.creador && !a.listo,
  );
  const motivoEmpezar =
    sala.asientos.length < 2
      ? t('enLinea.errores.POCOS_JUGADORES')
      : faltanListos
        ? t('enLinea.errores.NO_ESTAN_LISTOS')
        : null;
  const nombreCreador = sala.asientos.find((a) => a.id === sala.creador)?.nombre ?? '';
  const cambiar = (parcial: Partial<OpcionesSala>): void =>
    void cliente.cambiarOpciones({ ...sala.opciones, ...parcial });

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="font-titulo text-3xl font-bold">
        {t('enLinea.sala.titulo', { codigo: sala.codigo })}
      </h1>

      <Seccion titulo={t('enLinea.sala.codigo')}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-4xl font-bold tracking-[0.3em] text-amber-700 dark:text-amber-400">
            {sala.codigo}
          </span>
          <Boton
            onClick={() => {
              void navigator.clipboard?.writeText(sala.codigo).then(() => setCopiado(true));
            }}
          >
            {copiado ? t('enLinea.sala.copiado') : t('enLinea.sala.copiar')}
          </Boton>
        </div>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          {t('enLinea.sala.compartir')}
        </p>
      </Seccion>

      <Seccion titulo={t('enLinea.sala.jugadores', { n: sala.asientos.length })}>
        <ul className="divide-y divide-stone-200 dark:divide-stone-700">
          {sala.asientos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-semibold">{a.nombre}</span>
              {a.id === yo && (
                <span className="text-sm text-stone-600 dark:text-stone-400">
                  {t('enLinea.sala.tu')}
                </span>
              )}
              {a.id === sala.creador && (
                <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  {t('enLinea.sala.creador')}
                </span>
              )}
              {a.control !== 'humano' && (
                <span className="rounded bg-stone-200 px-1.5 text-xs dark:bg-stone-700">
                  {t('mesa.bot', { nivel: t(`niveles.${a.control}`) })}
                </span>
              )}
              {!a.conectado && (
                <span className="text-xs text-red-600">{t('enLinea.sala.desconectado')}</span>
              )}
              <span className="ml-auto text-sm">
                {a.control !== 'humano' || a.id === sala.creador ? null : a.listo ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    ✓ {t('enLinea.sala.listo')}
                  </span>
                ) : (
                  <span className="text-stone-600 dark:text-stone-400">
                    {t('enLinea.sala.noListo')}
                  </span>
                )}
              </span>
              {creador && a.id !== yo && (
                <Boton pequeno variante="fantasma" onClick={() => void cliente.quitar(a.id)}>
                  {t('enLinea.sala.quitar')}
                </Boton>
              )}
            </li>
          ))}
        </ul>
        {creador && sala.asientos.length < 6 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm">{t('enLinea.sala.anadirBot')}:</span>
            <Boton pequeno onClick={() => void cliente.anadirBot('facil')}>
              {t('enLinea.sala.anadirFacil')}
            </Boton>
            <Boton pequeno onClick={() => void cliente.anadirBot('normal')}>
              {t('enLinea.sala.anadirNormal')}
            </Boton>
          </div>
        )}
      </Seccion>

      <Seccion titulo={t('enLinea.sala.opciones')}>
        {!creador && (
          <p className="mb-2 text-sm text-stone-600 dark:text-stone-400">
            {t('enLinea.sala.soloAnfitrion')}
          </p>
        )}
        <fieldset disabled={!creador} className="space-y-3">
          <Eleccion<Modo>
            nombre="reglas-sala"
            valor={sala.opciones.reglas}
            onCambio={(reglas) => cambiar({ reglas })}
            opciones={[
              {
                valor: 'normal',
                titulo: t('config.reglasNormal'),
                descripcion: t('config.reglasNormalDesc'),
              },
              {
                valor: 'dificil',
                titulo: t('config.reglasDificil'),
                descripcion: t('config.reglasDificilDesc'),
              },
            ]}
          />
          <label className="block text-sm">
            {t('enLinea.sala.limite')}
            <select
              value={sala.opciones.limiteDecisionS ?? ''}
              onChange={(e) =>
                cambiar({ limiteDecisionS: e.target.value === '' ? null : Number(e.target.value) })
              }
              className={`${campo} mt-1`}
            >
              {LIMITES.map((s) => (
                <option key={s ?? 'no'} value={s ?? ''}>
                  {s === null
                    ? t('enLinea.sala.sinLimite')
                    : t('enLinea.sala.limiteSegundos', { s })}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-stone-600 dark:text-stone-400">
            {t('enLinea.sala.limiteNota')}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['desafio', 'modificadores', 'modificadoresDesafio'] as const).map((k) => (
              <label key={k} className="block text-sm">
                {t(`config.seg${k[0]?.toUpperCase() ?? ''}${k.slice(1)}`)}
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={sala.opciones.segundos[k]}
                  onChange={(e) =>
                    cambiar({
                      segundos: {
                        ...sala.opciones.segundos,
                        [k]: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className={`${campo} mt-1`}
                />
              </label>
            ))}
          </div>
        </fieldset>
      </Seccion>

      {cliente.error !== null && (
        <p
          role="alert"
          className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {t(`enLinea.errores.${cliente.error}`)}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Boton variante="fantasma" onClick={onSalir}>
          {t('enLinea.sala.salir')}
        </Boton>
        {creador ? (
          <Boton variante="primario" motivo={motivoEmpezar} onClick={() => void cliente.empezar()}>
            {t('enLinea.sala.empezar')}
          </Boton>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-600 dark:text-stone-400">
              {t('enLinea.sala.esperandoAnfitrion', { nombre: nombreCreador })}
            </span>
            <Boton
              variante={miAsiento?.listo ? 'secundario' : 'primario'}
              onClick={() => void cliente.listo(!(miAsiento?.listo ?? false))}
            >
              {miAsiento?.listo ? t('enLinea.sala.noEstoyListo') : t('enLinea.sala.estoyListo')}
            </Boton>
          </div>
        )}
      </div>
    </main>
  );
}

/** Pantalla de una sala en línea: el lobby o, si ha empezado, la mesa. */
export function Sala({
  cliente,
  onSalir,
  onTutorial,
}: {
  cliente: ClienteEnLinea;
  onSalir: () => void;
  onTutorial: () => void;
}) {
  useDirector(cliente);
  const salir = (): void => {
    void cliente.salir().then(onSalir);
  };
  const aviso =
    cliente.red === 'desconectado' ? (
      <p
        role="status"
        className="fixed inset-x-0 top-0 z-50 bg-red-700 p-2 text-center text-sm text-white"
      >
        {t('enLinea.reconectando')}
      </p>
    ) : null;

  if (cliente.sala !== null && cliente.sala.fase !== 'lobby' && cliente.partida !== null) {
    return (
      <>
        {aviso}
        <Mesa
          director={cliente}
          onSalir={salir}
          onTutorial={onTutorial}
          onRevancha={() => void cliente.volverALaSala()}
          textoRevancha={
            cliente.soyCreador
              ? t('enLinea.sala.volverALaSala')
              : t('enLinea.sala.esperandoCreador')
          }
        />
      </>
    );
  }
  if (cliente.sala === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        {aviso}
        <p>
          {cliente.red === 'conectado' ? t('enLinea.errores.SIN_SALA') : t('enLinea.conectando')}
        </p>
        <Boton className="mt-4" onClick={onSalir}>
          {t('comun.volver')}
        </Boton>
      </main>
    );
  }
  return (
    <>
      {aviso}
      <Lobby cliente={cliente} onSalir={salir} />
    </>
  );
}
