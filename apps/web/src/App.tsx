import { useEffect, useState } from 'react';
import cartasCrudas from 'virtual:cartas';
import { useApp } from './estado/app';
import { ProveedorCatalogo } from './estado/contexto';
import { prepararCatalogo } from './juego/catalogo';
import { semillaAleatoria, type ModoJuego } from './juego/config';
import { DirectorVivo } from './juego/director-vivo';
import { borrarAuto } from './juego/guardado';
import { Configurar } from './pantallas/Configurar';
import { ErrorCatalogo } from './pantallas/ErrorCatalogo';
import { Inicio } from './pantallas/Inicio';
import { Mesa } from './pantallas/mesa/Mesa';
import { Reglas } from './pantallas/Reglas';
import { Tutorial } from './pantallas/Tutorial';

const catalogo = prepararCatalogo(cartasCrudas);

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

export function App() {
  useTema();
  const { pantalla, director, tutorial, irA, volver, empezar, salir, mostrarTutorial } = useApp();
  const [modoNuevo, setModoNuevo] = useState<ModoJuego>('bots');

  if (!catalogo.ok) return <ErrorCatalogo motivo={catalogo.motivo} detalle={catalogo.detalle} />;
  const { motor, cartas } = catalogo;

  return (
    <ProveedorCatalogo motor={motor} cartas={cartas}>
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
          onEmpezar={(config) => empezar(DirectorVivo.nueva(motor, config))}
        />
      )}
      {pantalla === 'reglas' && <Reglas onVolver={volver} />}
      {pantalla === 'mesa' && director !== null && (
        <Mesa
          key={director.config.semilla}
          director={director}
          onTutorial={() => mostrarTutorial(true)}
          onSalir={() => {
            if (director.estado.ganador !== null) borrarAuto();
            salir();
          }}
          onRevancha={() => {
            borrarAuto();
            empezar(DirectorVivo.nueva(motor, { ...director.config, semilla: semillaAleatoria() }));
          }}
        />
      )}
      <Tutorial abierto={tutorial} onCerrar={() => mostrarTutorial(false)} />
    </ProveedorCatalogo>
  );
}
