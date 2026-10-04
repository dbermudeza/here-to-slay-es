import type { DefinicionesEfectos } from '@hts/cards';
import type { Catalogo, Emitir, GameState, MarcoEfecto } from './tipos';

/** Entorno con el que se ejecuta un paso de efecto sobre el borrador del estado. */
export interface EntornoPaso {
  ctx: Ctx;
  d: GameState;
  f: MarcoEfecto;
  emitir: Emitir;
}

/**
 * - siguiente: el paso ha terminado.
 * - esperar: el paso ha apilado una pregunta o una ventana y continuará cuando se resuelva.
 */
export type ResultadoPaso = 'siguiente' | 'esperar';

/**
 * Paso implementado en TypeScript (`{ "paso": "custom", "nombre": … }`) para efectos que no
 * encajan en el DSL. Puede usar `f.sub`, `f.i`, `f.cola` y `f.respuesta` para pausarse y reanudarse.
 */
export type ManejadorCustom = (entorno: EntornoPaso) => ResultadoPaso;
export type RegistroCustom = Readonly<Record<string, ManejadorCustom>>;

export interface Ctx {
  catalogo: Catalogo;
  definiciones: DefinicionesEfectos;
  custom: RegistroCustom;
}
