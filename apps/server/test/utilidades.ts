import {
  MENSAJES,
  RelojManual,
  type Ack,
  type EstadoPartida,
  type EstadoSala,
  type OpcionesAnfitrion,
} from '@hts/anfitrion';
import type { GameState, JugadorId, Motor } from '@hts/engine';
import { io, type Socket } from 'socket.io-client';
import { crearServidor, type ServidorHts } from '../src/servidor';

export interface Cliente {
  socket: Socket;
  sala: EstadoSala | null;
  partida: EstadoPartida | null;
  /** Todos los estados de partida recibidos. */
  recibidos: EstadoPartida[];
  version: number;
}

export interface Entorno {
  servidor: ServidorHts;
  reloj: RelojManual;
  puerto: number;
  clientes: Cliente[];
  enviados: { jugador: JugadorId; enviado: EstadoPartida; real: GameState }[];
}

export async function arrancar(motor: Motor, opciones: OpcionesAnfitrion = {}): Promise<Entorno> {
  const reloj = new RelojManual();
  const enviados: Entorno['enviados'] = [];
  const servidor = crearServidor({
    motor,
    reloj,
    opcionesAnfitrion: { retardoBotMs: 100, ...opciones },
    alEnviarPartida: (jugador, enviado, real) => enviados.push({ jugador, enviado, real }),
    limiteMensajesPorSegundo: 10_000,
  });
  const puerto = await servidor.escuchar(0, '127.0.0.1');
  return { servidor, reloj, puerto, clientes: [], enviados };
}

export async function parar(e: Entorno): Promise<void> {
  for (const c of e.clientes) c.socket.disconnect();
  await e.servidor.cerrar();
}

export function conectar(e: Entorno): Cliente {
  const socket = io(`http://127.0.0.1:${e.puerto}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  const c: Cliente = { socket, sala: null, partida: null, recibidos: [], version: 0 };
  socket.on(MENSAJES.estadoSala, (s: EstadoSala | null) => {
    c.sala = s;
  });
  socket.on(MENSAJES.estadoPartida, (p: EstadoPartida) => {
    c.partida = p;
    c.recibidos.push(p);
    c.version += 1;
  });
  e.clientes.push(c);
  return c;
}

export function pedir<T = object>(
  c: Cliente,
  mensaje: string,
  datos: unknown = {},
): Promise<Ack<T>> {
  return new Promise((resolver) => {
    c.socket.emit(mensaje, datos, (r: Ack<T>) => resolver(r));
  });
}

export const pausa = (ms = 5): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Espera (con tiempo real) a que se cumpla una condición. */
export async function esperar(condicion: () => boolean, maxMs = 3000): Promise<void> {
  const inicio = Date.now();
  while (!condicion()) {
    if (Date.now() - inicio > maxMs) throw new Error('Tiempo de espera agotado');
    await pausa(5);
  }
}

/** Crea una sala con `nombres[0]` y une al resto; todos quedan listos. */
export async function salaCon(e: Entorno, nombres: string[]): Promise<Cliente[]> {
  const [primero, ...resto] = nombres;
  const creador = conectar(e);
  const r = await pedir<{ codigo: string }>(creador, MENSAJES.crear, { nombre: primero });
  if (!r.ok) throw new Error(String(r.error));
  const codigo = r.codigo;
  const clientes = [creador];
  for (const nombre of resto) {
    const c = conectar(e);
    const u = await pedir(c, MENSAJES.unirse, { codigo, nombre });
    if (!u.ok) throw new Error(String(u.error));
    await pedir(c, MENSAJES.listo, { listo: true });
    clientes.push(c);
  }
  await esperar(() => creador.sala?.asientos.length === nombres.length);
  return clientes;
}
