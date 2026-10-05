/**
 * Servidor autoritativo de partidas en línea: Fastify (sirve la aplicación web y las imágenes) +
 * Socket.IO (salas, lobby y partidas). Cada jugador envía intenciones y recibe solo su vista.
 */
import { existsSync } from 'node:fs';
import { sep } from 'node:path';
import fastifyCompress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import {
  Anfitrion,
  CodigoSchema,
  leerAccion,
  MENSAJES,
  OpcionesSalaSchema,
  PeticionAnadirBotSchema,
  PeticionCrearSchema,
  PeticionListoSchema,
  PeticionQuitarSchema,
  PeticionReanudarSchema,
  PeticionUnirseSchema,
  PeticionAccionSchema,
  RELOJ_REAL,
  semillaAleatoria,
  type Ack,
  type ConfigAnfitrion,
  type ErrorSala,
  type EstadoPartida,
  type OpcionesAnfitrion,
  type Reloj,
  type Sesion,
} from '@hts/anfitrion';
import { eventoParaJugador, type GameState, type JugadorId, type Motor } from '@hts/engine';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import { GestorSalas, MAX_ASIENTOS, MIN_ASIENTOS, type Sala } from './salas';

export interface OpcionesServidor {
  motor: Motor;
  /** Carpeta con la aplicación web compilada (apps/web/dist). null: no se sirve. */
  dirWeb?: string | null;
  reloj?: Reloj;
  opcionesAnfitrion?: OpcionesAnfitrion;
  /** Borrar salas sin nadie conectado tras este tiempo (por defecto, 30 min). */
  inactividadSalaMs?: number;
  /** Mensajes por segundo permitidos a cada conexión. */
  limiteMensajesPorSegundo?: number;
  /** Solo para tests: se llama con cada estado de partida enviado a un jugador. */
  alEnviarPartida?: (jugador: JugadorId, enviado: EstadoPartida, real: GameState) => void;
  /** Solo para tests: genera la semilla de cada partida (por defecto, aleatoria). */
  semilla?: () => string;
  registro?: boolean;
}

export interface ServidorHts {
  app: FastifyInstance;
  io: Server;
  salas: GestorSalas;
  escuchar: (puerto: number, host?: string) => Promise<number>;
  cerrar: () => Promise<void>;
}

/** Eventos del historial que se reenvían al (re)conectar. */
const HISTORIAL_AL_CONECTAR = 300;

interface DatosSocket {
  sesion?: { codigo: string; jugador: JugadorId } | undefined;
}

type Responder<T> = (r: Ack<T>) => void;

export function crearServidor(o: OpcionesServidor): ServidorHts {
  const reloj = o.reloj ?? RELOJ_REAL;
  const app = Fastify({ logger: o.registro ?? false });
  const io = new Server(app.server, { serveClient: false });
  const salas = new GestorSalas();
  /** Índice del siguiente evento que hay que enviar a cada conexión. */
  const indices = new Map<string, number>();
  const difusionPendiente = new Set<string>();

  if (o.dirWeb && existsSync(o.dirWeb)) {
    // Comprimido (gzip/brotli) y con caché: se nota especialmente a través de un túnel.
    void app.register(fastifyCompress);
    void app.register(fastifyStatic, {
      root: o.dirWeb,
      // Las cabeceras de caché las pone setHeaders.
      cacheControl: false,
      setHeaders: (res, ruta) => {
        const normal = ruta.split(sep).join('/');
        if (normal.includes('/assets/')) {
          // Nombres con hash: no cambian nunca.
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (normal.includes('/cartas/')) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    });
  }
  app.get('/api/estado', async () => ({ ok: true, salas: salas.total }));

  // ---------------------------------------------------------------- envío de estados

  const enviarSala = (sala: Sala): void => {
    io.to(`sala:${sala.codigo}`).emit(MENSAJES.estadoSala, sala.estadoPublico());
  };

  const enviarPartidaA = (
    sala: Sala,
    socket: Socket,
    jugador: JugadorId,
    reinicio: boolean,
  ): void => {
    const a = sala.anfitrion;
    if (a === null) return;
    const total = a.eventos.length;
    const desde = reinicio
      ? Math.max(0, total - HISTORIAL_AL_CONECTAR)
      : (indices.get(socket.id) ?? total);
    indices.set(socket.id, total);
    const estado: EstadoPartida = {
      yo: jugador,
      modo: a.config.reglas,
      jugadores: a.config.jugadores,
      vista: a.vistaDe(jugador),
      legales: a.legalesDe(jugador),
      motivos: a.motivosDe(jugador),
      eventos: a.eventos.slice(desde).map((e) => eventoParaJugador(e, jugador)),
      desde,
      reinicio,
      plazo:
        a.plazo === null
          ? null
          : {
              secuencia: a.plazo.secuencia,
              duracionMs: a.plazo.duracionMs,
              restanteMs: a.restanteMs(),
            },
      decision:
        a.plazoDecision === null
          ? null
          : { jugador: a.plazoDecision.jugador, restanteMs: a.restanteDecisionMs() ?? 0 },
      conexiones: Object.fromEntries(a.config.jugadores.map((j) => [j.id, a.conexion(j.id)])),
    };
    o.alEnviarPartida?.(jugador, estado, a.estado);
    socket.emit(MENSAJES.estadoPartida, estado);
  };

  const socketsDe = (id: string): Socket | undefined => io.sockets.sockets.get(id);

  /** Envía a cada jugador conectado su estado de la partida (agrupando cambios seguidos). */
  const difundirPartida = (sala: Sala): void => {
    if (difusionPendiente.has(sala.codigo)) return;
    difusionPendiente.add(sala.codigo);
    queueMicrotask(() => {
      difusionPendiente.delete(sala.codigo);
      if (sala.anfitrion === null) return;
      if (sala.anfitrion.estado.ganador !== null && sala.fase === 'partida') {
        sala.fase = 'terminada';
        enviarSala(sala);
      }
      for (const asiento of sala.asientos) {
        for (const id of asiento.sockets) {
          const s = socketsDe(id);
          if (s !== undefined) enviarPartidaA(sala, s, asiento.id, false);
        }
      }
    });
  };

  // ---------------------------------------------------------------- utilidades de sesión

  const unirSocket = (socket: Socket, sala: Sala, jugador: JugadorId): void => {
    const datos = socket.data as DatosSocket;
    if (datos.sesion !== undefined && datos.sesion.codigo !== sala.codigo) salir(socket);
    datos.sesion = { codigo: sala.codigo, jugador };
    const asiento = sala.asiento(jugador);
    const estabaDesconectado = asiento !== undefined && asiento.sockets.size === 0;
    asiento?.sockets.add(socket.id);
    void socket.join(`sala:${sala.codigo}`);
    if (estabaDesconectado && sala.anfitrion !== null) sala.anfitrion.reconectar(jugador);
    enviarSala(sala);
    if (sala.anfitrion !== null) enviarPartidaA(sala, socket, jugador, true);
  };

  /** Quita la conexión de su asiento. En el lobby, salir libera el asiento. */
  const soltarSocket = (socket: Socket, liberarAsiento: boolean): void => {
    const datos = socket.data as DatosSocket;
    const sesion = datos.sesion;
    if (sesion === undefined) return;
    datos.sesion = undefined;
    indices.delete(socket.id);
    void socket.leave(`sala:${sesion.codigo}`);
    const sala = salas.obtener(sesion.codigo);
    const asiento = sala?.asiento(sesion.jugador);
    if (sala === undefined || asiento === undefined) return;
    asiento.sockets.delete(socket.id);
    if (asiento.sockets.size > 0) return;
    if (sala.fase === 'lobby' && liberarAsiento) {
      sala.quitar(asiento.id);
      if (sala.humanos.length === 0) {
        salas.borrar(sala.codigo);
        return;
      }
    } else if (sala.anfitrion !== null) {
      sala.anfitrion.desconectar(asiento.id);
    }
    enviarSala(sala);
  };

  const salir = (socket: Socket): void => soltarSocket(socket, true);

  const salaDe = (socket: Socket): { sala: Sala; jugador: JugadorId } | null => {
    const sesion = (socket.data as DatosSocket).sesion;
    const sala = sesion === undefined ? undefined : salas.obtener(sesion.codigo);
    return sesion === undefined || sala === undefined ? null : { sala, jugador: sesion.jugador };
  };

  // ---------------------------------------------------------------- conexiones

  io.on('connection', (socket) => {
    let mensajesEnEsteSegundo = 0;
    let segundoActual = Math.floor(Date.now() / 1000);
    const limite = o.limiteMensajesPorSegundo ?? 40;

    /** Registra un manejador con validación, límite de mensajes y respuesta (ack) segura. */
    const manejar = <T extends object>(mensaje: string, fn: (datos: unknown) => Ack<T>): void => {
      socket.on(mensaje, (datos: unknown, ack: unknown) => {
        const responder: Responder<T> =
          typeof ack === 'function' ? (ack as Responder<T>) : () => undefined;
        const segundo = Math.floor(Date.now() / 1000);
        if (segundo !== segundoActual) {
          segundoActual = segundo;
          mensajesEnEsteSegundo = 0;
        }
        mensajesEnEsteSegundo += 1;
        if (mensajesEnEsteSegundo > limite)
          return responder({ ok: false, error: 'DEMASIADOS_MENSAJES' });
        try {
          return responder(fn(datos));
        } catch (e) {
          app.log.error(e);
          return responder({ ok: false, error: 'ERROR_INTERNO' });
        }
      });
    };
    const error = (e: ErrorSala): { ok: false; error: ErrorSala } => ({ ok: false, error: e });

    manejar<Sesion>(MENSAJES.crear, (datos) => {
      const p = PeticionCrearSchema.safeParse(datos);
      if (!p.success) return error('DATOS_INVALIDOS');
      const sala = salas.crear();
      const asiento = sala.anadirHumano(p.data.nombre);
      unirSocket(socket, sala, asiento.id);
      return { ok: true, codigo: sala.codigo, jugador: asiento.id, token: asiento.token ?? '' };
    });

    manejar<Sesion>(MENSAJES.unirse, (datos) => {
      const p = PeticionUnirseSchema.safeParse(datos);
      if (!p.success) return error('DATOS_INVALIDOS');
      const sala = salas.obtener(p.data.codigo);
      if (sala === undefined) return error('SALA_NO_EXISTE');
      if (sala.fase !== 'lobby') return error('PARTIDA_EMPEZADA');
      if (sala.asientos.length >= MAX_ASIENTOS) return error('SALA_LLENA');
      if (!sala.nombreLibre(p.data.nombre)) return error('NOMBRE_REPETIDO');
      const asiento = sala.anadirHumano(p.data.nombre);
      unirSocket(socket, sala, asiento.id);
      return { ok: true, codigo: sala.codigo, jugador: asiento.id, token: asiento.token ?? '' };
    });

    manejar<Sesion>(MENSAJES.reanudar, (datos) => {
      const p = PeticionReanudarSchema.safeParse(datos);
      if (!p.success) return error('DATOS_INVALIDOS');
      const sala = salas.obtener(p.data.codigo);
      const asiento = sala?.asientoDeToken(p.data.token);
      if (sala === undefined || asiento === undefined) return error('SESION_INVALIDA');
      unirSocket(socket, sala, asiento.id);
      return { ok: true, codigo: sala.codigo, jugador: asiento.id, token: p.data.token };
    });

    manejar<object>(MENSAJES.listo, (datos) => {
      const p = PeticionListoSchema.safeParse(datos);
      const s = salaDe(socket);
      if (!p.success) return error('DATOS_INVALIDOS');
      if (s === null) return error('SIN_SALA');
      const asiento = s.sala.asiento(s.jugador);
      if (asiento === undefined || s.sala.fase !== 'lobby') return error('PARTIDA_EMPEZADA');
      asiento.listo = p.data.listo;
      enviarSala(s.sala);
      return { ok: true };
    });

    /** Operaciones solo del creador de la sala, en el lobby. */
    const delCreador = (fn: (sala: Sala) => Ack<object>) => (): Ack<object> => {
      const s = salaDe(socket);
      if (s === null) return error('SIN_SALA');
      if (s.sala.creador !== s.jugador) return error('SOLO_CREADOR');
      return fn(s.sala);
    };

    manejar<object>(MENSAJES.opciones, (datos) =>
      delCreador((sala) => {
        const p = OpcionesSalaSchema.safeParse(datos);
        if (!p.success) return error('DATOS_INVALIDOS');
        if (sala.fase !== 'lobby') return error('PARTIDA_EMPEZADA');
        sala.opciones = p.data;
        enviarSala(sala);
        return { ok: true };
      })(),
    );

    manejar<object>(MENSAJES.anadirBot, (datos) =>
      delCreador((sala) => {
        const p = PeticionAnadirBotSchema.safeParse(datos);
        if (!p.success) return error('DATOS_INVALIDOS');
        if (sala.fase !== 'lobby') return error('PARTIDA_EMPEZADA');
        if (sala.asientos.length >= MAX_ASIENTOS) return error('SALA_LLENA');
        sala.anadirBot(p.data.nivel);
        enviarSala(sala);
        return { ok: true };
      })(),
    );

    manejar<object>(MENSAJES.quitar, (datos) =>
      delCreador((sala) => {
        const p = PeticionQuitarSchema.safeParse(datos);
        if (!p.success) return error('DATOS_INVALIDOS');
        if (sala.fase !== 'lobby') return error('PARTIDA_EMPEZADA');
        const asiento = sala.asiento(p.data.jugador);
        if (asiento === undefined || asiento.id === sala.creador) return error('DATOS_INVALIDOS');
        for (const id of asiento.sockets) {
          const s = socketsDe(id);
          if (s !== undefined) {
            (s.data as DatosSocket).sesion = undefined;
            void s.leave(`sala:${sala.codigo}`);
            s.emit(MENSAJES.estadoSala, null);
          }
        }
        sala.quitar(asiento.id);
        enviarSala(sala);
        return { ok: true };
      })(),
    );

    manejar<object>(MENSAJES.empezar, () =>
      delCreador((sala) => {
        if (sala.fase !== 'lobby') return error('PARTIDA_EMPEZADA');
        if (sala.asientos.length < MIN_ASIENTOS) return error('POCOS_JUGADORES');
        if (sala.humanos.some((a) => a.id !== sala.creador && !a.listo))
          return error('NO_ESTAN_LISTOS');
        const config: ConfigAnfitrion = {
          modo: 'enLinea',
          reglas: sala.opciones.reglas,
          segundos: sala.opciones.segundos,
          limiteDecisionS: sala.opciones.limiteDecisionS,
          semilla: (o.semilla ?? semillaAleatoria)(),
          jugadores: sala.asientos.map((a) => ({ id: a.id, nombre: a.nombre, control: a.control })),
        };
        const anfitrion = Anfitrion.nueva(o.motor, config, reloj, o.opcionesAnfitrion);
        sala.anfitrion = anfitrion;
        sala.fase = 'partida';
        for (const a of sala.humanos) if (a.sockets.size === 0) anfitrion.desconectar(a.id);
        anfitrion.suscribir(() => difundirPartida(sala));
        enviarSala(sala);
        for (const a of sala.asientos) {
          for (const id of a.sockets) {
            const s = socketsDe(id);
            if (s !== undefined) enviarPartidaA(sala, s, a.id, true);
          }
        }
        return { ok: true };
      })(),
    );

    manejar<object>(MENSAJES.volverALaSala, () =>
      delCreador((sala) => {
        if (sala.fase === 'lobby') return { ok: true };
        if (sala.fase !== 'terminada') return error('PARTIDA_EMPEZADA');
        sala.anfitrion?.destruir();
        sala.anfitrion = null;
        sala.fase = 'lobby';
        for (const a of sala.asientos) a.listo = a.control !== 'humano';
        enviarSala(sala);
        return { ok: true };
      })(),
    );

    manejar<object>(MENSAJES.salir, () => {
      salir(socket);
      return { ok: true };
    });

    manejar<object>(MENSAJES.accion, (datos) => {
      const p = PeticionAccionSchema.safeParse(datos);
      const accion = p.success ? leerAccion(p.data.accion) : null;
      if (accion === null) return error('DATOS_INVALIDOS');
      const s = salaDe(socket);
      if (s === null) return error('SIN_SALA');
      if (s.sala.anfitrion === null) return error('SIN_PARTIDA');
      // El actor es siempre el jugador de esta conexión: nunca se acepta otro.
      const codigo = s.sala.anfitrion.enviar(s.jugador, accion);
      return codigo === null ? { ok: true } : { ok: false, error: codigo };
    });

    socket.on('disconnect', () => soltarSocket(socket, false));
  });

  // Salas abandonadas.
  const inactividad = o.inactividadSalaMs ?? 30 * 60_000;
  const limpieza = setInterval(() => salas.limpiar(reloj.ahora(), inactividad), 60_000);
  limpieza.unref();

  return {
    app,
    io,
    salas,
    escuchar: async (puerto, host = '0.0.0.0') => {
      await app.listen({ port: puerto, host });
      const direccion = app.server.address();
      return typeof direccion === 'object' && direccion !== null ? direccion.port : puerto;
    },
    cerrar: async () => {
      clearInterval(limpieza);
      salas.cerrarTodas();
      await io.close();
      await app.close();
    },
  };
}

export { CodigoSchema };
