import { describe, expect, it } from 'vitest';
import { CAPA } from '../src/ui/capas';

const nivel = (clase: string): number => Number(/z-\[?(\d+)\]?/.exec(clase)?.[1]);

describe('jerarquía de capas', () => {
  it('va de la animación de cartas al aviso crítico', () => {
    const orden = [
      CAPA.vuelos,
      CAPA.dados,
      CAPA.ventanaRespuesta,
      CAPA.rotulo,
      CAPA.modal,
      CAPA.aviso,
    ].map(nivel);
    expect(orden.every(Number.isInteger)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    expect(new Set(orden).size).toBe(orden.length);
  });
});
