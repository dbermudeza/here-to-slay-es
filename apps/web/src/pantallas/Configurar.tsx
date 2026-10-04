import type { Modo } from '@hts/engine';
import { useState, type ReactNode } from 'react';
import {
  nivelDeBot,
  SEGUNDOS_POR_DEFECTO,
  semillaAleatoria,
  type ConfigLocal,
  type Dificultad,
  type ModoJuego,
} from '../juego/config';
import { lista, t } from '../i18n';
import { Boton } from '../ui/Boton';

interface Props {
  modoInicial: ModoJuego;
  onEmpezar: (config: ConfigLocal) => void;
  onVolver: () => void;
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
      <legend className="px-1 font-titulo text-lg font-semibold">{titulo}</legend>
      {children}
    </fieldset>
  );
}

export function Eleccion<T extends string>({
  nombre,
  valor,
  opciones,
  onCambio,
}: {
  nombre: string;
  valor: T;
  opciones: { valor: T; titulo: string; descripcion: string }[];
  onCambio: (v: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
      {opciones.map((o) => (
        <label
          key={o.valor}
          className={`cursor-pointer rounded-lg p-3 ring-1 transition ${
            valor === o.valor
              ? 'bg-amber-50 ring-2 ring-amber-500 dark:bg-amber-950/40'
              : 'ring-stone-200 hover:bg-stone-50 dark:ring-stone-700 dark:hover:bg-stone-800'
          }`}
        >
          <input
            type="radio"
            name={nombre}
            value={o.valor}
            checked={valor === o.valor}
            onChange={() => onCambio(o.valor)}
            className="sr-only"
          />
          <span className="block font-semibold">{o.titulo}</span>
          <span className="block text-sm text-stone-600 dark:text-stone-400">{o.descripcion}</span>
        </label>
      ))}
    </div>
  );
}

export const campo =
  'w-full rounded-lg bg-stone-50 px-3 py-2 ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-stone-800 dark:ring-stone-600';

export function Configurar({ modoInicial, onEmpezar, onVolver }: Props) {
  const [modo, setModo] = useState<ModoJuego>(modoInicial);
  const [reglas, setReglas] = useState<Modo>('normal');
  const [numLocal, setNumLocal] = useState(3);
  const [nombres, setNombres] = useState<string[]>(() =>
    Array.from({ length: 6 }, (_, i) => t('config.nombreJugador', { n: i + 1 })),
  );
  const [miNombre, setMiNombre] = useState(t('config.nombreJugador', { n: 1 }));
  const [numBots, setNumBots] = useState(2);
  const [dificultad, setDificultad] = useState<Dificultad>('normal');
  const [segundos, setSegundos] = useState(SEGUNDOS_POR_DEFECTO);
  const [semilla, setSemilla] = useState('');
  const [error, setError] = useState<string | null>(null);

  const empezar = (): void => {
    const nombresBots = lista<string>('bots.nombres');
    const jugadores: ConfigLocal['jugadores'] =
      modo === 'local'
        ? nombres
            .slice(0, numLocal)
            .map((nombre, i) => ({ id: `j${i + 1}`, nombre: nombre.trim(), control: 'humano' }))
        : [
            { id: 'j1', nombre: miNombre.trim(), control: 'humano' },
            ...Array.from({ length: numBots }, (_, i) => ({
              id: `j${i + 2}`,
              nombre: nombresBots[i] ?? `Bot ${i + 1}`,
              control: nivelDeBot(dificultad, i),
            })),
          ];
    if (jugadores.some((j) => j.nombre === '')) return setError(t('config.errores.nombreVacio'));
    if (new Set(jugadores.map((j) => j.nombre.toLowerCase())).size !== jugadores.length) {
      return setError(t('config.errores.nombresRepetidos'));
    }
    onEmpezar({
      modo,
      reglas,
      jugadores,
      semilla: semilla.trim() || semillaAleatoria(),
      segundos,
      ...(modo === 'bots' ? { dificultad } : {}),
    });
    return undefined;
  };

  const numero = (clave: keyof typeof segundos, etiqueta: string) => (
    <label className="block text-sm">
      {etiqueta}
      <input
        type="number"
        min={1}
        max={60}
        value={segundos[clave]}
        onChange={(e) =>
          setSegundos({
            ...segundos,
            [clave]: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
          })
        }
        className={`${campo} mt-1`}
      />
    </label>
  );

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="font-titulo text-3xl font-bold">{t('config.titulo')}</h1>

      <Seccion titulo={t('config.modo')}>
        <Eleccion
          nombre="modo"
          valor={modo}
          onCambio={setModo}
          opciones={[
            {
              valor: 'local',
              titulo: t('config.modoLocal'),
              descripcion: t('config.modoLocalDesc'),
            },
            { valor: 'bots', titulo: t('config.modoBots'), descripcion: t('config.modoBotsDesc') },
          ]}
        />
      </Seccion>

      <Seccion titulo={t('config.reglas')}>
        <Eleccion
          nombre="reglas"
          valor={reglas}
          onCambio={setReglas}
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
      </Seccion>

      <Seccion titulo={t('config.jugadores')}>
        {modo === 'local' ? (
          <div className="space-y-3">
            <label className="block text-sm">
              {t('config.numJugadores')}
              <select
                value={numLocal}
                onChange={(e) => setNumLocal(Number(e.target.value))}
                className={`${campo} mt-1`}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {nombres.slice(0, numLocal).map((nombre, i) => (
                <input
                  key={i}
                  aria-label={t('config.nombreJugador', { n: i + 1 })}
                  value={nombre}
                  maxLength={20}
                  onChange={(e) =>
                    setNombres(nombres.map((x, k) => (k === i ? e.target.value : x)))
                  }
                  className={campo}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              {t('config.tuNombre')}
              <input
                value={miNombre}
                maxLength={20}
                onChange={(e) => setMiNombre(e.target.value)}
                className={`${campo} mt-1`}
              />
            </label>
            <label className="block text-sm">
              {t('config.numBots')}
              <select
                value={numBots}
                onChange={(e) => setNumBots(Number(e.target.value))}
                className={`${campo} mt-1`}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="mb-2 text-sm">{t('config.dificultad')}</div>
              <Eleccion
                nombre="dificultad"
                valor={dificultad}
                onCambio={setDificultad}
                opciones={[
                  { valor: 'facil', titulo: t('config.facil'), descripcion: t('config.facilDesc') },
                  {
                    valor: 'normal',
                    titulo: t('config.normal'),
                    descripcion: t('config.normalDesc'),
                  },
                  { valor: 'mixta', titulo: t('config.mixta'), descripcion: t('config.mixtaDesc') },
                ]}
              />
            </div>
          </div>
        )}
      </Seccion>

      <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
        <summary className="cursor-pointer font-semibold">{t('config.avanzadas')}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {numero('desafio', t('config.segDesafio'))}
          {numero('modificadores', t('config.segModificadores'))}
          {numero('modificadoresDesafio', t('config.segModificadoresDesafio'))}
        </div>
        <label className="mt-3 block text-sm">
          {t('config.semilla')}
          <input
            value={semilla}
            onChange={(e) => setSemilla(e.target.value)}
            className={`${campo} mt-1`}
          />
        </label>
      </details>

      {error !== null && (
        <p
          role="alert"
          className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <Boton variante="fantasma" onClick={onVolver}>
          {t('comun.volver')}
        </Boton>
        <Boton variante="primario" onClick={empezar}>
          {t('config.empezar')}
        </Boton>
      </div>
    </main>
  );
}
