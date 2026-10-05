import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import cartasCrudas from 'virtual:cartas';
import { useApp, useReducirAnimaciones } from './estado/app';
import { ProveedorCatalogo } from './estado/contexto';
import { prepararCatalogo } from './juego/catalogo';
import { semillaAleatoria, type ModoJuego } from './juego/config';
import { borrarAuto } from './juego/autoguardado';
import type { ConfigLocal } from './juego/config';
import { OPCIONES_DIRECTOR } from './juego/opciones';
import { t } from './i18n';
import { ErrorCatalogo } from './pantallas/ErrorCatalogo';
import { Inicio } from './pantallas/Inicio';

// Las pantallas que no hacen falta en la portada se cargan al abrirlas (carga inicial más ligera).
const Configurar = lazy(() =>
  import('./pantallas/Configurar').then((m) => ({ default: m.Configurar })),
);
const Reglas = lazy(() => import('./pantallas/Reglas').then((m) => ({ default: m.Reglas })));
const Tutorial = lazy(() => import('./pantallas/Tutorial').then((m) => ({ default: m.Tutorial })));
const Mesa = lazy(() => import('./pantallas/mesa/Mesa').then((m) => ({ default: m.Mesa })));
const EnLinea = lazy(() => import('./pantallas/EnLinea').then((m) => ({ default: m.EnLinea })));
const Sala = lazy(() => import('./pantallas/Sala').then((m) => ({ default: m.Sala })));

const catalogo = prepararCatalogo(cartasCrudas);

function Cargando() {
  return (
    <p role="status" className="p-8 text-center text-stone-600 dark:text-stone-400">
      {t('comun.cargando')}
    </p>
  );
}

/** Aplica el tema (sistema, claro u oscuro) como clase en <html>. */
function useTema(): void {
  const tema = useApp((s) => s.tema);
  useEffect(() => {
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = (): void => {
      const oscuro = tema === 'oscuro' || (tema === 'sistema' && consulta.matches);
      document.documentElement.classList.toggle('dark', oscuro);
    };
    aplicar();
    consulta.addEventListener('change', aplicar);
    return () => consulta.removeEventListener('change', aplicar);
  }, [tema]);
}

/** Refleja "reducir animaciones" como clase en <html> (para las transiciones CSS). */
function useAnimaciones(): boolean {
  const reducir = useReducirAnimaciones();
  useEffect(() => {
    document.documentElement.classList.toggle('reducir-movimiento', reducir);
  }, [reducir]);
  return reducir;
}

export function App() {
  useTema();
  const reducir = useAnimaciones();
  const {
    pantalla,
    director,
    cliente,
    tutorial,
    irA,
    volver,
    empezar,
    salir,
    mostrarTutorial,
    abrirEnLinea,
    cerrarEnLinea,
  } = useApp();
  const [modoNuevo, setModoNuevo] = useState<ModoJuego>('bots');

  if (!catalogo.ok) return <ErrorCatalogo motivo={catalogo.motivo} detalle={catalogo.detalle} />;
  const { motor, cartas } = catalogo;

  const nuevaPartida = async (config: ConfigLocal): Promise<void> => {
    const { DirectorVivo } = await import('./juego/director-vivo');
    empezar(DirectorVivo.nueva(motor, config, undefined, OPCIONES_DIRECTOR));
  };

  return (
    <ProveedorCatalogo motor={motor} cartas={cartas}>
      <MotionConfig
        reducedMotion={reducir ? 'always' : 'never'}
        {...(reducir ? { transition: { duration: 0 } } : {})}
      >
        <Suspense fallback={<Cargando />}>
          {pantalla === 'inicio' && (
            <Inicio
              onNueva={(modo) => {
                setModoNuevo(modo);
                irA('configurar');
              }}
            />
          )}
          {pantalla === 'configurar' && (
            <Configurar
              modoInicial={modoNuevo}
              onVolver={() => irA('inicio')}
              onEmpezar={(config) => void nuevaPartida(config)}
            />
          )}
          {pantalla === 'reglas' && <Reglas onVolver={volver} />}
          {pantalla === 'enLinea' && cliente !== null && (
            <EnLinea
              cliente={cliente}
              onDentro={() => abrirEnLinea(cliente, 'sala')}
              onVolver={cerrarEnLinea}
            />
          )}
          {pantalla === 'sala' && cliente !== null && (
            <Sala
              cliente={cliente}
              onSalir={cerrarEnLinea}
              onTutorial={() => mostrarTutorial(true)}
            />
          )}
          {pantalla === 'mesa' && director !== null && (
            <Mesa
              key={director.config.semilla}
              director={director}
              onTutorial={() => mostrarTutorial(true)}
              onSalir={() => {
                const { ganador, rendidos } = director.estado;
                // Contra bots, si te has rendido ya no hay partida que continuar.
                const sinMi =
                  director.config.modo === 'bots' && rendidos.includes(director.observador);
                if (ganador !== null || sinMi) borrarAuto();
                salir();
              }}
              onRevancha={() => {
                borrarAuto();
                void nuevaPartida({ ...director.config, semilla: semillaAleatoria() });
              }}
            />
          )}
          {tutorial && <Tutorial abierto onCerrar={() => mostrarTutorial(false)} />}
        </Suspense>
      </MotionConfig>
    </ProveedorCatalogo>
  );
}
