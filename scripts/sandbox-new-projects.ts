/**
 * Crea en el Sample Space el gemelo vacío de un proyecto de producción, para
 * que `migrate-projects-to-sandbox.ts` tenga dónde volcar el contenido.
 *
 * Copia lo que define la identidad del proyecto (nombre, brief, brand kit, voz
 * y tono, workflow, color, tipos y horas por defecto) y NO copia nada que sea
 * un asa hacia el cliente:
 *   · `mediaProjectId` / `libraryId` — borrar una foto en el sandbox la borraría
 *     en la librería del cliente.
 *   · `connectedAccounts` — cuentas sociales reales; se deja `[]`.
 *
 * El id del destino es determinista (uuid v5-like derivado del id de origen):
 * volver a ejecutar da el mismo id, así que el SQL es idempotente con
 * `INSERT OR IGNORE` y el fichero de pares no se desincroniza.
 *
 * Uso:
 *   npx tsx scripts/sandbox-new-projects.ts --in=<proyectos.json> --out=<prefijo>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const ENTRADA = arg('in');
const SALIDA = arg('out');
const DESTINO_SPACE = arg('space') ?? 'c26a8b61-3da8-45ea-b888-4cad00c00a0e';
const OWNER = arg('owner') ?? 'usr_2ed033dba4e4ded6728894e0114474ea';
const NOW = arg('now') ?? new Date().toISOString();

if (!ENTRADA || !SALIDA) {
  console.error('faltan --in=<proyectos.json> y/o --out=<prefijo>');
  process.exit(1);
}

/** uuid determinista a partir del id de origen: mismo origen → mismo destino. */
function idDestino(origen: string): string {
  const h = createHash('sha1').update(`sandbox:${DESTINO_SPACE}:${origen}`).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), `4${h.slice(13, 16)}`, `8${h.slice(17, 20)}`, h.slice(20, 32)].join('-');
}

const q = (s: unknown) =>
  s === null || s === undefined || s === '' ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;

interface Proyecto {
  id: string;
  name: string;
  brief: string | null;
  brandKit: string | null;
  vozYtono: string | null;
  workflow: string | null;
  workflowTags: string | null;
  projectMainColor: string | null;
  defaultContentTypes: string | null;
  publishingHours: string | null;
  favoriteContentType: string | null;
}

const origenes: Proyecto[] = JSON.parse(readFileSync(ENTRADA, 'utf8'));
origenes.sort((a, b) => a.name.localeCompare(b.name));

const sql = ['-- Gemelos vacíos en el Sample Space. Sin librería ni cuentas conectadas.'];
const rollback = ['-- Rollback: borra los gemelos (solo si están vacíos).'];
const pares: { slug: string; nombre: string; origen: string; destino: string }[] = [];

for (const p of origenes) {
  const destino = idDestino(p.id);
  const slug = p.name
    .toLowerCase()
    // Los diacríticos se separan con NFD y se descartan por rango escapado: la
    // clase literal se pierde al pasar el fichero por herramientas que
    // normalizan Unicode.
    .normalize('NFD')
    .replace(new RegExp('[\u0300-\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  sql.push(
    '',
    `-- ${p.name}: ${p.id} → ${destino}`,
    'INSERT OR IGNORE INTO projects (id, name, spaceId, status, ownerId, createdBy, mediaProjectId, brief, brandKit,' +
      ' vozYtono, workflow, workflowTags, projectMainColor, libraryId, defaultContentTypes, publishingHours,' +
      ' favoriteContentType, aiMediaAnalysis, connectedAccounts, createdAt, updatedAt) VALUES (' +
      `${q(destino)}, ${q(p.name)}, ${q(DESTINO_SPACE)}, 'active', ${q(OWNER)}, ${q(OWNER)}, NULL, ` +
      `${q(p.brief)}, ${q(p.brandKit)}, ${q(p.vozYtono)}, ${q(p.workflow)}, ${q(p.workflowTags)}, ` +
      `${q(p.projectMainColor)}, NULL, ${q(p.defaultContentTypes)}, ${q(p.publishingHours)}, ` +
      `${q(p.favoriteContentType)}, NULL, '[]', ${q(NOW)}, ${q(NOW)});`,
  );
  rollback.push(
    `DELETE FROM projects WHERE id=${q(destino)} AND NOT EXISTS (SELECT 1 FROM content WHERE project=${q(destino)});`,
  );
  pares.push({ slug, nombre: p.name, origen: p.id, destino });
}

writeFileSync(`${SALIDA}.sql`, sql.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.rollback.sql`, rollback.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.pares.json`, JSON.stringify(pares, null, 1), 'utf8');

for (const p of pares) console.log(`${p.nombre.padEnd(20)} ${p.origen} → ${p.destino}`);
console.log(`\n${pares.length} proyectos · sql: ${SALIDA}.sql · pares: ${SALIDA}.pares.json`);
