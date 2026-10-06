import { PA_POR_TURNO, type Accion, type JugadorId, type Uid } from '@hts/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalogo, useDirector } from '../../estado/contexto';
import { DirectorVivo } from '../../juego/director-vivo';
import type { FuenteMesa } from '../../juego/fuente';
import { descargar, guardarAuto } from '../../juego/guardado';
import { t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { Carta } from '../../ui/Carta';
import { DetalleCarta, type Detalle } from '../../ui/DetalleCarta';
import { Logo } from '../../ui/Logo';
import { Modal } from '../../ui/Modal';
import { Ajustes } from '../../ui/Ajustes';
import { ContenidoReglas } from '../Reglas';
import { AccionesTurno } from './AccionesTurno';
import { CelebracionMonstruo } from './CelebracionMonstruo';
import { Centro } from './Centro';
import { Escenario } from './Escenario';
import { MesaContexto, mismaAccion, type ValorMesa } from './contexto';
import { TiempoDecision } from './TiempoDecision';
import { Vuelos } from './Vuelos';
import { DialogoDecision } from './DialogoDecision';
import { Anunciador, Historial } from './Historial';
import { Mano } from './Mano';
import { RotuloTurno } from './RotuloTurno';
import { Traspaso, Victoria } from './Superposiciones';
import { ZonaJugador } from './ZonaJugador';

interface Props {
  director: FuenteMesa;
  /** Texto del botón de revancha (en línea: "Volver a la sala"). */
  textoRevancha?: string;
  onSalir: () => void;
  onRevancha: () => void;
  onTutorial: () => void;
}

export function Mesa({ director, onSalir, onRevancha, onTutorial, textoRevancha }: Props) {
  const version = useDirector(director);
  const { motor } = useCatalogo();
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [equipando, setEquipando] = useState<Uid | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [menu, setMenu] = useState(false);
  const [reglas, setReglas] = useState(false);
  const [historialMovil, setHistorialMovil] = useState(false);
  /** El escenario central (ventana de respuesta o su resultado) está en pantalla. */
  const [escenarioActivo, setEscenarioActivo] = useState(false);
  /** Rendirse (D-43): pedir confirmación y, una vez hecho, ofrecer ver la partida o salir. */
  const [rendicion, setRendicion] = useState<'confirmar' | 'hecha' | null>(null);
  const [rendido, setRendido] = useState<string>('');

  // Guardado automático tras cada cambio (solo partidas locales).
  const local = director instanceof DirectorVivo ? director : null;
  useEffect(() => {
    if (local !== null) guardarAuto(local);
  }, [local, version]);

  // Pruebas e2e: el piloto (src/e2e/piloto.ts) lee la mesa activa.
  useEffect(() => {
    if (import.meta.env.MODE !== 'e2e') return undefined;
    window.__htsMesa = { director, motor };
    return () => {
      window.__htsMesa = undefined;
    };
  }, [director, motor]);

  const valor = useMemo((): ValorMesa => {
    const vista = director.vista();
    const legales = director.legales();
    const yo = director.observador;
    const nombres = new Map(vista.jugadores.map((j) => [j.id, j.nombre]));
    const esLegal = (a: Accion): boolean => legales.some((l) => mismaAccion(l, a));
    const objetivos = new Set<Uid>();
    if (equipando !== null) {
      for (const a of legales)
        if (a.tipo === 'JUGAR_CARTA' && a.uid === equipando && a.objetivo !== undefined)
          objetivos.add(a.objetivo);
    }
    return {
      director,
      vista,
      legales,
      yo,
      esMiTurnoLibre:
        vista.turno.jugador === yo &&
        vista.pila.length === 0 &&
        vista.ganador === null &&
        director.traspaso === null,
      enviar: (a) => {
        director.actuar(a);
      },
      motivo: (a) => {
        if (esLegal(a)) return null;
        const codigo = director.motivo(a);
        return t(`errores.${codigo ?? 'NO_ES_MOMENTO'}`);
      },
      nombreJugador: (id: JugadorId) => nombres.get(id) ?? id,
      nombreCarta: (id: string) => motor.catalogo.get(id)?.nombre ?? id,
      idDe: (uid: Uid) => vista.cartas[uid] ?? null,
      ampliar: setAmpliada,
      verDetalle: setDetalle,
      detalleDe: (uid, extra = {}) => {
        const cartaId = vista.cartas[uid];
        if (cartaId !== undefined) setDetalle({ cartaId, ...extra });
      },
      equipando,
      setEquipando,
      objetivosEquipar: objetivos,
    };
    // `version` cambia con cada acción del director.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, version, equipando, motor]);

  const { vista, yo } = valor;
  // Monstruo derrotado: la mesa queda tapada, bloqueada e inerte hasta que acaba la celebración.
  const celebracion = director.celebracion;
  const restanteCelebracion = director.restanteCelebracionMs();
  const hayCelebracion = celebracion !== null;
  // Quien tenía el foco antes de la celebración lo recupera al acabar (la mesa está inerte).
  const foco = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (hayCelebracion) {
      return () => {
        const antes = foco.current;
        if (antes?.isConnected === true) antes.focus();
      };
    }
    const guardar = (e: FocusEvent): void => {
      if (e.target instanceof HTMLElement && e.target !== document.body) foco.current = e.target;
    };
    document.addEventListener('focusin', guardar);
    return () => document.removeEventListener('focusin', guardar);
  }, [hayCelebracion]);
  const meRendi = vista.rendidos.includes(yo);
  const modo = director.config.modo;
  const rendirse = (): void => {
    setRendido(valor.nombreJugador(yo));
    director.actuar({ tipo: 'RENDIRSE' });
    setRendicion('hecha');
  };
  // PA: durante el turno se pintan siempre los del inicio (con los gastados vacíos); los que
  // superan la base vienen de una pasiva (p. ej. la Megababosa) y se destacan.
  const totalPA = Math.max(PA_POR_TURNO, vista.turno.paInicial, vista.turno.pa);
  const extraPA = totalPA - PA_POR_TURNO;
  const jugadorTurno = vista.jugadores.find((j) => j.id === vista.turno.jugador);
  const origenExtra = (jugadorTurno?.monstruos ?? [])
    .map((uid) => vista.cartas[uid])
    .find((id) => id === 'monstruo_megababosa');
  const descripcionPA =
    extraPA <= 0
      ? t('mesa.paRestantes', { n: vista.turno.pa })
      : t('mesa.paRestantesExtra', {
          n: vista.turno.pa,
          total: totalPA,
          extra:
            origenExtra === undefined
              ? t('mesa.paExtraGenerico', { n: extraPA })
              : t('mesa.paExtraDe', { n: extraPA, carta: valor.nombreCarta(origenExtra) }),
        });
  const propio = vista.jugadores.find((j) => j.id === yo);
  const rivales = vista.jugadores.filter((j) => j.id !== yo);
  const cima = vista.pila[vista.pila.length - 1];
  const actor = director.actorRequerido();
  const esperando =
    vista.ganador === null && actor !== null && actor !== yo && director.esBot(actor)
      ? t('mesa.esperando', { nombre: valor.nombreJugador(actor) })
      : null;

  return (
    <MesaContexto.Provider value={valor}>
      <div className="h-full">
        {/* La mesa entera queda inerte (sin foco ni clics) mientras dura la celebración. */}
        <div inert={hayCelebracion} className="flex h-full flex-col">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 bg-white/80 px-3 py-2 dark:border-stone-800 dark:bg-stone-900/80">
            <Logo
              className="h-9 w-9 rounded-lg p-0.5"
              textoClassName="font-titulo text-lg font-bold text-amber-700 dark:text-amber-400"
            />
            <span className="text-sm">{t('mesa.turnoNumero', { n: vista.turno.numero })}</span>
            <span className="font-semibold">
              {vista.turno.jugador === yo
                ? t('mesa.tuTurno')
                : t('mesa.turnoDe', { nombre: valor.nombreJugador(vista.turno.jugador) })}
            </span>
            <span
              className="flex items-center gap-1"
              role="img"
              data-pa
              aria-label={descripcionPA}
              title={descripcionPA}
            >
              {Array.from({ length: totalPA }, (_, i) => {
                const lleno = i < vista.turno.pa;
                const extra = i >= PA_POR_TURNO;
                const color = lleno
                  ? extra
                    ? 'bg-sky-600 dark:bg-sky-400'
                    : 'bg-amber-500'
                  : 'bg-stone-300 dark:bg-stone-700';
                return (
                  <span
                    key={i}
                    data-extra={extra ? '' : undefined}
                    className={`h-3 w-3 rounded-full ${color} ${extra ? 'ring-2 ring-sky-600 ring-offset-1 dark:ring-sky-400 dark:ring-offset-stone-900' : ''}`}
                  />
                );
              })}
              <span className="ml-1 text-sm">{t('mesa.pa')}</span>
            </span>
            <span className="text-sm text-stone-600 dark:text-stone-400">
              {t(`mesa.reglasModo.${vista.opciones.modo}`)}
            </span>
            <TiempoDecision />
            {meRendi && vista.ganador === null && (
              <span className="rounded bg-stone-200 px-2 py-0.5 text-sm dark:bg-stone-700">
                {t('mesa.rendirse.espectador')}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <Boton
                pequeno
                variante="fantasma"
                className="lg:hidden"
                onClick={() => setHistorialMovil(true)}
              >
                {t('mesa.verLog')}
              </Boton>
              <Boton pequeno onClick={() => setMenu(true)}>
                {t('mesa.menu.titulo')}
              </Boton>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 space-y-3 overflow-y-auto p-3 pb-56 lg:pb-3">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {rivales.map((j) => (
                  <ZonaJugador key={j.id} jugador={j} propia={false} />
                ))}
              </div>
              <Centro />
              {esperando !== null &&
                cima?.tipo !== 'ventanaDesafio' &&
                cima?.tipo !== 'ventanaModificadores' && (
                  <p
                    role="status"
                    className="text-center text-sm text-stone-600 dark:text-stone-400"
                  >
                    {esperando}
                  </p>
                )}
              {propio !== undefined && <ZonaJugador jugador={propio} propia />}
              <AccionesTurno />
              <Mano />
            </main>
            <div className="hidden w-80 shrink-0 border-l border-stone-200 p-3 lg:flex lg:flex-col dark:border-stone-800">
              {ampliada !== null && (
                <div className="mb-3 flex justify-center">
                  <Carta cartaId={ampliada} tamano="lg" />
                </div>
              )}
              <Historial />
            </div>
          </div>

          <Escenario onActivo={setEscenarioActivo} />
          <DialogoDecision />
          <Vuelos pausado={escenarioActivo} />
          <Traspaso />
          <RotuloTurno
            numero={vista.turno.numero}
            jugador={vista.turno.jugador}
            titulo={
              vista.turno.jugador === yo && modo !== 'local'
                ? t('mesa.tuTurno')
                : t('mesa.turnoDe', { nombre: valor.nombreJugador(vista.turno.jugador) })
            }
            pausado={
              director.traspaso !== null || hayCelebracion || director.pausaResultado !== null
            }
            compacto={escenarioActivo}
            // Solo al montar: el primer turno intacto de una partida recién creada.
            anunciarAlMontar={
              vista.turno.numero === 1 && vista.turno.pa === 3 && vista.ganador === null
            }
          />
          <Victoria onRevancha={onRevancha} onInicio={onSalir} textoRevancha={textoRevancha} />
          <DetalleCarta detalle={detalle} onCerrar={() => setDetalle(null)} />

          <Modal
            abierto={historialMovil}
            titulo={t('mesa.log')}
            onCerrar={() => setHistorialMovil(false)}
          >
            <div className="h-[60vh]">
              <Historial />
            </div>
          </Modal>

          <Modal
            abierto={menu}
            titulo={t('mesa.menu.titulo')}
            onCerrar={() => setMenu(false)}
            ancho="sm"
          >
            <div className="flex flex-col gap-2">
              {local !== null && (
                <Boton onClick={() => descargar(local)}>{t('mesa.menu.exportar')}</Boton>
              )}
              <Boton
                onClick={() => {
                  setMenu(false);
                  setReglas(true);
                }}
              >
                {t('mesa.menu.reglas')}
              </Boton>
              <Boton
                onClick={() => {
                  setMenu(false);
                  onTutorial();
                }}
              >
                {t('mesa.menu.tutorial')}
              </Boton>
              <div className="py-1">
                <Ajustes />
              </div>
              {vista.ganador === null && !meRendi && (
                <Boton
                  variante="peligro"
                  onClick={() => {
                    setMenu(false);
                    setRendicion('confirmar');
                  }}
                >
                  {t('mesa.menu.rendirse')}
                </Boton>
              )}
              <Boton
                variante="peligro"
                onClick={() => {
                  if (window.confirm(t('mesa.menu.salirConfirmar'))) onSalir();
                }}
              >
                {t('mesa.menu.salir')}
              </Boton>
            </div>
          </Modal>

          <Modal
            abierto={rendicion === 'confirmar'}
            titulo={t('mesa.rendirse.titulo')}
            onCerrar={() => setRendicion(null)}
            ancho="sm"
          >
            <p className="text-stone-700 dark:text-stone-300">{t('mesa.rendirse.texto')}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Boton onClick={() => setRendicion(null)}>{t('mesa.rendirse.cancelar')}</Boton>
              <Boton
                variante="peligro"
                disabled={director.pausaResultado !== null}
                onClick={rendirse}
              >
                {t('mesa.rendirse.confirmar')}
              </Boton>
            </div>
          </Modal>

          <Modal
            abierto={rendicion === 'hecha' && vista.ganador === null}
            titulo={
              modo === 'local'
                ? t('mesa.rendirse.hechoLocal', { nombre: rendido })
                : t('mesa.rendirse.hecho')
            }
            ancho="sm"
          >
            <p className="text-stone-700 dark:text-stone-300">
              {modo === 'local'
                ? t('mesa.rendirse.hechoTextoLocal')
                : t('mesa.rendirse.hechoTexto')}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Boton variante="primario" onClick={() => setRendicion(null)}>
                {t('mesa.rendirse.ver')}
              </Boton>
              <Boton onClick={onSalir}>
                {modo === 'enLinea'
                  ? t('mesa.rendirse.salirSala')
                  : modo === 'local'
                    ? t('mesa.rendirse.salirLocal')
                    : t('mesa.rendirse.salir')}
              </Boton>
            </div>
          </Modal>

          <Modal
            abierto={reglas}
            titulo={t('reglas.titulo')}
            onCerrar={() => setReglas(false)}
            ancho="lg"
          >
            <ContenidoReglas />
            <div className="mt-4 text-right">
              <Boton onClick={() => setReglas(false)}>{t('comun.cerrar')}</Boton>
            </div>
          </Modal>
        </div>
        <Anunciador />
        {celebracion !== null && (
          <CelebracionMonstruo
            key={celebracion.id}
            cartaId={celebracion.carta}
            nombreJugador={valor.nombreJugador(celebracion.jugador)}
            nombreMonstruo={valor.nombreCarta(celebracion.carta)}
            duracionMs={celebracion.duracionMs}
            restanteMs={restanteCelebracion ?? 0}
          />
        )}
      </div>
    </MesaContexto.Provider>
  );
}
