import type { Accion, PendienteVista } from '@hts/engine';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useReducirAnimaciones } from '../../../estado/app';
import { useCarta } from '../../../estado/contexto';
import { conSigno, t } from '../../../i18n';
import { Boton } from '../../../ui/Boton';
import { Carta } from '../../../ui/Carta';
import { rango } from '../../../ui/rango';
import { clave, useMesa, type ValorMesa } from '../contexto';
import { desplazamiento } from '../zonas';
import {
  AnilloCuenta,
  FichaTirada,
  Respondedores,
  Titular,
  type ModificacionVista,
} from './Piezas';

type VentanaDesafioVista = Extract<PendienteVista, { tipo: 'ventanaDesafio' }>;
type VentanaModsVista = Extract<PendienteVista, { tipo: 'ventanaModificadores' }>;
type TiradaVista = VentanaModsVista['tiradas'][number];

/** Tamaño de la carta protagonista: grande, pero sin desbordar pantallas bajas. */
export const CARTA_GRANDE = 'w-[min(15rem,46vw,34vh)]! shadow-2xl';

const BOTON_GRANDE =
  'min-h-12 w-full px-8 py-3 text-lg font-semibold shadow-xl sm:w-auto sm:min-w-44';

/** Convierte las modificaciones de una tirada a lo que muestra la ficha. */
export function modificacionesVista(m: ValorMesa, tirada: TiradaVista): ModificacionVista[] {
  return tirada.modificaciones.map((x) => ({
    valor: x.valor,
    jugador: m.nombreJugador(x.jugador),
    carta: m.nombreCarta(x.carta),
  }));
}

export const totalDe = (tirada: TiradaVista): number =>
  tirada.dados[0] + tirada.dados[1] + tirada.modificaciones.reduce((s, x) => s + x.valor, 0);

/** La carta vuela desde la mano o el Grupo de quien la juega hasta el centro. */
export function CartaQueVuela({
  cartaId,
  uid,
  jugador,
}: {
  cartaId: string | null;
  uid: string;
  jugador: string;
}) {
  const m = useMesa();
  const reducir = useReducirAnimaciones();
  // La posición de origen se mide una sola vez, al aparecer la carta.
  const [desde] = useState(() => desplazamiento(`mano:${jugador}`));
  return (
    <motion.div
      initial={reducir ? false : { x: desde.x, y: desde.y, scale: 0.25, opacity: 0, rotate: -10 }}
      animate={reducir ? { opacity: 1 } : { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
      transition={reducir ? { duration: 0.12 } : { type: 'spring', stiffness: 90, damping: 15 }}
    >
      <Carta
        cartaId={cartaId}
        tamano="xl"
        className={`${CARTA_GRANDE} ring-4! ring-amber-400/80!`}
        onZoom={m.ampliar}
        onClick={() => m.detalleDe(uid)}
      />
    </motion.div>
  );
}

/** Ventana de desafío: «X intenta jugar Y», con Desafiar y Dejar pasar. */
export function Intento({ cima }: { cima: VentanaDesafioVista }) {
  const m = useMesa();
  const carta = useCarta(m.idDe(cima.jugada.uid));
  const desafios = m.legales.filter(
    (a): a is Extract<Accion, { tipo: 'DESAFIAR' }> => a.tipo === 'DESAFIAR',
  );
  const puedePasar = m.legales.some((a) => a.tipo === 'PASAR');
  const puedoResponder = desafios.length > 0 || puedePasar;
  const yaPase = cima.pasaron.includes(m.yo);
  const terminar = (): void => {
    if (m.director.respondiendo === m.yo) m.director.terminarRespuesta();
  };

  // Quien puede responder tiene el foco en el botón principal (salvo que esté usando otra cosa).
  const pasar = useRef<HTMLButtonElement>(null);
  const secuencia = cima.secuencia;
  useEffect(() => {
    if (!puedePasar) return;
    const activo = document.activeElement;
    if (activo === null || activo === document.body) pasar.current?.focus({ preventScroll: true });
  }, [puedePasar, secuencia]);

  const subtitulo = puedoResponder
    ? t('ventana.desafioPregunta')
    : yaPase
      ? `${t('ventana.yaPasaste')} ${t('ventana.esperandoDesafios')}`
      : t('ventana.esperandoDesafios');

  return (
    <div className="flex flex-col items-center gap-4">
      <Titular
        titulo={t('ventana.desafioTitulo', {
          nombre: m.nombreJugador(cima.jugada.jugador),
          carta: carta?.nombre ?? '',
        })}
        subtitulo={subtitulo}
      />
      <div className="relative">
        <CartaQueVuela
          cartaId={carta?.id ?? null}
          uid={cima.jugada.uid}
          jugador={cima.jugada.jugador}
        />
        <div className="absolute -right-3 -top-3 sm:-right-5 sm:-top-5">
          <AnilloCuenta />
        </div>
      </div>
      <div className="flex w-full max-w-md flex-col items-center gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        {desafios[0] !== undefined && (
          <Boton
            variante="peligro"
            className={BOTON_GRANDE}
            data-accion={clave(desafios[0])}
            onClick={() => {
              if (desafios[0] !== undefined) m.enviar(desafios[0]);
              terminar();
            }}
          >
            {t('ventana.desafiar')}
          </Boton>
        )}
        {puedePasar && (
          <button
            ref={pasar}
            type="button"
            data-accion={clave({ tipo: 'PASAR' })}
            className={`inline-flex items-center justify-center rounded-lg bg-amber-700 text-white transition-colors hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400 ${BOTON_GRANDE}`}
            onClick={() => {
              m.enviar({ tipo: 'PASAR' });
              terminar();
            }}
          >
            {t('ventana.pasar')}
          </button>
        )}
      </div>
      <Respondedores />
    </div>
  );
}

/** Botones para jugar un Modificador sobre la tirada `indice`. */
function BotonesModificador({ indice, nombre }: { indice: number; nombre: string }) {
  const m = useMesa();
  const mods = m.legales.filter(
    (a): a is Extract<Accion, { tipo: 'JUGAR_MODIFICADOR' }> =>
      a.tipo === 'JUGAR_MODIFICADOR' && a.tirada === indice,
  );
  if (mods.length === 0) return null;
  return (
    <div className="flex w-full flex-wrap justify-center gap-1.5">
      {mods.map((a) => (
        <Boton
          key={`${a.uid}:${a.valor}`}
          variante="primario"
          className="min-h-12 flex-1 flex-col gap-0 px-3 py-1 leading-tight"
          data-accion={clave(a)}
          onClick={() => m.enviar(a)}
          title={m.nombreCarta(m.idDe(a.uid) ?? '')}
          aria-label={t('ventana.jugarModificador', { valor: conSigno(a.valor), nombre })}
        >
          <span aria-hidden="true" className="text-lg font-bold">
            {conSigno(a.valor)}
          </span>
          <span aria-hidden="true" className="text-xs">
            {t('ventana.aJugador', { nombre })}
          </span>
        </Boton>
      ))}
    </div>
  );
}

/** Pie común de las ventanas de Modificadores: ayuda, cuenta atrás y botones de respuesta. */
function PieModificadores() {
  const m = useMesa();
  const tengo = m.legales.some((a) => a.tipo === 'JUGAR_MODIFICADOR');
  return (
    <div className="flex flex-col items-center gap-3">
      {!tengo && m.director.respondiendo === m.yo && (
        <p className="rounded-xl bg-white px-3 py-1.5 text-center text-sm text-stone-800 shadow-lg dark:bg-stone-900 dark:text-stone-200">
          {t('ventana.sinTusModificadores')}
        </p>
      )}
      <p className="max-w-md rounded-xl bg-white px-3 py-1.5 text-center text-xs text-stone-700 shadow-lg dark:bg-stone-900 dark:text-stone-300">
        {t('ventana.bonos')}
      </p>
      <Respondedores />
    </div>
  );
}

/** Tirada de un Héroe o de un ataque: dados grandes, tirada necesaria y Modificadores. */
export function EscenaTirada({ cima }: { cima: VentanaModsVista }) {
  const m = useMesa();
  const ctx = cima.contexto;
  const idCarta =
    ctx.tipo === 'heroe' ? m.idDe(ctx.heroe) : ctx.tipo === 'ataque' ? m.idDe(ctx.monstruo) : null;
  const carta = useCarta(idCarta);
  const tirada = cima.tiradas[0];
  const roller = tirada?.jugador ?? '';
  const titulo =
    ctx.tipo === 'heroe'
      ? t('ventana.contexto.heroe', {
          nombre: m.nombreJugador(roller),
          carta: carta?.nombre ?? '',
          n: carta?.tipo === 'heroe' ? carta.tirada : '?',
        })
      : t('ventana.contexto.ataque', {
          nombre: m.nombreJugador(roller),
          carta: m.nombreCarta(idCarta ?? ''),
          exito: carta?.tipo === 'monstruo' ? rango(carta.exito.rango) : '?',
          fracaso: carta?.tipo === 'monstruo' ? rango(carta.fracaso.rango) : '?',
        });
  return (
    <div className="flex flex-col items-center gap-4">
      <Titular titulo={titulo} />
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        {idCarta !== null && (
          <Carta
            cartaId={idCarta}
            tamano="lg"
            className="hidden w-[min(11rem,30vh)]! shadow-2xl sm:block"
            onZoom={m.ampliar}
          />
        )}
        <div className="relative">
          {cima.tiradas.map((tir, i) => (
            <FichaTirada
              key={i}
              nombre={m.nombreJugador(tir.jugador)}
              dados={tir.dados}
              modificaciones={modificacionesVista(m, tir)}
              total={totalDe(tir)}
            >
              <BotonesModificador indice={i} nombre={m.nombreJugador(tir.jugador)} />
            </FichaTirada>
          ))}
          <div className="absolute -right-3 -top-3 sm:-right-5 sm:-top-5">
            <AnilloCuenta />
          </div>
        </div>
      </div>
      <PieModificadores />
    </div>
  );
}

/** Carta de Desafío que cruza la carta desafiada (efecto de impacto). */
export function CartasCruzadas({
  jugada,
  desafio,
}: {
  jugada: string | null;
  desafio: string | null;
}) {
  const reducir = useReducirAnimaciones();
  return (
    <div className="relative hidden h-44 w-48 shrink-0 lg:block" aria-hidden="true">
      <Carta cartaId={jugada} tamano="md" className="absolute left-0 top-6 w-28! shadow-xl" />
      {desafio !== null && (
        <motion.div
          className="absolute left-16 top-0"
          initial={reducir ? false : { x: 90, y: -60, rotate: 40, scale: 1.8, opacity: 0 }}
          animate={reducir ? { opacity: 1 } : { x: 0, y: 0, rotate: 12, scale: 1, opacity: 1 }}
          transition={
            reducir ? { duration: 0.12 } : { type: 'spring', stiffness: 220, damping: 14 }
          }
        >
          <Carta cartaId={desafio} tamano="md" className="w-28! shadow-2xl ring-2! ring-red-600!" />
        </motion.div>
      )}
    </div>
  );
}

/** Duelo de dados entre quien desafía y quien jugó la carta. */
export function EscenaDuelo({
  cima,
  cartaDesafio,
}: {
  cima: VentanaModsVista;
  cartaDesafio: string | null;
}) {
  const m = useMesa();
  const ctx = cima.contexto;
  if (ctx.tipo !== 'desafio') return null;
  const desafiado = cima.tiradas[0];
  const desafiante = cima.tiradas[1];
  const reglas: [TiradaVista | undefined, string, number][] = [
    [desafiante, t('ventana.desafiante'), 1],
    [desafiado, t('ventana.desafiado'), 0],
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <Titular
        impacto
        titulo={t('ventana.desafiaTitulo', { nombre: m.nombreJugador(ctx.desafiante) })}
        subtitulo={t('ventana.contexto.desafio', {
          desafiante: m.nombreJugador(ctx.desafiante),
          desafiado: m.nombreJugador(ctx.jugada.jugador),
        })}
      />
      <div className="flex items-center gap-4 sm:gap-6">
        <CartasCruzadas jugada={m.idDe(ctx.jugada.uid)} desafio={cartaDesafio} />
        <div className="relative grid grid-cols-2 gap-2 sm:gap-6">
          {reglas.map(([tir, etiqueta, indice]) =>
            tir === undefined ? null : (
              <FichaTirada
                key={indice}
                etiqueta={etiqueta}
                nombre={m.nombreJugador(tir.jugador)}
                dados={tir.dados}
                modificaciones={modificacionesVista(m, tir)}
                total={totalDe(tir)}
              >
                <BotonesModificador indice={indice} nombre={m.nombreJugador(tir.jugador)} />
              </FichaTirada>
            ),
          )}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-700 px-2 py-1 font-titulo text-sm font-bold text-white shadow-xl sm:text-lg"
          >
            {t('ventana.versus')}
          </span>
          <div className="absolute -right-3 -top-4 sm:-right-5 sm:-top-5">
            <AnilloCuenta />
          </div>
        </div>
      </div>
      <PieModificadores />
    </div>
  );
}
