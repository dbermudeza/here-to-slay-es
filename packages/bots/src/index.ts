export type { Bot, EntradaBot, NivelBot } from './tipos';
export { botFacil } from './facil';
export { botNormal } from './normal';
export { Analisis, probAlMenos, probRango, valorEnMano, valorPrograma } from './analisis';
export {
  ErrorDirector,
  jugarPartida,
  type OpcionesDirector,
  type ResultadoPartida,
} from './director';

import { botFacil } from './facil';
import { botNormal } from './normal';
import type { Bot, NivelBot } from './tipos';

export const BOTS: Readonly<Record<NivelBot, Bot>> = { facil: botFacil, normal: botNormal };
