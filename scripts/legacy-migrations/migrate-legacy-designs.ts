/**
 * Fase 3 — duplica diseños reales de Paella Power al proyecto sandbox y crea,
 * junto a cada copia legacy, su gemelo convertido a Excalidraw.
 *
 * NO toca ninguna fila del proyecto real: solo lee. Emite SQL, no escribe en la
 * base de datos. Con --dry-run se queda en el informe.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { legacyToScene } from '../../src/converters/legacy';

const SP = 'C:/Users/OliSR/AppData/Local/Temp/claude/c--Users-OliSR-Desktop-studio/317510af-8803-43ba-9e6a-7379084ed5b3/scratchpad';
const DESTINO = '8ef87292-e993-47d8-b655-bec2e15d5d8d'; // Paella Power (sandbox)
const SPACE = 'c26a8b61-3da8-45ea-b888-4cad00c00a0e';
const OWNER = 'usr_2ed033dba4e4ded6728894e0114474ea';
const NOW = new Date('2026-07-29T09:15:00.000Z').toISOString();
const DRY = process.argv.includes('--dry-run');

/** Huecos de contenido libres en el sandbox, en orden de fecha. */
const HUECOS = [
  { id: '6b0a6ec6-3b7a-4dee-8b90-3e10b7591347', dia: '1 oct' },
  { id: '02e23edd-2c5d-4745-80a2-f77cf034c487', dia: '5 oct' },
  { id: 'b2745cd7-f65c-4aa3-969f-cb33f437ad52', dia: '8 oct' },
  { id: 'd10ac9dd-e41d-4bbf-a94a-106a0b2a7811', dia: '12 oct' },
  { id: '605a889c-ae28-4b2b-917e-0be73d49c92f', dia: '15 oct' },
  { id: '175cc8c6-884a-42f8-900a-030a2af17808', dia: '19 oct' },
  { id: '71d3080b-1bf7-443c-a523-fc06ab357dfd', dia: '22 oct' },
];

interface Fila { id: string; name: string; pages: number; editorConfig: string }

const q = (s: unknown) =>
  s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;

const filas: Fila[] = JSON.parse(readFileSync(`${SP}/muestra-limpia.json`, 'utf8'));
// Orden estable (el JSON viene ordenado por id) para que el informe sea reproducible.
filas.sort((a, b) => a.id.localeCompare(b.id));

interface EntradaInforme {
  origen: string;
  dia: string;
  contenido: string;
  tier: string;
  paginas: number;
  capas: Record<string, number>;
  limpio: boolean;
  notas: string[];
  idLegacy: string;
  idExcal: string;
  bytesLegacy: number;
  bytesExcal: number;
}

const sql: string[] = ['-- Fase 3: duplicado + conversión al sandbox. No toca el proyecto real.'];
const informe: EntradaInforme[] = [];

filas.forEach((fila, i) => {
  const hueco = HUECOS[i];
  if (!hueco) return;

  const { elements, files, report } = legacyToScene(fila.editorConfig);
  const escena = JSON.stringify({ elements, appState: { viewBackgroundColor: '#f5f5f5' }, files });

  const idLegacy = randomUUID();
  const idExcal = randomUUID();
  const corto = fila.id.slice(0, 8);
  const nombreLegacy = `[legacy] ${corto} · ${report.pages}p · ${report.tier}`;
  const nombreExcal = `[excalidraw] ${corto} · ${report.pages}p · ${report.tier}`;

  const ins = (id: string, nombre: string, cfg: string, formato: string | null) =>
    'INSERT INTO designs (id, name, editorConfig, pages, createdBy, projectId, spaceId, template, "desc", format, createdAt, updatedAt) VALUES (' +
    `${q(id)}, ${q(nombre)}, ${q(cfg)}, ${fila.pages ?? report.pages}, ${q(OWNER)}, ${q(DESTINO)}, ${q(SPACE)}, 0, ${q('origen: ' + fila.id)}, ${q(formato)}, ${q(NOW)}, ${q(NOW)});`;

  sql.push('', `-- ${corto} → ${hueco.dia}  (${report.tier}, ${report.pages} pág.)`);
  sql.push(ins(idLegacy, nombreLegacy, fila.editorConfig, 'legacy'));
  sql.push(ins(idExcal, nombreExcal, escena, 'excalidraw'));
  // Se engancha la copia LEGACY: así el contenido abre igual que hoy y el
  // gemelo convertido se prueba con el swap de una línea (ver informe).
  sql.push(
    `UPDATE content SET designId=${q(idLegacy)}, pages=${fila.pages ?? report.pages}, updatedAt=${q(NOW)} WHERE id=${q(hueco.id)};`,
  );

  informe.push({
    origen: fila.id,
    dia: hueco.dia,
    contenido: hueco.id,
    tier: report.tier,
    paginas: report.pages,
    capas: report.counts,
    limpio: report.clean,
    notas: report.notes.map((n) => `p${n.page}/${n.kind}: ${n.detail}`),
    idLegacy,
    idExcal,
    bytesLegacy: fila.editorConfig.length,
    bytesExcal: escena.length,
  });
});

writeFileSync(`${SP}/migracion.sql`, sql.join('\n') + '\n', 'utf8');
writeFileSync(`${SP}/informe-migracion.json`, JSON.stringify(informe, null, 1), 'utf8');

console.log(DRY ? '— DRY RUN, no se ha aplicado nada —\n' : '');
for (const r of informe) {
  console.log(
    `${r.origen.slice(0, 8)} → ${r.dia.padEnd(7)} ${r.tier}  ${String(r.paginas)}p  ` +
      `${JSON.stringify(r.capas)}  legacy ${r.bytesLegacy}B → excal ${r.bytesExcal}B  ` +
      (r.limpio ? 'limpio' : `${r.notas.length} nota(s)`),
  );
  for (const n of r.notas) console.log(`      ${n}`);
}
const totL = informe.reduce((a, r) => a + r.bytesLegacy, 0);
const totE = informe.reduce((a, r) => a + r.bytesExcal, 0);
console.log(`\n${informe.length} pares · ${informe.filter((r) => r.limpio).length} limpios`);
console.log(`peso total: legacy ${totL} B → excalidraw ${totE} B (x${(totE / totL).toFixed(1)})`);
