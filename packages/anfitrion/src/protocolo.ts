/**
 * Protocolo de red (Socket.IO) entre el servidor y los clientes de una partida en línea.
 * Cada mensaje que llega de un cliente se valida con estos esquemas antes de usarse.
 */
import type { Accion, Evento, JugadorId, Modo, Respuesta, VistaJugador } from '@hts/engine';
import { z } from 'zod';
import type { Control, JugadorConfig, Segundos } from './config';
import type { EstadoConexion } from './anfitrion';
import type { MotivoAccion } from './motivos';

// ------------------------------------------------------------------ nombres de los mensajes

export const MENSAJES = {
  crear: 'sala:crear',
  unirse: 'sala:unirse',
  reanudar: 'sala:reanudar',
  listo: 'sala:listo',
  opciones: 'sala:opciones',
  anadirBot: 'sala:anadirBot',
  quitar: 'sala:quitar',
  empezar: 'sala:empezar',
  volverALaSala: 'sala:volver',
  salir: 'sala:salir',
  accion: 'partida:accion',
  /** Túnel de Cloudflare: solo desde el equipo del servidor. */
  abrirTunel: 'tunel:abrir',
  cerrarTunel: 'tunel:cerrar',
  /** servidor → cliente */
  estadoSala: 'sala:estado',
  estadoPartida: 'partida:estado',
  infoServidor: 'servidor:info',
  estadoTunel: 'tunel:estado',
} as const;

// ------------------------------------------------------------------ esquemas (cliente → servidor)

const Texto = (max: number) => z.string().trim().min(1).max(max);
const Uid = z.string().min(1).max(80);
const Id = z.string().min(1).max(40);

export const NombreSchema = Texto(20);
export const CodigoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{5}$/, 'Código de sala inválido');
export const TokenSchema = z.string().regex(/^[a-f0-9]{32}$/);

export const SegundosSchema = z.object({
  desafio: z.number().int().min(1).max(60),
  modificadores: z.number().int().min(1).max(60),
  modificadoresDesafio: z.number().int().min(1).max(60),
});

export const OpcionesSalaSchema = z.object({
  reglas: z.enum(['normal', 'dificil']),
  segundos: SegundosSchema,
  /** Límite por decisión en segundos; null = sin límite. */
  limiteDecisionS: z.number().int().min(10).max(600).nullable(),
});
export type OpcionesSala = z.infer<typeof OpcionesSalaSchema>;

export const RespuestaSchema = z.union([
  z.object({ jugador: Id }).strict(),
  z.object({ cartas: z.array(Uid).max(20) }).strict(),
  z.object({ indice: z.number().int().min(0).max(200) }).strict(),
  z.object({ si: z.boolean() }).strict(),
  z.object({ valor: z.number().int().min(-10).max(10) }).strict(),
  z.object({ ok: z.literal(true) }).strict(),
]);

/** Acciones que puede enviar un jugador (CERRAR_VENTANA es exclusiva del anfitrión). */
export const AccionSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('ROBAR') }).strict(),
  z.object({ tipo: z.literal('JUGAR_CARTA'), uid: Uid, objetivo: Uid.optional() }).strict(),
  z.object({ tipo: z.literal('TIRAR_HEROE'), uid: Uid }).strict(),
  z.object({ tipo: z.literal('ATACAR'), uid: Uid }).strict(),
  z.object({ tipo: z.literal('RENOVAR_MANO') }).strict(),
  z.object({ tipo: z.literal('FIN_TURNO') }).strict(),
  z.object({ tipo: z.literal('USAR_HABILIDAD'), uid: Uid }).strict(),
  z.object({ tipo: z.literal('DESAFIAR'), uid: Uid }).strict(),
  z.object({ tipo: z.literal('PASAR') }).strict(),
  z
    .object({
      tipo: z.literal('JUGAR_MODIFICADOR'),
      uid: Uid,
      valor: z.number().int().min(-10).max(10),
      tirada: z.number().int().min(0).max(5),
    })
    .strict(),
  z.object({ tipo: z.literal('TIRADA_INMEDIATA'), tirar: z.boolean() }).strict(),
  z.object({ tipo: z.literal('ELEGIR'), uids: z.array(Uid).max(20) }).strict(),
  z.object({ tipo: z.literal('RESPONDER'), respuesta: RespuestaSchema }).strict(),
  z.object({ tipo: z.literal('RENDIRSE') }).strict(),
]);

/** Valida una acción recibida por red y la convierte al tipo del motor. */
export function leerAccion(crudo: unknown): Accion | null {
  const r = AccionSchema.safeParse(crudo);
  if (!r.success) return null;
  const a = r.data;
  if (a.tipo === 'JUGAR_CARTA') {
    return a.objetivo === undefined
      ? { tipo: a.tipo, uid: a.uid }
      : { tipo: a.tipo, uid: a.uid, objetivo: a.objetivo };
  }
  if (a.tipo === 'RESPONDER') return { tipo: a.tipo, respuesta: a.respuesta as Respuesta };
  return a;
}

export const PeticionCrearSchema = z.object({ nombre: NombreSchema }).strict();
export const PeticionUnirseSchema = z
  .object({ codigo: CodigoSchema, nombre: NombreSchema })
  .strict();
export const PeticionReanudarSchema = z
  .object({ codigo: CodigoSchema, token: TokenSchema })
  .strict();
export const PeticionListoSchema = z.object({ listo: z.boolean() }).strict();
export const PeticionAnadirBotSchema = z.object({ nivel: z.enum(['facil', 'normal']) }).strict();
export const PeticionQuitarSchema = z.object({ jugador: Id }).strict();
export const PeticionAccionSchema = z.object({ accion: z.unknown() }).strict();

// ------------------------------------------------------------------ respuestas y estados (servidor → cliente)

export type ErrorSala =
  | 'DATOS_INVALIDOS'
  | 'SALA_NO_EXISTE'
  | 'SALA_LLENA'
  | 'PARTIDA_EMPEZADA'
  | 'NOMBRE_REPETIDO'
  | 'SESION_INVALIDA'
  | 'SOLO_CREADOR'
  | 'NO_ESTAN_LISTOS'
  | 'POCOS_JUGADORES'
  | 'SIN_SALA'
  | 'SIN_PARTIDA'
  | 'SOLO_EQUIPO_SERVIDOR';

/** Estado del túnel de Cloudflare para jugar por internet. */
export interface EstadoTunel {
  fase: 'apagado' | 'conectando' | 'activo' | 'error';
  /** Dirección pública (https://….trycloudflare.com) cuando está activo. */
  url: string | null;
  error: 'NO_INSTALADO' | 'FALLO' | 'TIEMPO' | null;
}

/** Lo que el servidor cuenta a cada conexión al conectarse. */
export interface InfoServidor {
  /** La conexión viene del propio equipo del servidor (no de la red ni del túnel). */
  esEquipoServidor: boolean;
  /** Dirección en la red local (http://ip:puerto); solo para el equipo del servidor. */
  redLocal: string | null;
}

export type Ack<T> = ({ ok: true } & T) | { ok: false; error: ErrorSala | string };

export interface Sesion {
  codigo: string;
  jugador: JugadorId;
  token: string;
}

export interface AsientoPublico {
  id: JugadorId;
  nombre: string;
  control: Control;
  listo: boolean;
  conectado: boolean;
}

export interface EstadoSala {
  codigo: string;
  creador: JugadorId;
  fase: 'lobby' | 'partida' | 'terminada';
  asientos: AsientoPublico[];
  opciones: OpcionesSala;
}

/** Lo que recibe cada jugador tras cada cambio de la partida (solo su información). */
export interface EstadoPartida {
  yo: JugadorId;
  modo: Modo;
  jugadores: JugadorConfig[];
  vista: VistaJugador;
  legales: Accion[];
  motivos: MotivoAccion[];
  /** Eventos (ya filtrados para este jugador) a partir de `desde`. */
  eventos: Evento[];
  desde: number;
  /** true si `eventos` sustituye al historial completo (al conectar o reconectar). */
  reinicio: boolean;
  plazo: { secuencia: number; duracionMs: number; restanteMs: number | null } | null;
  decision: { jugador: JugadorId; restanteMs: number } | null;
  /** Monstruo derrotado que se está celebrando (nadie puede jugar mientras dure), o null. */
  celebracion: {
    id: number;
    jugador: JugadorId;
    carta: string;
    /** Duración configurada en el anfitrión (no la nominal). */
    duracionMs: number;
    restanteMs: number;
  } | null;
  /**
   * Pausa tras un resultado (nadie puede jugar mientras dure), o null. El `id` se conserva si la
   * pausa se alarga por otro resultado; `duracionMs` es la configurada en el anfitrión.
   */
  pausaResultado: { id: number; duracionMs: number; restanteMs: number } | null;
  /**
   * Activación de la habilidad de un Líder que se está presentando (la primera de cada Líder en
   * cada turno; nadie puede jugar mientras dure), o null. `duracionMs` es la configurada.
   */
  presentacionLider: {
    id: number;
    jugador: JugadorId;
    carta: string;
    duracionMs: number;
    restanteMs: number;
  } | null;
  conexiones: Record<JugadorId, EstadoConexion>;
}

export type { Segundos };
