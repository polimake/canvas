/**
 * Migración in-place de un proyecto real, parametrizada por argumentos.
 *
 * Sustituye a `migrate-project-designs.ts`, que llevaba clavados la ruta del
 * scratchpad, el id del proyecto, el space y la fecha de una sesión concreta y
 * por tanto no se podía volver a usar.
 *
 * Por cada diseño legacy del proyecto crea su gemelo `format='excalidraw'` y
 * repunta `content.designId` al gemelo. La fila legacy NO se toca: los dos
 * formatos conviven en la tabla y la vuelta atrás es repuntar el designId, sin
 * reconvertir nada.
 *
 * Uso:
 *   npx tsx scripts/migrate-project-inplace.ts \
 *     --in=<volcado.json> --out=<prefijo> --now=<iso8601>
 *
 * El volcado es el `results` de:
 *   SELECT c.id AS contenido, d.id, d.name, d.pages, d.spaceId, d.createdBy,
 *          d.editorConfig
 *     FROM content c JOIN designs d ON d.id = c.designId
 *    WHERE c.project = '<proyecto>' AND COALESCE(d.format,'legacy') = 'legacy'
 *
 * Emite tres ficheros y NO escribe en la base de datos:
 *   <prefijo>.sql           altas + repuntes
 *   <prefijo>.rollback.sql  el repunte inverso
 *   <prefijo>.informe.json  qué se convirtió y qué se perdió
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { legacyToScene } from '../src/legacy';

const arg = (nombre: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split('=').slice(1).join('=');

const ENTRADA = arg('in');
const SALIDA = arg('out');
// La fecha entra por argumento para que dos ejecuciones con el mismo volcado
// den el mismo SQL salvo por los uuid: el diff del informe es revisable.
const NOW = arg('now') ?? new Date().toISOString();

if (!ENTRADA || !SALIDA) {
  console.error('faltan --in=<volcado.json> y/o --out=<prefijo>');
  process.exit(1);
}

interface Fila {
  contenido: string;
  id: string;
  name: string | null;
  pages: number | null;
  spaceId: string | null;
  createdBy: string | null;
  editorConfig: string;
}

interface Entrada {
  legacy: string;
  excalidraw: string;
  contenido: string;
  tier: string;
  paginas: number;
  limpio: boolean;
  capas: Record<string, number>;
  notas: string[];
  bytesLegacy: number;
  bytesExcal: number;
  elementos: number;
  imagenes: number;
  textos: number;
  fuentes: string[];
}

const q = (s: unknown) =>
  s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;

const filas: Fila[] = JSON.parse(readFileSync(ENTRADA, 'utf8'));
// Orden estable para que el informe se pueda diffear entre ejecuciones.
filas.sort((a, b) => a.id.localeCompare(b.id));

const sql: string[] = [
  '-- Migración in-place. Las filas legacy NO se tocan: solo se añaden gemelos',
  '-- `format=excalidraw` y se repunta content.designId.',
  '-- Vuelta atrás: aplicar el .rollback.sql.',
];
const rollback: string[] = ['-- Rollback: repunta cada contenido a su diseño legacy.'];
const informe: Entrada[] = [];

for (const fila of filas) {
  const { elements, files, fonts, report } = legacyToScene(fila.editorConfig);
  const escena = JSON.stringify({
    elements,
    appState: { viewBackgroundColor: '#f5f5f5' },
    files,
    // Las tipografías viajan CON la escena: un diseño migrado se ve igual
    // aunque el brand kit del proyecto cambie después.
    ...(fonts.length ? { fonts } : {}),
  });
  const nuevoId = randomUUID();
  const paginas = fila.pages ?? report.pages;
  const tipo = (e: unknown) => (e as { type?: string }).type;

  sql.push('', `-- ${fila.id} → ${nuevoId}  (${report.tier}, ${report.pages} pág.)`);
  sql.push(
    'INSERT INTO designs (id, name, editorConfig, pages, createdBy, projectId, spaceId, template, "desc", format, createdAt, updatedAt)' +
      ' SELECT ' +
      `${q(nuevoId)}, ${q(fila.name ?? 'Diseño')}, ${q(escena)}, ${paginas}, ${q(fila.createdBy)}, ` +
      // projectId/spaceId se copian de la fila legacy en el propio INSERT: así
      // no hay forma de plantar el gemelo en otro proyecto por un argumento mal
      // puesto, y si el diseño de origen no existe no se inserta nada.
      `projectId, spaceId, 0, ${q('canvas2 · convertido de ' + fila.id)}, 'excalidraw', ${q(NOW)}, ${q(NOW)}` +
      ` FROM designs WHERE id = ${q(fila.id)};`,
  );
  sql.push(
    `UPDATE content SET designId=${q(nuevoId)}, updatedAt=${q(NOW)} WHERE id=${q(fila.contenido)};`,
  );
  rollback.push(`UPDATE content SET designId=${q(fila.id)} WHERE id=${q(fila.contenido)};`);

  informe.push({
    legacy: fila.id,
    excalidraw: nuevoId,
    contenido: fila.contenido,
    tier: report.tier,
    paginas: report.pages,
    limpio: report.clean,
    capas: report.counts,
    notas: report.notes.map((n) => `p${n.page}/${n.kind}: ${n.detail}`),
    bytesLegacy: fila.editorConfig.length,
    bytesExcal: escena.length,
    elementos: elements.length,
    imagenes: elements.filter((e) => tipo(e) === 'image').length,
    textos: elements.filter((e) => tipo(e) === 'text').length,
    fuentes: fonts.map((f) => f.family),
  });
}

writeFileSync(`${SALIDA}.sql`, sql.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.rollback.sql`, rollback.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.informe.json`, JSON.stringify(informe, null, 1), 'utf8');

for (const e of informe) {
  console.log(
    `${e.legacy.slice(0, 8)} → ${e.excalidraw.slice(0, 8)}  ${e.tier} ${e.paginas}p  ` +
      `${e.elementos} el (${e.imagenes} img, ${e.textos} txt)  ` +
      `${e.bytesLegacy}B → ${e.bytesExcal}B  ` +
      (e.limpio ? 'limpio' : e.notas.join(' | ')),
  );
}

const vacios = informe.filter((e) => e.imagenes === 0 && e.textos === 0);
console.log(
  `\n${informe.length} diseños · ${informe.filter((e) => e.limpio).length} limpios · ` +
    `${vacios.length} sin contenido visible` +
    (vacios.length ? ` (${vacios.map((e) => e.legacy.slice(0, 8)).join(', ')})` : ''),
);
console.log(`sql:      ${SALIDA}.sql`);
console.log(`rollback: ${SALIDA}.rollback.sql`);
console.log(`informe:  ${SALIDA}.informe.json`);
