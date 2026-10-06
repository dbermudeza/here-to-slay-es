/**
 * Jerarquía de capas de la interfaz, de abajo arriba. Son literales completos para que Tailwind
 * los detecte. Cualquier elemento superpuesto a la mesa debe usar una de estas capas.
 *
 * 1. vuelos      animación de cartas (robar, jugar…): la más baja
 * 2. escenario   escenario central: intento de jugar una carta, desafío, dados y Modificadores
 *                (interactivo; oscurece la mesa y sustituye al antiguo recuadro de la esquina)
 * 3. rotulo      rótulo de inicio de turno (en grande, o pequeño arriba si hay escenario)
 * 4. modal       ficha de carta, decisiones, traspaso, victoria y demás diálogos
 * 5. celebracion Monstruo derrotado (bloquea la mesa unos segundos)
 * 6. aviso       aviso crítico (reconexión)
 */
export const CAPA = {
  vuelos: 'z-10',
  escenario: 'z-30',
  rotulo: 'z-40',
  modal: 'z-50',
  celebracion: 'z-[55]',
  aviso: 'z-[60]',
} as const;
