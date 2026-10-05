import { copiarImagenes } from '../imagenes';

const { copiadas, faltan } = copiarImagenes();
console.log(`✔ ${copiadas} imágenes copiadas a assets/cartas/.`);
if (faltan.length > 0) {
  console.error(`✖ No se encontró el origen de ${faltan.length} imagen(es):`);
  for (const f of faltan) console.error(`    ${f}`);
  process.exit(1);
}
