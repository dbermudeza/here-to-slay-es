/** Desplazamiento desde el centro de la pantalla hasta el centro de una zona de la mesa (`data-zona`). */
export function desplazamiento(zona: string): { x: number; y: number } {
  const el = document.querySelector<HTMLElement>(`[data-zona="${zona}"]`);
  const r = el?.getBoundingClientRect();
  if (r === undefined || (r.width === 0 && r.height === 0)) return { x: 0, y: 0 };
  return {
    x: r.left + r.width / 2 - window.innerWidth / 2,
    y: r.top + r.height / 2 - window.innerHeight / 2,
  };
}
