import type { PendienteVista } from '@hts/engine';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducirAnimaciones } from '../../estado/app';
import { useCatalogo } from '../../estado/contexto';
import { CAPA } from '../../ui/capas';
import { useMesa } from './contexto';
import { duracionFinal, EscenaFinal, type Final } from './escenario/Finales';
import { EscenaDuelo, EscenaTirada, Intento } from './escenario/Ventanas';

type VentanaModsVista = Extract<PendienteVista, { tipo: 'ventanaModificadores' }>;

/** Resultados pendientes de enseñar como máximo (si se acumulan más, se descartan los más antiguos). */
const MAX_COLA = 3;

/** Lo guardado de la última ventana de tiradas vista (para pintar su resultado al cerrarse). */
export interface InstantaneaVentana {
  ventana: VentanaModsVista;
  /** Id de catálogo del Héroe o Monstruo de la tirada (null en un desafío). */
  carta: string | null;
}

/**
 * La ventana guardada solo sirve si es la de este evento: mismo jugador que tira y misma carta.
 * Si no (reconexión, renders agrupados…), el resultado se pinta solo con lo que dice el evento.
 */
export function ventanaDeTirada(
  v: InstantaneaVentana | null,
  e: { jugador: string; carta: string; tipo: 'heroe' | 'ataque' },
): VentanaModsVista | null {
  if (v === null || v.ventana.contexto.tipo !== e.tipo) return null;
  if (v.ventana.tiradas[0]?.jugador !== e.jugador || v.carta !== e.carta) return null;
  return v.ventana;
}

/**
 * Escenario central de la mesa. Sustituye al antiguo recuadro de la esquina: cada ventana de
 * respuesta (intento de jugar una carta, tirada, duelo de desafío) se cuenta en el centro, con la
 * mesa oscurecida suavemente, y su resultado se enseña unos segundos al cerrarse la ventana.
 * `onActivo` avisa a la mesa (p. ej. para que el rótulo de turno se haga pequeño).
 */
export function Escenario({ onActivo }: { onActivo: (activo: boolean) => void }) {
  const m = useMesa();
  const { motor } = useCatalogo();
  const { director, vista } = m;
  const reducir = useReducirAnimaciones();
  const cima = vista.pila[vista.pila.length - 1];
  const ventana = cima?.tipo === 'ventanaDesafio' || cima?.tipo === 'ventanaModificadores';

  // Última ventana de tiradas vista: al cerrarse ya no está en la pila y sus dados se necesitan.
  const ultimaVentana = useRef<InstantaneaVentana | null>(null);
  useEffect(() => {
    if (cima?.tipo !== 'ventanaModificadores') return;
    const c = cima.contexto;
    ultimaVentana.current = {
      ventana: cima,
      carta: c.tipo === 'heroe' ? m.idDe(c.heroe) : c.tipo === 'ataque' ? m.idDe(c.monstruo) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cima]);

  // Eventos nuevos → resultados en la cola.
  const n = director.eventos.length;
  const visto = useRef(n);
  const siguienteId = useRef(1);
  const jugadaEnCurso = useRef<{ jugador: string; carta: string } | null>(null);
  const [cola, setCola] = useState<Final[]>([]);
  useEffect(() => {
    const nuevos = director.eventos.slice(visto.current);
    visto.current = n;
    const finales: Final[] = [];
    const id = (): number => siguienteId.current++;
    for (const e of nuevos) {
      const v = ultimaVentana.current;
      switch (e.tipo) {
        case 'cartaJugada':
          jugadaEnCurso.current = { jugador: e.jugador, carta: e.carta };
          break;
        case 'desafioResuelto':
          if (v?.ventana.contexto.tipo === 'desafio' && v.ventana.tiradas.length === 2) {
            finales.push({
              id: id(),
              tipo: 'duelo',
              ganador: e.ganador,
              totalDesafiante: e.totalDesafiante,
              totalDesafiado: e.totalDesafiado,
              ventana: v.ventana,
            });
            ultimaVentana.current = null;
          }
          break;
        case 'tiradaHeroe':
          {
            finales.push({
              id: id(),
              tipo: 'tirada',
              resultado: e.exito ? 'exito' : 'fracaso',
              jugador: e.jugador,
              total: e.total,
              carta: e.heroe,
              ataque: false,
              ventana: ventanaDeTirada(v, { jugador: e.jugador, carta: e.heroe, tipo: 'heroe' }),
            });
            ultimaVentana.current = null;
          }
          break;
        case 'ataqueResuelto':
          {
            finales.push({
              id: id(),
              tipo: 'tirada',
              resultado: e.resultado,
              jugador: e.jugador,
              total: e.total,
              carta: e.monstruo,
              ataque: true,
              ventana: ventanaDeTirada(v, {
                jugador: e.jugador,
                carta: e.monstruo,
                tipo: 'ataque',
              }),
            });
            ultimaVentana.current = null;
          }
          break;
        case 'heroeEntra':
        case 'objetoEquipado':
        case 'magiaResuelta': {
          const j = jugadaEnCurso.current;
          if (j !== null && j.jugador === e.jugador && j.carta === e.carta) {
            jugadaEnCurso.current = null;
            finales.push({
              id: id(),
              tipo: 'jugada',
              jugador: e.jugador,
              carta: e.carta,
              forma:
                e.tipo === 'heroeEntra'
                  ? 'heroe'
                  : e.tipo === 'objetoEquipado'
                    ? 'objeto'
                    : 'magia',
            });
          }
          break;
        }
        case 'cartaAnulada':
          jugadaEnCurso.current = null;
          finales.push({ id: id(), tipo: 'anulada', jugador: e.jugador, carta: e.carta });
          break;
        default:
          break;
      }
    }
    if (finales.length > 0) setCola((c) => [...c, ...finales].slice(-MAX_COLA));
  }, [director, n]);

  // Mientras hay otra cosa encima (traspaso, celebración, una pregunta al que mira o otra ventana) el resultado
  // no se enseña: se descarta, porque ya no sería actual cuando terminara.
  const hayPregunta =
    cima !== undefined &&
    (cima.tipo === 'decision' || cima.tipo === 'tiradaInmediata' || cima.tipo === 'elegir') &&
    cima.jugador === m.yo;
  const tapado = director.traspaso !== null || director.celebracion !== null;
  // Pausa tras un resultado: el anfitrión mantiene la ventana o la pregunta siguiente ya abiertas,
  // pero nadie puede actuar. Durante la pausa se sigue enseñando el resultado (ni se descarta ni se
  // tapa con la escena nueva); al terminar, sigue el flujo normal. La celebración manda sobre ella.
  const hayPausa = director.pausaResultado !== null;
  const otraCosa = (ventana || hayPregunta) && !hayPausa;
  const actual = otraCosa || tapado ? undefined : cola[0];
  useEffect(() => {
    if (otraCosa || tapado) setCola((c) => (c.length > 0 ? [] : c));
  }, [otraCosa, tapado]);
  const actualId = actual?.id;
  const duracion = actual === undefined ? 0 : duracionFinal(actual, reducir);
  // El resultado dura lo suyo, pero no se retira antes de que acabe la pausa (si dura menos, se
  // queda hasta el final de la pausa; así nunca queda un hueco vacío con la mesa bloqueada).
  const [vencido, setVencido] = useState<number | null>(null);
  useEffect(() => {
    if (actualId === undefined) return undefined;
    const t = window.setTimeout(() => setVencido(actualId), duracion);
    return () => window.clearTimeout(t);
  }, [actualId, duracion]);
  useEffect(() => {
    if (actualId === undefined || vencido !== actualId || hayPausa) return;
    setCola((c) => c.filter((f) => f.id !== actualId));
  }, [actualId, vencido, hayPausa]);

  // D-11: la carta de Desafío va al descarte al jugarse y es pública: la más reciente de ese tipo.
  let cartaDesafio: string | null = null;
  if (cima?.tipo === 'ventanaModificadores' && cima.contexto.tipo === 'desafio') {
    for (let i = vista.descarte.length - 1; i >= 0 && cartaDesafio === null; i--) {
      const uid = vista.descarte[i];
      const id = uid === undefined ? null : m.idDe(uid);
      if (id !== null && motor.catalogo.get(id)?.tipo === 'desafio') cartaDesafio = id;
    }
  }

  let escena: ReactNode = null;
  let clave = '';
  if (hayPausa && actual !== undefined) {
    clave = `final-${actual.id}`;
    escena = <EscenaFinal final={actual} reducir={reducir} />;
  } else if (cima?.tipo === 'ventanaDesafio') {
    clave = 'intento';
    escena = <Intento cima={cima} />;
  } else if (cima?.tipo === 'ventanaModificadores') {
    clave = cima.contexto.tipo === 'desafio' ? 'duelo' : 'tirada';
    escena =
      cima.contexto.tipo === 'desafio' ? (
        <EscenaDuelo cima={cima} cartaDesafio={cartaDesafio} />
      ) : (
        <EscenaTirada cima={cima} />
      );
  } else if (actual !== undefined) {
    clave = `final-${actual.id}`;
    escena = <EscenaFinal final={actual} reducir={reducir} />;
  }

  const activo = escena !== null;
  useEffect(() => {
    onActivo(activo);
    return () => onActivo(false);
  }, [activo, onActivo]);

  const salida = { duration: 0.2 };
  return (
    <div
      data-escenario={activo ? clave.split('-')[0] : undefined}
      className={`pointer-events-none fixed inset-0 ${CAPA.escenario} flex flex-col`}
    >
      {/* Fondo: la mesa se oscurece suavemente, pero se sigue viendo para decidir. */}
      <AnimatePresence>
        {activo && (
          <motion.div
            key="fondo"
            aria-hidden="true"
            className="absolute inset-0 bg-stone-950/35"
            initial={reducir ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            {...(reducir
              ? {}
              : { exit: { opacity: 0, pointerEvents: 'none' as const, transition: salida } })}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>
      <div className="relative flex min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-28">
        <div className="pointer-events-auto mx-auto flex max-w-full max-sm:mb-2 max-sm:mt-auto sm:my-auto">
          <AnimatePresence mode="wait">
            {activo && (
              <motion.div
                key={clave}
                initial={reducir ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                {...(reducir
                  ? {}
                  : { exit: { opacity: 0, pointerEvents: 'none' as const, transition: salida } })}
                transition={{ duration: 0.2 }}
              >
                {escena}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
