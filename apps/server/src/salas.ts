/**
 * Salas de juego en línea (en memoria): asientos, lobby y estado público.
 */
import { randomBytes, randomInt } from 'node:crypto';
import type { Anfitrion, AsientoPublico, Control, EstadoSala, OpcionesSala } from '@hts/anfitrion';
import { SEGUNDOS_POR_DEFECTO } from '@hts/anfitrion';
import type { JugadorId } from '@hts/engine';

export const MAX_ASIENTOS = 6;
export const MIN_ASIENTOS = 2;
/** Sin letras ni números que se confundan (O/0, I/1…). */
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NOMBRES_BOTS = [
  'Bot Bigotes',
  'Bot Zarpas',
  'Bot Cascabel',
  'Bot Pelusa',
  'Bot Trufa',
  'Bot Ovillo',
];

export interface Asiento {
  id: JugadorId;
  nombre: string;
  control: Control;
  listo: boolean;
  /** Secreto para reanudar la sesión (null para los bots). */
  token: string | null;
  /** Conexiones abiertas de este jugador (puede tener varias pestañas). */
  sockets: Set<string>;
}

export const OPCIONES_SALA_POR_DEFECTO: OpcionesSala = {
  reglas: 'normal',
  segundos: SEGUNDOS_POR_DEFECTO,
  limiteDecisionS: null,
};

export function nuevoToken(): string {
  return randomBytes(16).toString('hex');
}

export class Sala {
  creador: JugadorId = '';
  fase: EstadoSala['fase'] = 'lobby';
  asientos: Asiento[] = [];
  opciones: OpcionesSala = { ...OPCIONES_SALA_POR_DEFECTO };
  anfitrion: Anfitrion | null = null;
  /** Instante desde el que no hay nadie conectado (para borrar salas abandonadas). */
  vaciaDesde: number | null = null;
  private contador = 0;

  constructor(readonly codigo: string) {}

  private nuevoId(): JugadorId {
    this.contador += 1;
    return `j${this.contador}`;
  }

  asiento(id: JugadorId): Asiento | undefined {
    return this.asientos.find((a) => a.id === id);
  }

  asientoDeToken(token: string): Asiento | undefined {
    return this.asientos.find((a) => a.token === token);
  }

  nombreLibre(nombre: string): boolean {
    return !this.asientos.some((a) => a.nombre.toLowerCase() === nombre.toLowerCase());
  }

  anadirHumano(nombre: string): Asiento {
    const asiento: Asiento = {
      id: this.nuevoId(),
      nombre,
      control: 'humano',
      listo: false,
      token: nuevoToken(),
      sockets: new Set(),
    };
    this.asientos.push(asiento);
    if (this.creador === '') this.creador = asiento.id;
    return asiento;
  }

  anadirBot(nivel: Exclude<Control, 'humano'>): Asiento {
    const nombre = NOMBRES_BOTS.find((n) => this.nombreLibre(n)) ?? `Bot ${this.contador + 1}`;
    const asiento: Asiento = {
      id: this.nuevoId(),
      nombre,
      control: nivel,
      listo: true,
      token: null,
      sockets: new Set(),
    };
    this.asientos.push(asiento);
    return asiento;
  }

  quitar(id: JugadorId): void {
    this.asientos = this.asientos.filter((a) => a.id !== id);
    if (this.creador === id) {
      this.creador = this.asientos.find((a) => a.control === 'humano')?.id ?? '';
    }
  }

  get humanos(): Asiento[] {
    return this.asientos.filter((a) => a.control === 'humano');
  }

  get conectados(): number {
    return this.asientos.reduce((n, a) => n + a.sockets.size, 0);
  }

  estadoPublico(): EstadoSala {
    return {
      codigo: this.codigo,
      creador: this.creador,
      fase: this.fase,
      opciones: this.opciones,
      asientos: this.asientos.map((a): AsientoPublico => ({
        id: a.id,
        nombre: a.nombre,
        control: a.control,
        listo: a.listo,
        conectado: a.control !== 'humano' || a.sockets.size > 0,
      })),
    };
  }
}

export class GestorSalas {
  private readonly salas = new Map<string, Sala>();

  get total(): number {
    return this.salas.size;
  }

  crear(): Sala {
    let codigo = '';
    do {
      codigo = Array.from(
        { length: 5 },
        () => ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)],
      ).join('');
    } while (this.salas.has(codigo));
    const sala = new Sala(codigo);
    this.salas.set(codigo, sala);
    return sala;
  }

  obtener(codigo: string): Sala | undefined {
    return this.salas.get(codigo);
  }

  borrar(codigo: string): void {
    this.salas.get(codigo)?.anfitrion?.destruir();
    this.salas.delete(codigo);
  }

  /** Borra las salas sin nadie conectado desde hace más de `inactividadMs`. */
  limpiar(ahora: number, inactividadMs: number): string[] {
    const borradas: string[] = [];
    for (const sala of this.salas.values()) {
      if (sala.conectados > 0) {
        sala.vaciaDesde = null;
        continue;
      }
      sala.vaciaDesde ??= ahora;
      if (ahora - sala.vaciaDesde >= inactividadMs) {
        this.borrar(sala.codigo);
        borradas.push(sala.codigo);
      }
    }
    return borradas;
  }

  /** Cierra todas las salas (al apagar el servidor). */
  cerrarTodas(): void {
    for (const codigo of [...this.salas.keys()]) this.borrar(codigo);
  }
}
