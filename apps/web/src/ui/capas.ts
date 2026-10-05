/**
 * Jerarquía de capas de la interfaz, de abajo arriba. Son literales completos para que Tailwind
 * los detecte. Cualquier elemento superpuesto a la mesa debe usar una de estas capas.
 *
 * 1. vuelos           animación de cartas (robar, jugar…): la más baja
 * 2. dados            resultado de tiradas
 * 3. ventanaRespuesta desafío / Modificadores (interactiva)
 * 4. rotulo           rótulo de inicio de turno
 * 5. modal            ficha de carta, decisiones, traspaso, victoria y demás diálogos
 * 6. celebracion      Monstruo derrotado (bloquea la mesa unos segundos)
 * 7. aviso            aviso crítico (reconexión)
 */
export const CAPA = {
  vuelos: 'z-10',
  dados: 'z-20',
  ventanaRespuesta: 'z-30',
  rotulo: 'z-40',
  modal: 'z-50',
  celebracion: 'z-[55]',
  aviso: 'z-[60]',
} as const;
