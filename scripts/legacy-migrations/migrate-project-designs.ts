/**
 * Migración in-place de un proyecto REAL: por cada diseño legacy crea su gemelo
 * `format='excalidraw'` (la fila original NO se toca) y repunta `content.designId`
 * al gemelo.
 *
 * Los dos formatos conviven en la tabla: el legacy sigue ahí intacto, así que la
 * vuelta atrás es repuntar el designId — no hay que reconvertir nada.
 *
 * Emite tres ficheros y no escribe en la base de datos:
 *   <salida>.sql           las altas + repuntes
 *   <salida>.rollback.sql  el repunte inverso, listo para pegar
 *   <salida>.informe.json  qué se convirtió y qué se perdió
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { legacyToScene } from '../../src/converters/legacy';

const SP =
  'C:/Users/OliSR/AppData/Local/Temp/claude/c--Users-OliSR-Desktop-studio/317510af-8803-43ba-9e6a-7379084ed5b3/scratchpad';
const ENTRADA = `${SP}/pp-mes-limpio.json`;
const SALIDA = `${SP}/pp-mes`;
const PROYECTO = 'K7iLB1DSagnls29DBjRR'; // Paella Power (real)
const SPACE = 'sp_f4864ab756a2ef4f71fbb562cfb280';
const OWNER = 'usr_2ed033dba4e4ded6728894e0114474ea';
const NOW = new Date('2026-07-29T09:40:00.000Z').toISOString();

interface Fila {
  id: string;
  name: string | null;
  pages: number | null;
  editorConfig: string;
  contenido: string;
}

interface Entrada {
  legacy: string;
  excalidraw: string;
  contenido: string;
  tier: string;
  paginas: number;
  limpio: boolean;
  notas: string[];
  bytesLegacy: number;
  bytesExcal: number;
}

const q = (s: unknown) =>
  s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;

const filas: Fila[] = JSON.parse(readFileSync(ENTRADA, 'utf8'));
filas.sort((a, b) => a.id.localeCompare(b.id));

const sql: string[] = [
  `-- Migración in-place: ${PROYECTO}. Las filas legacy NO se tocan.`,
  '-- Vuelta atrás: aplicar el .rollback.sql (repunta designId al original).',
];
const rollback: string[] = [`-- Rollback de la migración de ${PROYECTO}`];
const informe: Entrada[] = [];

for (const fila of filas) {
  const { elements, files, report } = legacyToScene(fila.editorConfig);
  const escena = JSON.stringify({
    elements,
    appState: { viewBackgroundColor: '#f5f5f5' },
    files,
  });
  const nuevoId = randomUUID();
  const paginas = fila.pages ?? report.pages;

  sql.push('', `-- ${fila.id} → ${nuevoId}  (${report.tier}, ${report.pages} pág.)`);
  sql.push(
    'INSERT INTO designs (id, name, editorConfig, pages, createdBy, projectId, spaceId, template, "desc", format, createdAt, updatedAt) VALUES (' +
      `${q(nuevoId)}, ${q(fila.name ?? 'Diseño')}, ${q(escena)}, ${paginas}, ${q(OWNER)}, ` +
      `${q(PROYECTO)}, ${q(SPACE)}, 0, ${q('canvas2 · convertido de ' + fila.id)}, 'excalidraw', ${q(NOW)}, ${q(NOW)});`,
  );
  sql.push(`UPDATE content SET designId=${q(nuevoId)}, updatedAt=${q(NOW)} WHERE id=${q(fila.contenido)};`);
  rollback.push(`UPDATE content SET designId=${q(fila.id)} WHERE id=${q(fila.contenido)};`);

  informe.push({
    legacy: fila.id,
    excalidraw: nuevoId,
    contenido: fila.contenido,
    tier: report.tier,
    paginas: report.pages,
    limpio: report.clean,
    notas: report.notes.map((n) => `p${n.page}/${n.kind}: ${n.detail}`),
    bytesLegacy: fila.editorConfig.length,
    bytesExcal: escena.length,
  });
}

// El legacy queda marcado explícitamente para que el enrutado no dependa de NULL.
rollback.push('', '-- Las filas legacy siguen intactas; no hay nada que restaurar en `designs`.');

writeFileSync(`${SALIDA}.sql`, sql.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.rollback.sql`, rollback.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.informe.json`, JSON.stringify(informe, null, 1), 'utf8');

for (const e of informe) {
  console.log(
    `${e.legacy.slice(0, 8)} → ${e.excalidraw.slice(0, 8)}  ${e.tier} ${e.paginas}p  ` +
      `${e.bytesLegacy}B → ${e.bytesExcal}B  ` +
      (e.limpio ? 'limpio' : e.notas.join(' | ')),
  );
}
console.log(`\n${informe.length} diseños · ${informe.filter((e) => e.limpio).length} limpios`);
console.log(`sql: ${SALIDA}.sql`);
console.log(`rollback: ${SALIDA}.rollback.sql`);
