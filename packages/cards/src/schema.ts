import { z } from 'zod';

/**
 * Esquema de cartas de Here to Slay.
 *
 * Convenciones:
 * - `nombre` es el que se muestra en la UI. En héroes es el nombre original
 *   (no se traduce); en el resto es la traducción al español.
 * - `id` es estable y en snake_case con prefijo de tipo:
 *   héroes → `heroe_<nombre_original>`, resto → `<tipo>_<nombre_traducido>`.
 * - `textoOriginal` conserva el texto en inglés tal como aparece en la carta,
 *   para poder revisar la traducción.
 * - `efecto` referencia la implementación (DSL o customEffects); se completa en la Fase 2.
 */

export const EXPANSIONES = ['base'] as const;

/** Clases del juego base. Las de expansión se añadirán aquí sin romper el esquema. */
export const CLASES = ['bardo', 'luchador', 'guardian', 'cazador', 'ladron', 'mago'] as const;

export const TIPOS_CARTA = [
  'heroe',
  'objeto',
  'objeto_maldito',
  'magia',
  'modificador',
  'desafio',
  'monstruo',
  'lider',
] as const;

export const ClaseSchema = z.enum(CLASES);
export type Clase = z.infer<typeof ClaseSchema>;

export const TipoCartaSchema = z.enum(TIPOS_CARTA);
export type TipoCarta = z.infer<typeof TipoCartaSchema>;

const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, 'El id debe estar en snake_case ASCII (sin tildes ni ñ).');

const textoSchema = z.string().trim().min(1);

/** Referencia a la implementación del efecto. `null` = aún sin mapear (Fase 2). */
export const EfectoRefSchema = z
  .discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('dsl'), clave: z.string().min(1) }),
    z.object({ tipo: z.literal('custom'), clave: z.string().min(1) }),
    z.object({ tipo: z.literal('ninguno') }),
  ])
  .nullable();
export type EfectoRef = z.infer<typeof EfectoRefSchema>;

const baseCarta = {
  id: idSchema,
  nombre: textoSchema,
  nombreOriginal: textoSchema,
  /** Número de copias en el mazo correspondiente. */
  copias: z.number().int().min(1),
  /** Nombre de archivo dentro de assets/cartas/ (sin ruta). Opcional: si falta, se usa carta genérica. */
  imagen: z
    .string()
    .regex(/^[a-z0-9_]+\.(png|jpe?g|webp)$/)
    .optional(),
  /** Ruta de la imagen original relativa a Referencias/Imagenes/Cartas/ (para copiar-imagenes). */
  origenImagen: z.string().min(1).optional(),
  expansion: z.enum(EXPANSIONES).default('base'),
  /** true si la transcripción o los datos necesitan revisión humana. */
  revisar: z.boolean().default(false),
  /** Nota libre sobre por qué se marcó `revisar` u otras observaciones. */
  nota: z.string().optional(),
  efecto: EfectoRefSchema.default(null),
};

/** Texto de efecto traducido + original. */
const conTexto = {
  texto: textoSchema,
  textoOriginal: textoSchema,
};

/** Tirada mínima necesaria (ej. 8 = "8+"). Dos dados de 6 → 2..12. */
const tiradaMinima = z.number().int().min(2).max(13);

export const HeroeSchema = z.object({
  ...baseCarta,
  ...conTexto,
  tipo: z.literal('heroe'),
  clase: ClaseSchema,
  tirada: tiradaMinima,
});

export const ObjetoSchema = z.object({
  ...baseCarta,
  ...conTexto,
  tipo: z.enum(['objeto', 'objeto_maldito']),
  /** Si el objeto hace que el héroe equipado cuente como otra clase (máscaras). */
  otorgaClase: ClaseSchema.optional(),
});

export const MagiaSchema = z.object({
  ...baseCarta,
  ...conTexto,
  tipo: z.literal('magia'),
});

export const ModificadorSchema = z
  .object({
    ...baseCarta,
    tipo: z.literal('modificador'),
    /** Valores entre los que se elige al jugar la carta (ej. [1, -3] para "+1/−3"). */
    opciones: z
      .array(
        z
          .number()
          .int()
          .min(-10)
          .max(10)
          .refine((n) => n !== 0),
      )
      .min(1)
      .max(2),
  })
  .extend({ texto: textoSchema.optional(), textoOriginal: textoSchema.optional() });

export const DesafioSchema = z.object({
  ...baseCarta,
  ...conTexto,
  tipo: z.literal('desafio'),
});

/** Requisito para atacar un monstruo: un héroe de cualquier clase o de una clase concreta. */
export const RequisitoSchema = z.union([z.literal('heroe'), ClaseSchema]);
export type Requisito = z.infer<typeof RequisitoSchema>;

/** Rango de tirada: `min` → "N+", `max` → "N−". */
export const RangoTiradaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('min'), valor: tiradaMinima }),
  z.object({ tipo: z.literal('max'), valor: tiradaMinima }),
]);
export type RangoTirada = z.infer<typeof RangoTiradaSchema>;

export const ResultadoMonstruoSchema = z.object({
  rango: RangoTiradaSchema,
  texto: textoSchema,
  textoOriginal: textoSchema,
});

export const MonstruoSchema = z.object({
  ...baseCarta,
  tipo: z.literal('monstruo'),
  requisitos: z.array(RequisitoSchema).min(1),
  /** Resultado que mata al monstruo (lo mueve a tu zona). */
  exito: ResultadoMonstruoSchema,
  /** Resultado negativo (sacrificar, descartar…). */
  fracaso: ResultadoMonstruoSchema,
  /** Efecto pasivo que obtienes al matarlo. */
  texto: textoSchema,
  textoOriginal: textoSchema,
});

export const LiderSchema = z.object({
  ...baseCarta,
  ...conTexto,
  tipo: z.literal('lider'),
  clase: ClaseSchema,
});

export const CartaSchema = z.discriminatedUnion('tipo', [
  HeroeSchema,
  ObjetoSchema.extend({ tipo: z.literal('objeto') }),
  ObjetoSchema.extend({ tipo: z.literal('objeto_maldito') }),
  MagiaSchema,
  ModificadorSchema,
  DesafioSchema,
  MonstruoSchema,
  LiderSchema,
]);
export type Carta = z.infer<typeof CartaSchema>;
export type Heroe = z.infer<typeof HeroeSchema>;
export type Monstruo = z.infer<typeof MonstruoSchema>;
export type Lider = z.infer<typeof LiderSchema>;

export const ArchivoCartasSchema = z.object({
  version: z.literal(1),
  cartas: z.array(CartaSchema),
});
export type ArchivoCartas = z.infer<typeof ArchivoCartasSchema>;

/** Tipos que forman el mazo principal (excluye monstruos y líderes). */
export const TIPOS_MAZO_PRINCIPAL: readonly TipoCarta[] = [
  'heroe',
  'objeto',
  'objeto_maldito',
  'magia',
  'modificador',
  'desafio',
];
