/**
 * Reconvierte copias del sandbox cuyo original SÍ tenía contenido pero que
 * salieron vacías con una versión anterior del convertidor.
 *
 * Nació de una auditoría concreta: de 492 diseños migrados, 8 quedaron sin un
 * solo elemento, y 4 de ellos tenían una `VideoLayer` en origen — que entonces
 * se descartaba. Ahora se convierte a su póster, así que esas cuatro páginas
 * pueden recuperarse sin volver a migrar nada más.
 *
 * Lee un volcado `{copia_id, origen_id, editorConfig}` y emite el SQL. NO toca
 * la base de datos: solo se reescribe `editorConfig` de la copia, así que ni los
 * contenidos ni las miniaturas ni los ids se mueven.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { legacyToScene } from '../../src/converters/legacy';

const SP =
  'C:/Users/OliSR/AppData/Local/Temp/claude/c--Users-OliSR-Desktop-studio/317510af-8803-43ba-9e6a-7379084ed5b3/scratchpad';

interface Fila {
  copia_id: string;
  origen_id: string;
  editorConfig: string;
}

const raw = readFileSync(`${SP}/video-designs.json`, 'utf8');
const filas: Fila[] = JSON.parse(raw.slice(raw.indexOf('[')))[0].results;

const q = (s: unknown) => `'${String(s).replace(/'/g, "''")}'`;
const sql: string[] = ['-- Reconversión: solo `editorConfig`. Ids y miniaturas intactos.'];
let recuperados = 0;

for (const fila of filas) {
  const { elements, files, report } = legacyToScene(fila.editorConfig);
  const imagenes = elements.filter((e) => (e as { type?: string }).type === 'image').length;
  const textos = elements.filter((e) => (e as { type?: string }).type === 'text').length;

  // Si sigue sin dar nada, reescribir no arregla nada y solo enturbia el diff.
  if (imagenes === 0 && textos === 0) {
    console.log(`  ${fila.copia_id.slice(0, 8)}: sigue vacío (${report.tier}), se deja como está`);
    continue;
  }

  const escena = JSON.stringify({
    elements,
    appState: { viewBackgroundColor: '#f5f5f5' },
    files,
  });
  sql.push(
    `UPDATE designs SET editorConfig=${q(escena)}, updatedAt=${q(new Date('2026-07-29T18:40:00Z').toISOString())} WHERE id=${q(fila.copia_id)};`,
  );
  recuperados += 1;
  console.log(
    `  ${fila.copia_id.slice(0, 8)}: ${imagenes} imagen(es), ${textos} texto(s) · ${report.tier}` +
      (report.notes.length ? ` · ${report.notes[0].detail}` : ''),
  );
}

writeFileSync(`${SP}/reconvert.sql`, sql.join('\n') + '\n', 'utf8');
console.log(`\nrecuperados: ${recuperados}/${filas.length}`);
