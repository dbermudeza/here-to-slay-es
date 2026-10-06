/**
 * Auditoría de la interfaz (informe de QA): preguntas "ver"/"cartas"/"jugador" y los PA con la
 * Megababosa. Usan el catálogo real (se saltan sin Referencias/).
 */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  A,
  activar,
  B,
  C,
  CARTAS,
  HAY_CATALOGO,
  mano,
  mesa,
  monstruo,
  motor,
  responder,
} from '../../../packages/engine/test/cartas/reales';
import { ProveedorCatalogo } from '../src/estado/contexto';
import { DirectorVivo } from '../src/juego/director-vivo';
import { Mesa } from '../src/pantallas/mesa/Mesa';
import { config, RelojFalso } from './utilidades';

afterEach(cleanup);

/** Configuración con los ids de los jugadores del catálogo real (ana, beto, cata). */
const cfg = () => ({
  ...config('local', ['humano', 'humano', 'humano']),
  jugadores: [A, B, C].map((id) => ({ id, nombre: id.toUpperCase(), control: 'humano' as const })),
});

function montar(estado: ReturnType<typeof mesa>) {
  const reloj = new RelojFalso();
  const director = new DirectorVivo(motor, cfg(), estado, reloj, {
    retardoBotMs: 100,
    celebracionMs: 0,
    presentacionLiderMs: 0,
  });
  const ui = render(
    <ProveedorCatalogo motor={motor} cartas={CARTAS}>
      <Mesa
        director={director}
        onSalir={() => undefined}
        onRevancha={() => undefined}
        onTutorial={() => undefined}
      />
    </ProveedorCatalogo>,
  );
  return { director, reloj, ...ui };
}

const nombre = (id: string): string => CARTAS.find((c) => c.id === id)?.nombre ?? id;

describe.skipIf(!HAY_CATALOGO)('Interfaz: preguntas que enseñan cartas ajenas', () => {
  it('Sharp Fox: el jugador ve las cartas de la mano del rival en el diálogo', () => {
    const s = mesa();
    mano(s, B, 'desafio', 'modificador_mas4');
    mano(s, C, 'desafio');
    const base = activar(s, 'heroe_sharp_fox');
    const r = responder(base, A, { jugador: B });
    montar(r.state);
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByLabelText(nombre('desafio'))).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(nombre('modificador_mas4'))).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
  });

  it('Silent Shadow (2 cartas): el diálogo muestra las cartas del rival boca arriba para elegir', () => {
    const s = mesa();
    mano(s, B, 'desafio', 'modificador_mas4');
    const r = activar(s, 'heroe_silent_shadow');
    const { container } = montar(r.state);
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByLabelText(nombre('desafio'))).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(nombre('modificador_mas4'))).toBeInTheDocument();
    // Cartas elegibles (con data-uid) y botón de confirmar.
    expect(dialogo.querySelectorAll('[data-uid]').length).toBe(2);
    expect(container.querySelector('[data-confirmar]')).not.toBeNull();
  });

  it('Silent Shadow [FALLO 1]: con 1 sola carta en la mano rival el jugador debe ver un diálogo con ella', () => {
    const s = mesa();
    mano(s, B, 'desafio');
    const r = activar(s, 'heroe_silent_shadow');
    montar(r.state);
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByLabelText(nombre('desafio'))).toBeInTheDocument();
  });

  it('Bullseye: el diálogo enseña las 3 cartas superiores del mazo', () => {
    const s = mesa();
    const r = activar(s, 'heroe_bullseye');
    montar(r.state);
    const dialogo = screen.getByRole('dialog');
    expect(dialogo.querySelectorAll('[data-uid]').length).toBe(3);
  });
});

describe.skipIf(!HAY_CATALOGO)('Interfaz: Megababosa y los puntos de acción', () => {
  /** A tiene la Megababosa; se pasan los turnos de A, B y C hasta que A vuelve a jugar. */
  function turnoDeAConBabosa() {
    const s = mesa();
    monstruo(s, A, 'monstruo_megababosa');
    const { director, reloj, ...ui } = montar(s);
    for (const j of [A, B, C]) {
      act(() => {
        director.enviar(j, { tipo: 'FIN_TURNO' });
        director.confirmarTraspaso();
      });
    }
    return { director, reloj, ...ui };
  }

  /** Puntos de la cabecera (el contador lleva `data-pa` y un aria-label con los PA). */
  const contador = (c: HTMLElement): HTMLElement => {
    const el = c.querySelector<HTMLElement>('header [data-pa]');
    if (el === null) throw new Error('No hay contador de PA');
    return el;
  };
  const puntos = (c: HTMLElement) => contador(c).querySelectorAll('.rounded-full').length;

  it('con la Megababosa el turno empieza con 4 PA y la cabecera pinta 4 puntos llenos', () => {
    const { director, container } = turnoDeAConBabosa();
    expect(director.estado.turno).toMatchObject({ jugador: A, pa: 4 });
    expect(
      screen.getByLabelText(/^4 de 4 puntos de acción \(1 extra por .+\)$/),
    ).toBeInTheDocument();
    expect(puntos(container)).toBe(4);
    expect(contador(container).querySelectorAll('[data-extra]').length).toBe(1);
  });

  it('sin Megababosa la cabecera pinta 3 puntos', () => {
    const { container } = montar(mesa());
    expect(screen.getByLabelText('3 puntos de acción')).toBeInTheDocument();
    expect(puntos(container)).toBe(3);
  });

  it('Megababosa: tras gastar 1 PA siguen 4 puntos (3 llenos y 1 vacío) y el extra está marcado', () => {
    const { director, container } = turnoDeAConBabosa();
    act(() => {
      director.enviar(A, { tipo: 'ROBAR' });
    });
    expect(director.estado.turno.pa).toBe(3);
    expect(puntos(container)).toBe(4);
    const el = contador(container);
    const dots = [...el.querySelectorAll('.rounded-full')];
    expect(dots.filter((d) => /bg-(amber-500|sky-600)/.test(d.className)).length).toBe(3);
    const extra = el.querySelectorAll('[data-extra]');
    expect(extra.length).toBe(1);
    // El extra es el último punto y es el que se ha gastado (vacío).
    expect(dots[3]).toBe(extra[0]);
    expect(extra[0]?.className).toContain('bg-stone-300');
    expect(el.getAttribute('aria-label')).toMatch(/^3 de 4 puntos de acción \(1 extra por .+\)$/);
    expect(el.getAttribute('title')).toBe(el.getAttribute('aria-label'));
  });
});
