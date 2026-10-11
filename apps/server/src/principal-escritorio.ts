/** Punto de entrada de HereToSlay.exe (ver escritorio.ts y apps/server/scripts/empaquetar.ts). */
import { principal } from './escritorio';

void principal().finally(() => process.exit(0));
