export * from './tipos';
export { crearMotor, type Motor, type OpcionesMotor } from './motor';
export { ErrorConfiguracion, MAX_JUGADORES, MIN_JUGADORES, type ConfigPartida } from './crear';
export type { EntornoPaso, ManejadorCustom, RegistroCustom, ResultadoPaso } from './efectos';
export { CUSTOM_POR_DEFECTO } from './customs';
export { describirEvento, type Nombres } from './log';
export { ErrorCarga } from './serializar';
export {
  eventoParaJugador,
  eventosParaJugador,
  type DecisionVista,
  type JugadorVista,
  type MarcoVista,
  type PendienteVista,
  type VistaJugador,
} from './vista';
export { respuestasPosibles } from './legales';
export {
  clasesDelGrupo,
  cumpleRequisitos,
  desgloseClases,
  problemaDeConservacion,
  totalTirada,
  type AportacionClase,
  type DesgloseClases,
  type IdDeCarta,
} from './consultas';
export { bonosDeTirada } from './pasivas';
export { PA_POR_TURNO } from './ops';
export { crearRng, siguienteRng, type EstadoRng } from './rng';
