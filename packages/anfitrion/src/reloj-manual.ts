import type { Reloj } from './anfitrion';

/** Reloj controlable (tests y simulaciones): el tiempo solo avanza con `avanzar`. */
export class RelojManual implements Reloj {
  t = 0;
  private siguienteId = 1;
  private tareas: { id: number; en: number; fn: () => void }[] = [];

  ahora = (): number => this.t;

  programar = (fn: () => void, ms: number): number => {
    const id = this.siguienteId++;
    this.tareas.push({ id, en: this.t + ms, fn });
    return id;
  };

  cancelar = (id: unknown): void => {
    this.tareas = this.tareas.filter((x) => x.id !== id);
  };

  /** Avanza el tiempo ejecutando, en orden, las tareas que vencen. */
  avanzar(ms: number): void {
    const fin = this.t + ms;
    for (;;) {
      const proxima = [...this.tareas].sort((a, b) => a.en - b.en)[0];
      if (proxima === undefined || proxima.en > fin) break;
      this.tareas = this.tareas.filter((x) => x !== proxima);
      this.t = proxima.en;
      proxima.fn();
    }
    this.t = fin;
  }

  get pendientes(): number {
    return this.tareas.length;
  }
}
