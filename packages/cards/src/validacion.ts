import {
  ArchivoCartasSchema,
  TIPOS_MAZO_PRINCIPAL,
  type ArchivoCartas,
  type Carta,
} from './schema';
import type { DefinicionEfecto, DefinicionesEfectos } from './efectos/esquema';

/** Cartas estándar del mazo principal según el reglamento (pág. 1). */
export const TOTAL_MAZO_PRINCIPAL_REGLAMENTO = 115;
/** Cartas de Líder de Grupo y de Monstruo según el reglamento (pág. 1). */
export const TOTAL_LIDERES_REGLAMENTO = 6;
export const TOTAL_MONSTRUOS_REGLAMENTO = 15;

export type Severidad = 'error' | 'aviso';

export interface Problema {
  severidad: Severidad;
  /** id de la carta afectada, o ruta del campo si no hay carta. */
  donde: string;
  mensaje: string;
}

export interface OpcionesValidacion {
  /** Comprueba si existe la imagen indicada en `carta.imagen`. */
  existeImagen?: (archivo: string) => boolean;
  /** Claves registradas de efectos (DSL + customEffects). Vacío hasta la Fase 2. */
  efectosRegistrados?: ReadonlySet<string>;
  /** Si es true, los efectos sin mapear son errores (Fase 2+). Si no, avisos. */
  efectosObligatorios?: boolean;
  /** Definiciones del DSL, para comprobar que encajan con el tipo de cada carta. */
  definiciones?: DefinicionesEfectos;
}

/** Comprueba que la definición de efecto tenga la forma que corresponde al tipo de carta. */
export function problemaDeDefinicion(carta: Carta, def: DefinicionEfecto): string | null {
  switch (carta.tipo) {
    case 'heroe':
    case 'magia':
      return def.programa === undefined
        ? `un${carta.tipo === 'magia' ? 'a Magia' : ' Héroe'} necesita "programa"`
        : null;
    case 'lider':
    case 'monstruo':
      return def.pasivas === undefined || def.pasivas.length === 0 ? 'necesita "pasivas"' : null;
    case 'objeto':
    case 'objeto_maldito':
      if (def.nucleo === 'mascara') {
        return carta.otorgaClase === undefined ? 'una máscara necesita "otorgaClase"' : null;
      }
      return def.pasivas === undefined || def.pasivas.length === 0 ? 'necesita "pasivas"' : null;
    case 'modificador':
      return def.nucleo === 'modificador' ? null : 'debe ser { "nucleo": "modificador" }';
    case 'desafio':
      return def.nucleo === 'desafio' ? null : 'debe ser { "nucleo": "desafio" }';
  }
}

export interface ResultadoValidacion {
  datos: ArchivoCartas | null;
  problemas: Problema[];
}

const contarCopias = (cartas: readonly Carta[], tipos: readonly Carta['tipo'][]): number =>
  cartas.filter((c) => tipos.includes(c.tipo)).reduce((n, c) => n + c.copias, 0);

/** Valida el contenido crudo (ya parseado de JSON) de cartas.es.json. */
export function validarCartas(
  crudo: unknown,
  opciones: OpcionesValidacion = {},
): ResultadoValidacion {
  const problemas: Problema[] = [];
  const parse = ArchivoCartasSchema.safeParse(crudo);

  if (!parse.success) {
    for (const issue of parse.error.issues) {
      problemas.push({
        severidad: 'error',
        donde: describirRuta(crudo, issue.path),
        mensaje: issue.message,
      });
    }
    return { datos: null, problemas };
  }

  const { cartas } = parse.data;
  const vistos = new Set<string>();
  for (const carta of cartas) {
    if (vistos.has(carta.id)) {
      problemas.push({ severidad: 'error', donde: carta.id, mensaje: 'id duplicado' });
    }
    vistos.add(carta.id);

    if (carta.revisar) {
      problemas.push({
        severidad: 'aviso',
        donde: carta.id,
        mensaje: `marcada para revisar${carta.nota ? `: ${carta.nota}` : ''}`,
      });
    }

    if (carta.imagen === undefined) {
      problemas.push({
        severidad: 'aviso',
        donde: carta.id,
        mensaje: 'sin imagen: se usará carta genérica',
      });
    } else if (opciones.existeImagen && !opciones.existeImagen(carta.imagen)) {
      problemas.push({
        severidad: 'aviso',
        donde: carta.id,
        mensaje: `no existe assets/cartas/${carta.imagen}: se usará carta genérica`,
      });
    }

    const sevEfecto: Severidad = opciones.efectosObligatorios ? 'error' : 'aviso';
    if (carta.efecto === null) {
      problemas.push({ severidad: sevEfecto, donde: carta.id, mensaje: 'efecto sin mapear' });
    } else if (
      carta.efecto.tipo !== 'ninguno' &&
      !opciones.efectosRegistrados?.has(carta.efecto.clave)
    ) {
      problemas.push({
        severidad: sevEfecto,
        donde: carta.id,
        mensaje: `efecto "${carta.efecto.tipo}:${carta.efecto.clave}" no está registrado`,
      });
    } else if (carta.efecto.tipo === 'dsl' && opciones.definiciones !== undefined) {
      const def = opciones.definiciones[carta.efecto.clave];
      const problema = def === undefined ? null : problemaDeDefinicion(carta, def);
      if (problema !== null) {
        problemas.push({ severidad: 'error', donde: carta.id, mensaje: problema });
      }
    }
  }

  if (opciones.definiciones !== undefined) {
    const claves = new Set(
      cartas.flatMap((c) =>
        c.efecto !== null && c.efecto.tipo !== 'ninguno' ? [c.efecto.clave] : [],
      ),
    );
    for (const clave of Object.keys(opciones.definiciones)) {
      if (!claves.has(clave)) {
        problemas.push({
          severidad: 'aviso',
          donde: `efectos:${clave}`,
          mensaje: 'definición de efecto que ninguna carta usa',
        });
      }
    }
  }

  const totales: [string, number, number][] = [
    ['mazo principal', contarCopias(cartas, TIPOS_MAZO_PRINCIPAL), TOTAL_MAZO_PRINCIPAL_REGLAMENTO],
    ['líderes de grupo', contarCopias(cartas, ['lider']), TOTAL_LIDERES_REGLAMENTO],
    ['monstruos', contarCopias(cartas, ['monstruo']), TOTAL_MONSTRUOS_REGLAMENTO],
  ];
  for (const [nombre, real, esperado] of totales) {
    if (real !== esperado) {
      problemas.push({
        severidad: 'aviso',
        donde: `total:${nombre}`,
        mensaje: `hay ${real} cartas y el reglamento indica ${esperado}`,
      });
    }
  }

  return { datos: parse.data, problemas };
}

/** Traduce una ruta de Zod (["cartas", 3, "tirada"]) a algo legible con el id de la carta. */
function describirRuta(crudo: unknown, ruta: readonly (string | number)[]): string {
  if (
    ruta[0] === 'cartas' &&
    typeof ruta[1] === 'number' &&
    esObjeto(crudo) &&
    Array.isArray(crudo.cartas)
  ) {
    const carta: unknown = crudo.cartas[ruta[1]];
    const id = esObjeto(carta) && typeof carta.id === 'string' ? carta.id : `#${ruta[1]}`;
    return [id, ...ruta.slice(2)].join('.');
  }
  return ruta.join('.') || '(raíz)';
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
