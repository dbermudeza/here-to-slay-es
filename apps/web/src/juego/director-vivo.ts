/**
 * Director de las partidas locales: es el anfitrión compartido (@hts/anfitrion), el mismo que usa
 * el servidor para las partidas en línea.
 */
export {
  Anfitrion as DirectorVivo,
  RELOJ_REAL,
  type OpcionesAnfitrion as OpcionesDirector,
  type Plazo,
  type Reloj,
} from '@hts/anfitrion';
