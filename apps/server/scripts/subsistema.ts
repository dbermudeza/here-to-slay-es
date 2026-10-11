/**
 * Cambia el subsistema de un ejecutable de Windows (PE) de «consola» a «gráfico»: así, al abrirlo
 * con doble clic, Windows no muestra ninguna ventana de consola. node.exe (y por tanto el
 * ejecutable SEA) es de consola; el lanzador solo abre el navegador, así que no la necesita.
 *
 * Formato PE: en 0x3C está el desplazamiento de la cabecera «PE\0\0»; tras ella van 20 bytes de
 * cabecera COFF y la cabecera opcional, cuyo campo Subsystem está en su byte 68 (igual en PE32 y
 * PE32+). Valores: 2 = gráfico (WINDOWS_GUI), 3 = consola (WINDOWS_CUI).
 */
export const SUBSISTEMA_GRAFICO = 2;
export const SUBSISTEMA_CONSOLA = 3;

/** Posición del campo Subsystem en el archivo, o lanza si no es un ejecutable PE. */
export function posicionSubsistema(exe: Buffer): number {
  if (exe.length < 0x40 || exe.toString('latin1', 0, 2) !== 'MZ') {
    throw new Error('No es un ejecutable de Windows (falta la firma MZ).');
  }
  const pe = exe.readUInt32LE(0x3c);
  if (pe + 24 + 70 > exe.length || exe.toString('latin1', pe, pe + 4) !== 'PE\0\0') {
    throw new Error('No es un ejecutable de Windows (falta la cabecera PE).');
  }
  return pe + 24 + 68;
}

/** Devuelve el ejecutable con el subsistema gráfico (no toca el original). */
export function aSubsistemaGrafico(exe: Buffer): Buffer {
  const copia = Buffer.from(exe);
  copia.writeUInt16LE(SUBSISTEMA_GRAFICO, posicionSubsistema(copia));
  return copia;
}
