import type { JugadorVista } from '@hts/engine';
import { t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { Carta, type Tamano } from '../../ui/Carta';
import { clave, useMesa } from './contexto';

/** Grupo de un jugador: Líder, Héroes (con su Objeto) y Monstruos matados. */
export function ZonaJugador({ jugador, propia }: { jugador: JugadorVista; propia: boolean }) {
  const m = useMesa();
  const { vista, director } = m;
  const enTurno = vista.turno.jugador === jugador.id;
  const control = director.config.jugadores.find((j) => j.id === jugador.id)?.control;
  const tam: Tamano = propia ? 'md' : 'sm';

  return (
    <section
      aria-label={jugador.nombre}
      data-zona={`grupo:${jugador.id}`}
      className={`rounded-xl p-2 ring-1 transition ${
        enTurno
          ? 'bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-950/30'
          : 'bg-white/70 ring-stone-200 dark:bg-stone-900/70 dark:ring-stone-700'
      }`}
    >
      <header className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold">{jugador.nombre}</span>
        {director.conexion(jugador.id) !== 'conectado' && (
          <span className="rounded bg-red-100 px-1.5 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
            {t(`mesa.conexion.${director.conexion(jugador.id)}`)}
          </span>
        )}
        {control !== undefined && control !== 'humano' && (
          <span className="rounded bg-stone-200 px-1.5 text-xs dark:bg-stone-700">
            {t('mesa.bot', { nivel: t(`niveles.${control}`) })}
          </span>
        )}
        {!propia && (
          <span className="text-stone-600 dark:text-stone-400" data-zona={`mano:${jugador.id}`}>
            {t('mesa.cartasEnMano', { n: jugador.cartasEnMano })}
          </span>
        )}
        <span className="text-stone-600 dark:text-stone-400">
          {t('mesa.monstruosMatados', { n: jugador.monstruos.length })}
        </span>
      </header>
      <div className="flex items-end gap-2 overflow-x-auto pb-1">
        <Carta
          cartaId={m.idDe(jugador.lider)}
          tamano={tam}
          onZoom={m.ampliar}
          onClick={() => m.detalleDe(jugador.lider)}
        />
        {jugador.grupo.length === 0 && (
          <span className="self-center px-2 text-xs text-stone-600 dark:text-stone-400">
            {t('mesa.sinHeroes')}
          </span>
        )}
        {jugador.grupo.map((r) => {
          const heroeId = m.idDe(r.heroe);
          const objetivo = m.equipando !== null && m.objetivosEquipar.has(r.heroe);
          const usar = { tipo: 'TIRAR_HEROE' as const, uid: r.heroe };
          return (
            <div key={r.heroe} className="flex flex-col items-center gap-1">
              <div className="relative">
                <Carta
                  cartaId={heroeId}
                  uid={r.heroe}
                  tamano={tam}
                  resaltada={objetivo}
                  atenuada={m.equipando !== null && !objetivo}
                  onZoom={m.ampliar}
                  onClick={
                    objetivo && m.equipando !== null
                      ? () => {
                          m.enviar({
                            tipo: 'JUGAR_CARTA',
                            uid: m.equipando ?? '',
                            objetivo: r.heroe,
                          });
                          m.setEquipando(null);
                        }
                      : () =>
                          m.detalleDe(r.heroe, {
                            objetoId:
                              r.objeto === null ? undefined : (m.idDe(r.objeto) ?? undefined),
                          })
                  }
                />
                {r.objeto !== null && (
                  <div className="absolute -bottom-1 -right-2">
                    <Carta
                      cartaId={m.idDe(r.objeto)}
                      tamano="xs"
                      onZoom={m.ampliar}
                      onClick={() =>
                        r.objeto !== null &&
                        m.detalleDe(r.objeto, { heroeId: heroeId ?? undefined })
                      }
                    />
                  </div>
                )}
              </div>
              {propia && m.esMiTurnoLibre && (
                <Boton
                  pequeno
                  motivo={m.motivo(usar)}
                  data-accion={clave(usar)}
                  onClick={() => m.enviar(usar)}
                >
                  {t('mesa.acciones.usarEfecto')} · {t('mesa.acciones.coste', { n: 1 })}
                </Boton>
              )}
            </div>
          );
        })}
        {jugador.monstruos.length > 0 && (
          <div className="ml-2 flex gap-1 border-l border-stone-300 pl-2 dark:border-stone-600">
            {jugador.monstruos.map((uid) => (
              <Carta
                key={uid}
                cartaId={m.idDe(uid)}
                tamano={propia ? 'sm' : 'xs'}
                onZoom={m.ampliar}
                onClick={() => m.detalleDe(uid)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
