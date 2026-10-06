import type { Pregunta, Respuesta, Uid } from '@hts/engine';
import { useState } from 'react';
import { conSigno, t } from '../../i18n';
import { Boton } from '../../ui/Boton';
import { Carta } from '../../ui/Carta';
import { Modal } from '../../ui/Modal';
import { clave, useMesa } from './contexto';

/** Selección de entre `min` y `max` cartas (con orden si `ordenado`). */
function ElegirCartas({
  opciones,
  min,
  max,
  ordenado,
  onConfirmar,
}: {
  opciones: Uid[];
  min: number;
  max: number;
  ordenado: boolean;
  onConfirmar: (uids: Uid[]) => void;
}) {
  const m = useMesa();
  const [elegidas, setElegidas] = useState<Uid[]>([]);
  const alternar = (uid: Uid): void => {
    if (elegidas.includes(uid)) setElegidas(elegidas.filter((u) => u !== uid));
    else if (max === 1) setElegidas([uid]);
    else if (elegidas.length < max) setElegidas([...elegidas, uid]);
  };
  const valida = elegidas.length >= min && elegidas.length <= max;
  return (
    <div>
      {ordenado && <p className="mb-2 text-sm">{t('decision.ordenar')}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {opciones.map((uid) => {
          const i = elegidas.indexOf(uid);
          return (
            <Carta
              key={uid}
              uid={uid}
              cartaId={m.idDe(uid)}
              tamano="md"
              seleccionada={i >= 0}
              {...(ordenado && i >= 0 ? { orden: i + 1 } : {})}
              onClick={() => alternar(uid)}
              onDoubleClick={() => m.detalleDe(uid)}
              titulo={t('mesa.acciones.dobleClic')}
              onZoom={m.ampliar}
            />
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-sm text-stone-600 dark:text-stone-400">
          {min === max
            ? t('decision.seleccionExacta', { n: elegidas.length, max })
            : t('decision.seleccion', { n: elegidas.length, min, max })}
        </span>
        <Boton
          variante="primario"
          disabled={!valida}
          data-confirmar
          onClick={() => onConfirmar(elegidas)}
        >
          {t('decision.aceptar')}
        </Boton>
      </div>
    </div>
  );
}

function CuerpoPregunta({
  pregunta,
  responder,
}: {
  pregunta: Pregunta;
  responder: (r: Respuesta) => void;
}) {
  const m = useMesa();
  switch (pregunta.tipo) {
    case 'jugador':
      return (
        <div className="flex flex-wrap gap-2">
          {pregunta.opciones.map((id) => (
            <Boton
              key={id}
              data-respuesta={clave({ jugador: id })}
              onClick={() => responder({ jugador: id })}
            >
              {m.nombreJugador(id)}
            </Boton>
          ))}
        </div>
      );
    case 'cartas':
      return (
        <ElegirCartas
          opciones={pregunta.opciones}
          min={pregunta.min}
          max={pregunta.max}
          ordenado={pregunta.ordenado}
          onConfirmar={(cartas) => responder({ cartas })}
        />
      );
    case 'oculta':
      return (
        <div>
          <p className="mb-2 text-sm">{t('decision.elegirReverso')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: pregunta.cartas }, (_, i) => (
              <Carta
                key={i}
                cartaId={null}
                indice={i}
                tamano="md"
                onClick={() => responder({ indice: i })}
              />
            ))}
          </div>
        </div>
      );
    case 'confirmar':
      return (
        <div className="flex gap-2">
          <Boton
            variante="primario"
            data-respuesta={clave({ si: true })}
            onClick={() => responder({ si: true })}
          >
            {t('comun.si')}
          </Boton>
          <Boton data-respuesta={clave({ si: false })} onClick={() => responder({ si: false })}>
            {t('comun.no')}
          </Boton>
        </div>
      );
    case 'valor':
      return (
        <div className="flex gap-2">
          {pregunta.opciones.map((v) => (
            <Boton
              key={v}
              variante="primario"
              data-respuesta={clave({ valor: v })}
              onClick={() => responder({ valor: v })}
            >
              {conSigno(v)}
            </Boton>
          ))}
        </div>
      );
    case 'ver':
      return (
        <div>
          {pregunta.de !== null && (
            <p className="mb-2 text-sm">
              {t('decision.verMano', { nombre: m.nombreJugador(pregunta.de) })}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {pregunta.cartas.map((uid) => (
              <Carta
                key={uid}
                cartaId={m.idDe(uid)}
                tamano="md"
                onZoom={m.ampliar}
                onClick={() => m.detalleDe(uid)}
              />
            ))}
          </div>
          <div className="mt-4 text-right">
            <Boton
              variante="primario"
              data-respuesta={clave({ ok: true })}
              onClick={() => responder({ ok: true })}
            >
              {t('comun.aceptar')}
            </Boton>
          </div>
        </div>
      );
  }
}

/**
 * Diálogo para lo que el jugador que mira debe decidir: preguntas de efectos, penalizaciones de
 * Monstruo y la tirada inmediata al jugar un Héroe.
 */
export function DialogoDecision() {
  const m = useMesa();
  const cima = m.vista.pila[m.vista.pila.length - 1];
  if (cima === undefined || !('jugador' in cima) || cima.jugador !== m.yo) return null;
  // Mientras se enseña un resultado nadie actúa: la pregunta aparece al terminar la pausa.
  if (m.director.pausaResultado !== null || m.director.presentacionLider !== null) return null;

  if (cima.tipo === 'tiradaInmediata') {
    return (
      <Modal abierto titulo={m.nombreCarta(m.idDe(cima.heroe) ?? '')}>
        <p>{t('decision.tiradaInmediata', { carta: m.nombreCarta(m.idDe(cima.heroe) ?? '') })}</p>
        <div className="mt-4 flex gap-2">
          <Boton
            variante="primario"
            data-accion={clave({ tipo: 'TIRADA_INMEDIATA', tirar: true })}
            onClick={() => m.enviar({ tipo: 'TIRADA_INMEDIATA', tirar: true })}
          >
            {t('decision.tirar')}
          </Boton>
          <Boton
            data-accion={clave({ tipo: 'TIRADA_INMEDIATA', tirar: false })}
            onClick={() => m.enviar({ tipo: 'TIRADA_INMEDIATA', tirar: false })}
          >
            {t('decision.noTirar')}
          </Boton>
        </div>
      </Modal>
    );
  }

  if (cima.tipo === 'elegir') {
    const yo = m.vista.jugadores.find((j) => j.id === m.yo);
    const opciones =
      cima.accion === 'descartar' ? (yo?.mano ?? []) : (yo?.grupo.map((r) => r.heroe) ?? []);
    return (
      <Modal
        abierto
        titulo={t(
          cima.accion === 'descartar' ? 'decision.elegirDescartar' : 'decision.elegirSacrificar',
          { n: cima.cantidad },
        )}
        ancho="lg"
      >
        <ElegirCartas
          opciones={opciones}
          min={cima.cantidad}
          max={cima.cantidad}
          ordenado={false}
          onConfirmar={(uids) => m.enviar({ tipo: 'ELEGIR', uids })}
        />
      </Modal>
    );
  }

  if (cima.tipo === 'decision' && cima.pregunta !== null) {
    return (
      <Modal
        abierto
        titulo={t(`decision.motivos.${cima.motivo}`, { carta: m.nombreCarta(cima.carta) })}
        ancho="lg"
      >
        <CuerpoPregunta
          key={`${cima.efecto}:${cima.motivo}:${JSON.stringify(cima.pregunta)}`}
          pregunta={cima.pregunta}
          responder={(respuesta) => m.enviar({ tipo: 'RESPONDER', respuesta })}
        />
      </Modal>
    );
  }
  return null;
}
