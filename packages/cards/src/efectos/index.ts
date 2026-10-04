import crudas from './efectos.json';
import { DefinicionesEfectosSchema, type DefinicionesEfectos } from './esquema';

export * from './esquema';

/** Definiciones de efectos de todas las cartas del juego base, validadas al importar. */
export const DEFINICIONES_EFECTOS: DefinicionesEfectos = DefinicionesEfectosSchema.parse(crudas);
