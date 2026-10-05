import type { RangoTirada } from '@hts/cards';

/** Rango de una tirada en texto: "8+" (mínimo) o "5−" (máximo). */
export const rango = (r: RangoTirada): string => (r.tipo === 'min' ? `${r.valor}+` : `${r.valor}−`);
