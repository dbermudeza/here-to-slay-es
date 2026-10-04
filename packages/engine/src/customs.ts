/**
 * customEffects: pasos del DSL implementados en TypeScript para cartas que no encajan en los pasos
 * genéricos. Se referencian desde efectos.json con `{ "paso": "custom", "nombre": … }`.
 */
import { idCarta, jugador } from './consultas';
import type { EntornoPaso, ManejadorCustom, RegistroCustom, ResultadoPaso } from './efectos';
import { quitar, reponerMazo } from './ops';
import type { Pendiente, Valor } from './tipos';

const comoLista = (v: Valor): string[] => (Array.isArray(v) ? v : []);

function preguntarCartas(
  e: EntornoPaso,
  motivo: 'elegirDelMazo' | 'ordenarMazo',
  opciones: string[],
  ordenado: boolean,
): ResultadoPaso {
  const n = ordenado ? opciones.length : 1;
  e.d.pila.push({
    tipo: 'decision',
    jugador: e.f.jugador,
    efecto: e.f.id,
    carta: e.f.carta,
    motivo,
    pregunta: { tipo: 'cartas', opciones, min: n, max: n, ordenado },
  });
  e.emitir({ tipo: 'esperandoDecision', jugador: e.f.jugador, carta: e.f.carta, motivo });
  return 'esperar';
}

/**
 * Bullseye: mira las 3 cartas superiores del mazo, añade una a tu mano y devuelve las otras dos
 * a la parte superior del mazo en el orden que quieras.
 */
const bullseye: ManejadorCustom = (e) => {
  const { d, f, emitir } = e;
  const yo = jugador(d, f.jugador);
  if (f.sub === 0) {
    reponerMazo(d, emitir);
    const superiores = d.mazo.slice(0, 3);
    if (superiores.length === 0) return 'siguiente';
    emitir({ tipo: 'mazoMirado', jugador: yo.id, cartas: superiores.length });
    f.cola = superiores;
    f.sub = 1;
    return preguntarCartas(e, 'elegirDelMazo', superiores, false);
  }
  if (f.sub === 1) {
    const [elegida] = comoLista(f.respuesta);
    f.respuesta = null;
    if (elegida !== undefined && quitar(d.mazo, elegida)) {
      yo.mano.push(elegida);
      emitir({ tipo: 'cartaRobada', jugador: yo.id, uid: elegida, carta: idCarta(d, elegida) });
    }
    const resto = f.cola.filter((u) => u !== elegida);
    if (resto.length < 2) return 'siguiente';
    f.cola = resto;
    f.sub = 2;
    return preguntarCartas(e, 'ordenarMazo', resto, true);
  }
  const orden = comoLista(f.respuesta);
  f.respuesta = null;
  for (const u of orden) quitar(d.mazo, u);
  d.mazo.unshift(...orden);
  emitir({ tipo: 'mazoReordenado', jugador: yo.id, cartas: orden.length });
  return 'siguiente';
};

/** El Cuerno Protector: cada vez que juegas un Modificador sobre una tirada, +1 o −1 a esa tirada. */
const cuernoProtector: ManejadorCustom = (e) => {
  const { d, f, emitir } = e;
  if (f.sub === 0) {
    f.sub = 1;
    d.pila.push({
      tipo: 'decision',
      jugador: f.jugador,
      efecto: f.id,
      carta: f.carta,
      motivo: 'bonoCuerno',
      pregunta: { tipo: 'valor', opciones: [1, -1] },
    });
    emitir({ tipo: 'esperandoDecision', jugador: f.jugador, carta: f.carta, motivo: 'bonoCuerno' });
    return 'esperar';
  }
  const valor = typeof f.respuesta === 'number' ? f.respuesta : 0;
  f.respuesta = null;
  const ventana = [...d.pila]
    .reverse()
    .find(
      (p): p is Extract<Pendiente, { tipo: 'ventanaModificadores' }> =>
        p.tipo === 'ventanaModificadores',
    );
  const indice = f.vars.tirada;
  const tirada = typeof indice === 'number' ? ventana?.tiradas[indice] : undefined;
  if (tirada !== undefined && valor !== 0) {
    tirada.modificaciones.push({ jugador: f.jugador, uid: null, carta: f.carta, valor });
    emitir({
      tipo: 'modificadorJugado',
      jugador: f.jugador,
      carta: f.carta,
      valor,
      sobre: tirada.jugador,
    });
  }
  return 'siguiente';
};

export const CUSTOM_POR_DEFECTO: RegistroCustom = { bullseye, cuernoProtector };
