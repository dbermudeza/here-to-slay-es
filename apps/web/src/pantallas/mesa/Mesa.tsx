import type { Accion, JugadorId, Uid } from '@hts/engine';
import { useEffect, useMemo, useState } from 'react';
import { useCatalogo, useDirector } from '../../estado/contexto';
import type { DirectorVivo } from '../../juego/director-vivo';
import { descargar, guardarAuto } from '../../juego/guardado';
import { t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { Carta } from '../../ui/Carta';
import { Modal } from '../../ui/Modal';
import { SelectorTema } from '../../ui/SelectorTema';
import { ContenidoReglas } from '../Reglas';
import { AccionesTurno } from './AccionesTurno';
import { Centro } from './Centro';
import { MesaContexto, mismaAccion, type ValorMesa } from './contexto';
import { Dados } from './Dados';
import { DialogoDecision } from './DialogoDecision';
import { Historial } from './Historial';
import { Mano } from './Mano';
import { Traspaso, Victoria } from './Superposiciones';
import { VentanaRespuesta } from './VentanaRespuesta';
import { ZonaJugador } from './ZonaJugador';

interface Props {
  director: DirectorVivo;
  onSalir: () => void;
  onRevancha: () => void;
  onTutorial: () => void;
}

export function Mesa({ director, onSalir, onRevancha, onTutorial }: Props) {
  const version = useDirector(director);
  const { motor } = useCatalogo();
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [equipando, setEquipando] = useState<Uid | null>(null);
  const [menu, setMenu] = useState(false);
  const [reglas, setReglas] = useState(false);
  const [historialMovil, setHistorialMovil] = useState(false);

  // Guardado automático tras cada cambio.
  useEffect(() => {
    guardarAuto(director);
  }, [director, version]);

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
        director.enviar(yo, a);
      },
      motivo: (a) => {
        if (esLegal(a)) return null;
        const codigo = director.validar(a);
        return t(`errores.${codigo ?? 'NO_ES_MOMENTO'}`);
      },
      nombreJugador: (id: JugadorId) => nombres.get(id) ?? id,
      nombreCarta: (id: string) => motor.catalogo.get(id)?.nombre ?? id,
      idDe: (uid: Uid) => vista.cartas[uid] ?? null,
      ampliar: setAmpliada,
      equipando,
      setEquipando,
      objetivosEquipar: objetivos,
    };
    // `version` cambia con cada acción del director.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, version, equipando, motor]);

  const { vista, yo } = valor;
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
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 bg-white/80 px-3 py-2 dark:border-stone-800 dark:bg-stone-900/80">
          <span className="font-titulo text-lg font-bold text-amber-700 dark:text-amber-400">
            {t('app.titulo')}
          </span>
          <span className="text-sm">{t('mesa.turnoNumero', { n: vista.turno.numero })}</span>
          <span className="font-semibold">
            {vista.turno.jugador === yo
              ? t('mesa.tuTurno')
              : t('mesa.turnoDe', { nombre: valor.nombreJugador(vista.turno.jugador) })}
          </span>
          <span
            className="flex items-center gap-1"
            aria-label={t('mesa.paRestantes', { n: vista.turno.pa })}
          >
            {Array.from({ length: Math.max(3, vista.turno.pa) }, (_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${i < vista.turno.pa ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'}`}
              />
            ))}
            <span className="ml-1 text-sm">{t('mesa.pa')}</span>
          </span>
          <span className="text-sm text-stone-500">
            {t(`mesa.reglasModo.${vista.opciones.modo}`)}
          </span>
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
                <p role="status" className="text-center text-sm text-stone-600 dark:text-stone-400">
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

        <VentanaRespuesta />
        <DialogoDecision />
        <Dados />
        <Traspaso />
        <Victoria onRevancha={onRevancha} onInicio={onSalir} />

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
            <Boton onClick={() => descargar(director)}>{t('mesa.menu.exportar')}</Boton>
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
              <SelectorTema />
            </div>
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
    </MesaContexto.Provider>
  );
}
