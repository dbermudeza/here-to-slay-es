/**
 * pnpm sim [partidas] [semilla]
 * Simula partidas entre bots con el catálogo real y muestra estadísticas.
 */
import { readFileSync } from 'node:fs';
import { ArchivoCartasSchema } from '@hts/cards';
import { crearMotor, type Modo } from '@hts/engine';
import { RUTA_CARTAS_JSON } from '../../../cards/src/rutas';
import { BOTS } from '../index';
import { jugarPartida } from '../director';
import type { NivelBot } from '../tipos';

const partidas = Number(process.argv[2] ?? 200);
const semilla = process.argv[3] ?? 'sim';

const { cartas } = ArchivoCartasSchema.parse(JSON.parse(readFileSync(RUTA_CARTAS_JSON, 'utf8')));
const motor = crearMotor(cartas);
const nombre = new Map(cartas.map((c) => [c.id, c.nombre]));

const victorias: Record<NivelBot, number> = { facil: 0, normal: 0 };
const asientos: Record<NivelBot, number> = { facil: 0, normal: 0 };
const motivos = new Map<string, number>();
const usoCartas = new Map<string, number>();
let sinGanador = 0;
let turnos = 0;
let acciones = 0;
const inicio = Date.now();

for (let i = 0; i < partidas; i++) {
  const n = 2 + (i % 5);
  const modo: Modo = i % 2 === 0 ? 'normal' : 'dificil';
  const ids = Array.from({ length: n }, (_, k) => `j${k}`);
  const niveles = Object.fromEntries(
    ids.map((id, k) => [id, (k + i) % 2 === 0 ? 'normal' : 'facil']),
  ) as Record<string, NivelBot>;
  const r = jugarPartida(
    motor,
    {
      jugadores: ids.map((id) => ({ id, nombre: id })),
      semilla: `${semilla}-${i}`,
      opciones: { modo },
    },
    Object.fromEntries(ids.map((id) => [id, BOTS[niveles[id] ?? 'facil']])),
  );
  for (const id of ids) asientos[niveles[id] ?? 'facil'] += 1;
  if (r.ganador === null) sinGanador += 1;
  else {
    victorias[niveles[r.ganador] ?? 'facil'] += 1;
    const motivo = `${modo}:${r.estado.ganador?.motivo ?? '?'}`;
    motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
  }
  turnos += r.turnos;
  acciones += r.acciones;
  for (const c of r.cartasJugadas) usoCartas.set(c, (usoCartas.get(c) ?? 0) + 1);
}

const ms = Date.now() - inicio;
const pct = (x: number, total: number): string =>
  `${((100 * x) / Math.max(1, total)).toFixed(1)} %`;
console.log(
  `\n${partidas} partidas en ${(ms / 1000).toFixed(1)} s (${(ms / partidas).toFixed(0)} ms/partida)`,
);
console.log(`Sin ganador: ${sinGanador}`);
console.log(
  `Turnos de media: ${(turnos / partidas).toFixed(1)} · acciones de media: ${(acciones / partidas).toFixed(0)}`,
);
for (const nivel of ['normal', 'facil'] as const) {
  console.log(
    `Bot ${nivel}: ${victorias[nivel]} victorias en ${asientos[nivel]} asientos (${pct(victorias[nivel], asientos[nivel])} por asiento)`,
  );
}
console.log('\nMotivos de victoria:');
for (const [m, k] of [...motivos].sort((a, b) => b[1] - a[1]))
  console.log(`  ${m.padEnd(36)} ${k}`);
console.log('\nCartas más jugadas:');
for (const [c, k] of [...usoCartas].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${(nombre.get(c) ?? c).padEnd(36)} ${k}`);
}
