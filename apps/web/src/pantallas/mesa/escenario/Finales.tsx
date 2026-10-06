import type { PendienteVista, ResultadoAtaque } from '@hts/engine';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useReducirAnimaciones } from '../../../estado/app';
import { t } from '../../../i18n';
import { Carta } from '../../../ui/Carta';
import { useMesa } from '../contexto';
import { desplazamiento } from '../zonas';
import { FichaTirada, Titular } from './Piezas';
import { CARTA_GRANDE, modificacionesVista } from './Ventanas';

type VentanaModsVista = Extract<PendienteVista, { tipo: 'ventanaModificadores' }>;

/** Lo que queda por enseñar después de que una ventana se cierra (lo deducen los eventos). */
export type Final =
  | {
      id: number;
      tipo: 'duelo';
      ganador: 'desafiante' | 'desafiado';
      totalDesafiante: number;
      totalDesafiado: number;
      ventana: VentanaModsVista;
    }
  | {
      id: number;
      tipo: 'tirada';
      resultado: ResultadoAtaque;
      jugador: string;
      total: number;
      /** Carta de la tirada (Héroe o Monstruo) y su nombre. */
      carta: string;
      ataque: boolean;
      /** null si la ventana guardada no era la de este resultado: se pinta solo con el evento. */
      ventana: VentanaModsVista | null;
    }
  | {
      id: number;
      tipo: 'jugada';
      jugador: string;
      carta: string;
      forma: 'heroe' | 'objeto' | 'magia';
    }
  | { id: number; tipo: 'anulada'; jugador: string; carta: string };

/** Cuánto se queda cada resultado en pantalla (ms). */
export function duracionFinal(f: Final, reducir: boolean): number {
  if (reducir) return 2500;
  switch (f.tipo) {
    case 'duelo':
      return 3000;
    case 'tirada':
      return 2800;
    case 'jugada':
      return 2500;
    case 'anulada':
      return 2700;
  }
}

function FinalDuelo({ f }: { f: Extract<Final, { tipo: 'duelo' }> }) {
  const m = useMesa();
  const ctx = f.ventana.contexto;
  if (ctx.tipo !== 'desafio') return null;
  const desafiado = f.ventana.tiradas[0];
  const desafiante = f.ventana.tiradas[1];
  if (desafiado === undefined || desafiante === undefined) return null;
  const ganadorId = f.ganador === 'desafiante' ? desafiante.jugador : desafiado.jugador;
  const fichas = [
    {
      tir: desafiante,
      etiqueta: t('ventana.desafiante'),
      total: f.totalDesafiante,
      gana: f.ganador === 'desafiante',
    },
    {
      tir: desafiado,
      etiqueta: t('ventana.desafiado'),
      total: f.totalDesafiado,
      gana: f.ganador === 'desafiado',
    },
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <Titular
        impacto
        titulo={t('ventana.final.ganaDuelo', { nombre: m.nombreJugador(ganadorId) })}
      />
      <div className="grid grid-cols-2 gap-2 sm:gap-6">
        {fichas.map(({ tir, etiqueta, total, gana }) => (
          <FichaTirada
            key={etiqueta}
            etiqueta={etiqueta}
            nombre={m.nombreJugador(tir.jugador)}
            dados={tir.dados}
            modificaciones={modificacionesVista(m, tir)}
            total={total}
            estado={gana ? 'ganador' : 'perdedor'}
          />
        ))}
      </div>
    </div>
  );
}

function FinalTirada({ f }: { f: Extract<Final, { tipo: 'tirada' }> }) {
  const m = useMesa();
  const tir = f.ventana?.tiradas[0];
  const nombre = m.nombreJugador(tir?.jugador ?? f.jugador);
  const textoTirada = f.ataque
    ? t('ventana.final.tiradaAtaque', { nombre, total: f.total, carta: m.nombreCarta(f.carta) })
    : t('ventana.final.tiradaHeroe', { nombre, total: f.total, carta: m.nombreCarta(f.carta) });
  return (
    <div className="flex flex-col items-center gap-4">
      <Titular
        impacto={f.resultado === 'exito'}
        titulo={t(
          `ventana.final.${f.resultado === 'exito' ? 'exito' : f.resultado === 'nada' ? 'nada' : 'fracaso'}`,
        )}
        subtitulo={textoTirada}
      />
      {tir !== undefined && (
        <FichaTirada
          nombre={nombre}
          dados={tir.dados}
          modificaciones={modificacionesVista(m, tir)}
          total={f.total}
          estado={f.resultado === 'exito' ? 'ganador' : 'normal'}
        />
      )}
    </div>
  );
}

/** La carta se queda un momento en el centro y vuela a su destino (o se rompe, si se anula). */
function CartaDestino({
  cartaId,
  destino,
  rota,
  duracion,
}: {
  cartaId: string;
  destino: string;
  rota: boolean;
  duracion: number;
}) {
  const reducir = useReducirAnimaciones();
  const [hasta] = useState(() => desplazamiento(destino));
  const s = duracion / 1000;
  // La entrada y la salida duran siempre lo mismo; lo que crece es la permanencia en el centro.
  const entrada = Math.min(0.3, 300 / duracion);
  const salida = 1 - Math.min(0.3, 500 / duracion);
  const medio = entrada + (salida - entrada) * 0.67;
  return (
    <motion.div
      initial={reducir ? false : { opacity: 0, scale: 0.8 }}
      animate={
        reducir
          ? { opacity: [1, 1, 0] }
          : {
              opacity: [0, 1, 1, 1, 0],
              scale: [0.8, 1, 1, 1, 0.25],
              x: [0, 0, 0, 0, hasta.x],
              y: [0, 0, 0, 0, hasta.y],
              rotate: rota ? [0, -7, 7, -5, 24] : [0, 0, 0, 0, 0],
            }
      }
      transition={{
        duration: s,
        times: reducir ? [0, 1 - Math.min(0.3, 400 / duracion), 1] : [0, entrada, medio, salida, 1],
        ease: 'easeInOut',
      }}
    >
      <Carta
        cartaId={cartaId}
        tamano="xl"
        className={`${CARTA_GRANDE} ${rota ? 'ring-4! ring-red-600!' : 'ring-4! ring-emerald-500!'}`}
      />
    </motion.div>
  );
}

function FinalJugada({ f, duracion }: { f: Extract<Final, { tipo: 'jugada' }>; duracion: number }) {
  const m = useMesa();
  const nombre = m.nombreJugador(f.jugador);
  const texto =
    f.forma === 'heroe'
      ? t('ventana.final.heroe', { nombre })
      : f.forma === 'objeto'
        ? t('ventana.final.objeto', { carta: m.nombreCarta(f.carta) })
        : t('ventana.final.magia');
  return (
    <div className="flex flex-col items-center gap-4">
      <Titular
        titulo={t('ventana.final.jugada')}
        subtitulo={`${t('ventana.final.juega', { nombre, carta: m.nombreCarta(f.carta) })} ${texto}`}
      />
      <CartaDestino
        cartaId={f.carta}
        destino={f.forma === 'magia' ? 'descarte' : `grupo:${f.jugador}`}
        rota={false}
        duracion={duracion}
      />
    </div>
  );
}

function FinalAnulada({
  f,
  duracion,
}: {
  f: Extract<Final, { tipo: 'anulada' }>;
  duracion: number;
}) {
  const m = useMesa();
  return (
    <div className="flex flex-col items-center gap-4">
      <Titular
        impacto
        titulo={t('ventana.final.anulada')}
        subtitulo={t('ventana.final.anuladaTexto', {
          carta: m.nombreCarta(f.carta),
          nombre: m.nombreJugador(f.jugador),
        })}
      />
      <CartaDestino cartaId={f.carta} destino="descarte" rota duracion={duracion} />
    </div>
  );
}

export function EscenaFinal({ final, reducir }: { final: Final; reducir: boolean }) {
  const duracion = duracionFinal(final, reducir);
  switch (final.tipo) {
    case 'duelo':
      return <FinalDuelo f={final} />;
    case 'tirada':
      return <FinalTirada f={final} />;
    case 'jugada':
      return <FinalJugada f={final} duracion={duracion} />;
    case 'anulada':
      return <FinalAnulada f={final} duracion={duracion} />;
  }
}
