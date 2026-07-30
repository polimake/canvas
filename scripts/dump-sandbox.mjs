/**
 * Volcados de SOLO LECTURA del Sample Space, para alimentar
 * `sandbox-to-canvas2.ts`.
 *
 * Se separa del convertidor a propósito: así el paso que habla con producción
 * es un fichero corto y auditable de un vistazo, y el que genera SQL no tiene
 * red. Aquí no hay una sola sentencia de escritura.
 *
 * Los `editorConfig` se piden en tandas de ids porque una sola consulta con 500
 * blobs revienta el buffer del proceso hijo.
 *
 * Uso:
 *   node packages/canvas2/scripts/dump-sandbox.mjs <dirSalida>
 * Requiere wrangler autenticado (CLOUDFLARE_API_TOKEN o `wrangler login`).
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SANDBOX_SPACE = 'c26a8b61-3da8-45ea-b888-4cad00c00a0e';
const DB = 'polimake-studio';
const SERVER = path.join(process.cwd(), 'apps', 'server');
const TANDA = 20;

const DIR = process.argv[2];
if (!DIR) {
  console.error('uso: dump-sandbox.mjs <dirSalida>');
  process.exit(1);
}
mkdirSync(DIR, { recursive: true });

/**
 * Consulta por `--command`, en UNA línea y entre comillas dobles.
 *
 * Dos cosas que costaron un intento cada una. Primera: en Windows wrangler es
 * un `.cmd`, así que hay que lanzarlo con `shell: true`, y entonces los
 * argumentos se concatenan SIN comillas — un SELECT con espacios llega troceado
 * ("Unknown arguments: id,, name, FROM…"). Hay que entrecomillarlo a mano.
 * Segunda: `--file` no sirve de alternativa aunque evite el escapado, porque
 * sube el fichero por la API de importación de D1, que no es para leer (muere
 * con "fetch failed" tras subirlo).
 *
 * Como el SQL va entre comillas dobles, dentro no puede haber ninguna: los
 * identificadores reservados se citan con corchetes (`[desc]`), que SQLite
 * acepta y `cmd` no toca.
 */
function consultar(sql, intentos = 4) {
  const linea = sql.replace(/\s+/g, ' ').trim();
  if (linea.includes('"')) throw new Error('el SQL no puede llevar comillas dobles: usa [ident]');
  let ultimo;
  for (let i = 0; i < intentos; i += 1) {
    try {
      const raw = execFileSync(
        'npx',
        ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', `"${linea}"`],
        { cwd: SERVER, shell: true, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' },
      );
      const parsed = JSON.parse(raw.slice(raw.indexOf('[')));
      return { raw, results: parsed.flatMap((p) => p.results ?? []) };
    } catch (err) {
      // Un volcado son ~500 consultas contra la API de Cloudflare y de vez en
      // cuando una devuelve "fetch failed". Sin reintento, la caída de la
      // número 400 obliga a repetir las 400 anteriores.
      ultimo = err;
      const espera = 1000 * 2 ** i;
      process.stderr.write(`\n  reintento ${i + 1}/${intentos - 1} en ${espera}ms\n`);
      execFileSync('node', ['-e', `setTimeout(()=>{}, ${espera})`], { encoding: 'utf8' });
    }
  }
  throw ultimo;
}

function volcar(nombre, sql) {
  const { raw, results } = consultar(sql);
  writeFileSync(path.join(DIR, nombre), raw, 'utf8');
  console.log(`${nombre}: ${results.length} filas`);
  return results;
}

const lista = (ids) => ids.map((i) => `'${String(i).replace(/'/g, "''")}'`).join(',');

// 1. Proyectos del sandbox.
volcar(
  'sandbox-projects.json',
  `SELECT id, name FROM projects WHERE spaceId='${SANDBOX_SPACE}'`,
);

// 2. Diseños del sandbox, SIN el blob (para saber cuáles hay y de dónde vienen).
const disenos = volcar(
  'sandbox-designs-meta.json',
  `SELECT d.id, d.name, d.pages, d.format, d.[desc], d.projectId, d.spaceId
     FROM designs d JOIN projects p ON p.id = d.projectId
    WHERE p.spaceId='${SANDBOX_SPACE}'`,
);

// 3. Contenidos que apuntan a esos diseños.
volcar(
  'sandbox-content.json',
  `SELECT c.id, c.designId FROM content c JOIN projects p ON p.id = c.project
    WHERE p.spaceId='${SANDBOX_SPACE}' AND c.designId IS NOT NULL`,
);

// 4. Brand kit del proyecto de ORIGEN de cada proyecto del sandbox.
//    Las copias no tienen brand kit propio, así que la tipografía de marca hay
//    que ir a buscarla al proyecto del cliente. El emparejamiento vive en
//    `migrate-projects-to-sandbox.ts`; se repite aquí porque este script tiene
//    que poder ejecutarse solo.
const PARES = [
  ['8ef87292-e993-47d8-b655-bec2e15d5d8d', 'K7iLB1DSagnls29DBjRR'],
  ['f5c2e8b9-1751-4803-bfee-c75bc2d464cc', 'tOGnErMZV8KIH6r9JXXm'],
  ['aa7a4376-c815-4020-b753-851e94eec970', 'VhnsFyFf64Lm3Tw1Dixn'],
  ['382777b3-d560-4969-9b88-ac3ecd1988aa', 'LXHzbKV7gu36ZXm5RMIH'],
  ['232d3ce3-4e28-42aa-b488-be23d7be7e1d', 'vWXdjFgXk585q9j3bCfA'],
];
const brandkits = PARES.map(
  ([sandbox, origen]) =>
    `SELECT '${sandbox}' AS sandboxProjectId, brandKit FROM projects WHERE id='${origen}'`,
).join(' UNION ALL ');
volcar('origin-brandkits.json', brandkits);

// 5. Los `editorConfig` legacy de partida.
//    Para una fila ya convertida, el legacy vive en su original de producción,
//    cuyo id quedó anotado en `desc`. Para una fila aún legacy, en ella misma.
const deOrigen = new Set();
for (const d of disenos) {
  const desc = String(d.desc ?? '');
  const prefijo = ['copia de ', 'canvas2 · convertido de '].find((p) => desc.startsWith(p));
  if (prefijo) deOrigen.add(desc.slice(prefijo.length).trim());
}

// Se traen TAMBIÉN los `editorConfig` actuales de las filas del sandbox, no
// solo los de sus originales. Sin ellos el rollback de una reescritura in situ
// pondría `editorConfig=NULL` y se perdería lo que había — o sea, la vuelta
// atrás destruiría más de lo que arregla.
const trozos = [];
const todos = [...new Set([...deOrigen, ...disenos.map((d) => d.id)])];
for (let i = 0; i < todos.length; i += TANDA) {
  const ids = todos.slice(i, i + TANDA);
  const { raw } = consultar(
    `SELECT id, editorConfig FROM designs WHERE id IN (${lista(ids)})`,
  );
  trozos.push(JSON.parse(raw.slice(raw.indexOf('['))));
  process.stdout.write(`\r  editorConfig: ${Math.min(i + TANDA, todos.length)}/${todos.length}`);
}
process.stdout.write('\n');
writeFileSync(path.join(DIR, 'origin-configs.json'), JSON.stringify(trozos.flat()), 'utf8');

// 6. El volcado que espera el convertidor: metadatos + su propio editorConfig.
//    Se rearma aquí para que `sandbox-to-canvas2.ts` lea un solo fichero.
const porId = new Map();
for (const p of trozos.flat()) for (const r of p.results ?? []) porId.set(r.id, r.editorConfig);
writeFileSync(
  path.join(DIR, 'sandbox-designs.json'),
  JSON.stringify([
    { results: disenos.map((d) => ({ ...d, editorConfig: porId.get(d.id) ?? null })) },
  ]),
  'utf8',
);

console.log(`\nvolcados en ${DIR}`);
console.log(`diseños: ${disenos.length} · editorConfig leídos: ${todos.length} (incluye ${deOrigen.size} originales de producción)`);
