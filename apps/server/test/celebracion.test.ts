import { MENSAJES } from '@hts/anfitrion';
import type { Motor } from '@hts/engine';
import { afterEach, describe, expect, it } from 'vitest';
import {
  escenario,
  forzarDados,
  nuevoMotor,
  ponerHeroe,
} from '../../../packages/engine/test/fixtures';
import { arrancar, esperar, parar, pedir, salaCon, type Entorno } from './utilidades';

const base = nuevoMotor();

/** Motor cuya partida arranca en el turno de j1, con dados preparados para matar al Monstruo "h". */
const motor: Motor = {
  ...base,
  crearPartida: (config) => {
    const r = base.crearPartida(config);
    const s = escenario(r.state, { turnoDe: 'j1', lideres: { j1: 'bardo' }, centro: ['h', 'hh'] });
    ponerHeroe(s, 'j1', 'bardo');
    return { ...r, state: forzarDados(s, 4, 4) };
  },
};

let e: Entorno | null = null;
afterEach(async () => {
  if (e !== null) await parar(e);
  e = null;
});

describe('Celebración al matar un Monstruo (en línea)', () => {
  it('todos los clientes la reciben, las acciones se rechazan y al terminar el juego sigue', async () => {
    e = await arrancar(motor, { celebracionMs: 4000 });
    const [ana, beto] = await salaCon(e, ['Ana', 'Beto']);
    if (ana === undefined || beto === undefined) throw new Error('sin clientes');
    await pedir(ana, MENSAJES.empezar);
    await esperar(() => ana.partida !== null && beto.partida !== null);
    expect(ana.partida?.celebracion).toBeNull();

    const monstruo = ana.partida?.vista.monstruosCentro.find(
      (uid) => ana.partida?.vista.cartas[uid] === 'monstruo_h',
    );
    if (monstruo === undefined) throw new Error('Falta el Monstruo h');
    expect(
      await pedir(ana, MENSAJES.accion, { accion: { tipo: 'ATACAR', uid: monstruo } }),
    ).toEqual({ ok: true });

    // Se deja vencer la ventana de Modificadores hasta que muera el Monstruo.
    for (let i = 0; i < 200 && ana.partida?.celebracion == null; i++) {
      e.reloj.avanzar(100);
      await new Promise((r) => setTimeout(r, 5));
    }
    await esperar(() => ana.partida?.celebracion != null && beto.partida?.celebracion != null);
    for (const c of [ana, beto]) {
      expect(c.partida?.celebracion).toMatchObject({ jugador: 'j1', carta: 'monstruo_h' });
      expect(c.partida?.legales).toEqual([]);
    }

    // Durante la celebración, ninguna acción se admite.
    expect(await pedir(ana, MENSAJES.accion, { accion: { tipo: 'ROBAR' } })).toEqual({
      ok: false,
      error: 'CELEBRACION',
    });
    expect(await pedir(beto, MENSAJES.accion, { accion: { tipo: 'ROBAR' } })).toEqual({
      ok: false,
      error: 'CELEBRACION',
    });

    // Al terminar, todos reciben celebracion: null y j1 puede seguir jugando.
    e.reloj.avanzar(4000);
    await esperar(() => ana.partida?.celebracion === null && beto.partida?.celebracion === null);
    expect(ana.partida?.legales).toContainEqual({ tipo: 'ROBAR' });
    expect(await pedir(ana, MENSAJES.accion, { accion: { tipo: 'ROBAR' } })).toEqual({ ok: true });
  });
});
