import { ArchivoCartasSchema, type Carta } from '@hts/cards';
import { crearMotor, type Motor } from '@hts/engine';

export type Catalogo =
  | { ok: true; cartas: Carta[]; motor: Motor }
  | { ok: false; motivo: 'falta' | 'invalido'; detalle: string };

/** Valida el contenido crudo de cartas.es.json y crea el motor. */
export function prepararCatalogo(crudo: unknown): Catalogo {
  if (crudo === null || crudo === undefined) {
    return { ok: false, motivo: 'falta', detalle: 'Referencias/cartas.es.json' };
  }
  const r = ArchivoCartasSchema.safeParse(crudo);
  if (!r.success) {
    const primero = r.error.issues[0];
    return {
      ok: false,
      motivo: 'invalido',
      detalle: primero === undefined ? '' : `${primero.path.join('.')}: ${primero.message}`,
    };
  }
  return { ok: true, cartas: r.data.cartas, motor: crearMotor(r.data.cartas) };
}
