import type { Accion, Tirada } from '@hts/engine';
import { useCarta, useAhora } from '../../estado/contexto';
import { conSigno, t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { Carta } from '../../ui/Carta';
import { useMesa } from './contexto';

function CuentaAtras() {
  const { director } = useMesa();
  useAhora(true);
  const restante = director.restanteMs();
  const total = director.plazo?.duracionMs ?? 1;
  if (restante === null) {
    return <div className="text-sm font-semibold text-amber-600">{t('ventana.pausa')}</div>;
  }
  return (
    <div className="flex items-center gap-2" aria-live="off">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
        <div
          className="h-full bg-amber-500 transition-[width] duration-100"
          style={{ width: `${(100 * restante) / total}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm tabular-nums">
        {t('ventana.segundos', { s: Math.ceil(restante / 1000) })}
      </span>
    </div>
  );
}

/** Botones "Responde X" (modo este dispositivo) y "He terminado". */
function Respondedores() {
  const m = useMesa();
  const { director } = m;
  if (director.config.modo !== 'local') return null;
  if (director.respondiendo !== null) {
    return director.respondiendo === m.yo ? (
      <Boton onClick={() => director.terminarRespuesta()}>{t('ventana.terminarRespuesta')}</Boton>
    ) : null;
  }
  const otros = director.respondedoresPosibles().filter((id) => id !== m.yo);
  if (otros.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">{t('ventana.responderAqui')}</span>
      {otros.map((id) => (
        <Boton key={id} pequeno onClick={() => director.responder(id)}>
          {t('ventana.responde', { nombre: m.nombreJugador(id) })}
        </Boton>
      ))}
    </div>
  );
}

function VentanaDesafio() {
  const m = useMesa();
  const cima = m.vista.pila[m.vista.pila.length - 1];
  const carta = useCarta(cima?.tipo === 'ventanaDesafio' ? m.idDe(cima.jugada.uid) : null);
  if (cima?.tipo !== 'ventanaDesafio') return null;
  const desafios = m.legales.filter(
    (a): a is Extract<Accion, { tipo: 'DESAFIAR' }> => a.tipo === 'DESAFIAR',
  );
  const puedePasar = m.legales.some((a) => a.tipo === 'PASAR');
  const terminar = (): void => {
    if (m.director.respondiendo === m.yo) m.director.terminarRespuesta();
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Carta cartaId={carta?.id ?? null} tamano="sm" onZoom={m.ampliar} />
        <div>
          <div className="font-semibold">
            {t('ventana.desafioTitulo', {
              nombre: m.nombreJugador(cima.jugada.jugador),
              carta: carta?.nombre ?? '',
            })}
          </div>
          <div className="text-sm text-stone-600 dark:text-stone-400">
            {t('ventana.desafioPregunta')}
          </div>
        </div>
      </div>
      <CuentaAtras />
      <div className="flex flex-wrap gap-2">
        {desafios[0] !== undefined && (
          <Boton
            variante="peligro"
            onClick={() => {
              if (desafios[0] !== undefined) m.enviar(desafios[0]);
              terminar();
            }}
          >
            {t('ventana.desafiar')}
          </Boton>
        )}
        {puedePasar && (
          <Boton
            onClick={() => {
              m.enviar({ tipo: 'PASAR' });
              terminar();
            }}
          >
            {t('ventana.pasar')}
          </Boton>
        )}
        {cima.pasaron.includes(m.yo) && <span className="text-sm">{t('ventana.yaPasaste')}</span>}
      </div>
      <Respondedores />
    </>
  );
}

function FilaTirada({ tirada, indice }: { tirada: Tirada; indice: number }) {
  const m = useMesa();
  const base = tirada.dados[0] + tirada.dados[1];
  const total = base + tirada.modificaciones.reduce((s, x) => s + x.valor, 0);
  const mods = m.legales.filter(
    (a): a is Extract<Accion, { tipo: 'JUGAR_MODIFICADOR' }> =>
      a.tipo === 'JUGAR_MODIFICADOR' && a.tirada === indice,
  );
  return (
    <div className="rounded-lg bg-stone-50 p-2 dark:bg-stone-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{m.nombreJugador(tirada.jugador)}</span>
        <span className="rounded bg-white px-1.5 font-mono dark:bg-stone-700">
          ⚀ {tirada.dados[0]}
        </span>
        <span className="rounded bg-white px-1.5 font-mono dark:bg-stone-700">
          ⚀ {tirada.dados[1]}
        </span>
        {tirada.modificaciones.map((x, i) => (
          <span
            key={i}
            className="rounded bg-emerald-100 px-1.5 text-sm dark:bg-emerald-900"
            title={m.nombreCarta(x.carta)}
          >
            {conSigno(x.valor)} ({m.nombreJugador(x.jugador)})
          </span>
        ))}
        <span className="ml-auto font-bold">
          {t('ventana.total')}: {total}
        </span>
      </div>
      {mods.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {mods.map((a) => (
            <Boton
              key={`${a.uid}:${a.valor}`}
              pequeno
              onClick={() => m.enviar(a)}
              title={m.nombreCarta(m.idDe(a.uid) ?? '')}
            >
              {t('ventana.jugarModificador', {
                valor: conSigno(a.valor),
                nombre: m.nombreJugador(tirada.jugador),
              })}
            </Boton>
          ))}
        </div>
      )}
    </div>
  );
}

function VentanaModificadores() {
  const m = useMesa();
  const cima = m.vista.pila[m.vista.pila.length - 1];
  const idHeroe =
    cima?.tipo === 'ventanaModificadores' && cima.contexto.tipo === 'heroe'
      ? m.idDe(cima.contexto.heroe)
      : null;
  const heroe = useCarta(idHeroe);
  if (cima?.tipo !== 'ventanaModificadores') return null;
  const ctx = cima.contexto;
  const roller = cima.tiradas[0]?.jugador ?? '';
  const titulo =
    ctx.tipo === 'heroe'
      ? t('ventana.contexto.heroe', {
          nombre: m.nombreJugador(roller),
          carta: heroe?.nombre ?? '',
          n: heroe?.tipo === 'heroe' ? heroe.tirada : '?',
        })
      : ctx.tipo === 'ataque'
        ? t('ventana.contexto.ataque', {
            nombre: m.nombreJugador(roller),
            carta: m.nombreCarta(m.idDe(ctx.monstruo) ?? ''),
          })
        : t('ventana.contexto.desafio', {
            desafiante: m.nombreJugador(ctx.desafiante),
            desafiado: m.nombreJugador(ctx.jugada.jugador),
          });
  const tengoModificadores = m.legales.some((a) => a.tipo === 'JUGAR_MODIFICADOR');
  return (
    <>
      <div className="font-semibold">{titulo}</div>
      {cima.tiradas.map((tir, i) => (
        <FilaTirada key={i} tirada={tir} indice={i} />
      ))}
      <CuentaAtras />
      {!tengoModificadores && m.director.respondiendo === m.yo && (
        <p className="text-sm text-stone-500">{t('ventana.sinTusModificadores')}</p>
      )}
      <p className="text-xs text-stone-500">{t('ventana.bonos')}</p>
      <Respondedores />
    </>
  );
}

/** Panel de la ventana de respuesta abierta (desafío o Modificadores). */
export function VentanaRespuesta() {
  const m = useMesa();
  const cima = m.vista.pila[m.vista.pila.length - 1];
  if (cima?.tipo !== 'ventanaDesafio' && cima?.tipo !== 'ventanaModificadores') return null;
  return (
    <section
      aria-live="polite"
      className="fixed inset-x-2 bottom-2 z-30 mx-auto max-w-2xl space-y-3 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-stone-300 lg:inset-x-auto lg:bottom-auto lg:right-2 lg:top-14 lg:mx-0 lg:max-h-[calc(100vh-4.5rem)] lg:w-[19rem] lg:overflow-y-auto dark:bg-stone-900 dark:ring-stone-600"
    >
      {cima.tipo === 'ventanaDesafio' ? <VentanaDesafio /> : <VentanaModificadores />}
    </section>
  );
}
