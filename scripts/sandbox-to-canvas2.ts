/**
 * Pasa TODO el Sample Space a canvas2, con la tipografía real, y borra los
 * diseños legacy que queden dentro del sandbox.
 *
 * QUÉ HACE DISTINTO A LAS MIGRACIONES ANTERIORES
 *
 * `migrate-projects-to-sandbox.ts` ya convirtió 491 diseños, pero con un
 * convertidor que tiraba las fuentes: todo el texto acabó en la familia 2
 * (Helvetica de Excalidraw) y los diseños del cliente perdieron su identidad.
 * Ahora `legacyToScene` sabe registrar tipografías propias (ver `fonts.ts`), así
 * que esos 491 hay que RECONVERTIRLOS desde su original de producción, no
 * simplemente dejarlos.
 *
 * Por eso hay dos caminos:
 *   · fila del sandbox ya en `format='excalidraw'` → se REESCRIBE su
 *     `editorConfig` in situ. No cambia el id, así que ni los contenidos ni las
 *     miniaturas de R2 se mueven. Es lo mismo que hacía `reconvert-designs.ts`.
 *   · fila del sandbox aún legacy → se INSERTA su gemelo canvas2, se repunta
 *     `content.designId` y se BORRA la fila legacy.
 *
 * DE DÓNDE SALE LA TIPOGRAFÍA, en este orden:
 *   1. el propio diseño: la capa de texto guarda `fonts[].url` (clave `w`, `y`)
 *   2. el brand kit del proyecto de ORIGEN (el del cliente, no la copia: las
 *      copias del sandbox no tienen brand kit propio)
 *   3. la lista curada de Google Fonts de `packages/canvas`, por nombre de
 *      estilo ("Inter Bold") o de familia ("Inter")
 * Lo que no se resuelve por ninguna de las tres se anota en el informe con
 * nombre y diseño, que es lo que permite arreglarlo desde el brand kit.
 *
 * SEGURIDAD
 *
 * El único DELETE que se emite lleva `AND spaceId='<sandbox>'` aunque el id ya
 * venga filtrado por el volcado: es una base de datos de producción compartida
 * con el espacio real de clientes, y un id mal copiado no puede tener como peor
 * consecuencia borrar un diseño vivo. Por el mismo motivo el rollback recrea la
 * fila legacy entera, no solo el repunte.
 *
 * NO ESCRIBE EN LA BASE DE DATOS. Emite:
 *   <salida>.sql            los UPDATE/INSERT/DELETE, troceados si hacen falta
 *   <salida>.rollback.sql   la vuelta atrás
 *   <salida>.informe.json   qué se convirtió, con qué fuentes y qué se perdió
 *
 * Uso:
 *   npx tsx packages/canvas2/scripts/sandbox-to-canvas2.ts <dirVolcados> [--aplicar-no]
 * Los volcados se generan con `dump-sandbox.mjs` (mismo directorio).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { legacyToScene, type FontSource } from '../src/legacy';
import { HARDCODED_FONTS } from '../../canvas/src/image/fonts/hardcoded-fonts';

const SANDBOX_SPACE = 'c26a8b61-3da8-45ea-b888-4cad00c00a0e';
const OWNER = 'usr_2ed033dba4e4ded6728894e0114474ea';
const NOW = new Date('2026-07-30T10:00:00.000Z').toISOString();
/** Tope por fichero: `wrangler d1 execute --file` se atraganta con blobs enormes. */
const MAX_SQL_BYTES = 3_500_000;

const DIR = process.argv[2];
if (!DIR) {
  console.error('uso: sandbox-to-canvas2.ts <dirVolcados>');
  process.exit(1);
}
const SALIDA = path.join(DIR, 'sandbox-canvas2');

const q = (s: unknown) =>
  s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
const qn = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? String(n) : 'NULL');

/**
 * Texto seguro para un comentario `--`.
 *
 * Un `--` comenta HASTA EL FIN DE LÍNEA, así que un salto de línea dentro del
 * nombre de un diseño saca el resto del comentario a la luz y D1 intenta
 * ejecutarlo ("near 'Aquí': syntax error"). Pasa de verdad: varios diseños se
 * llaman con la primera frase del copy, que viene con saltos.
 */
const comentario = (s: unknown) =>
  String(s ?? '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 80);

/** Lee la salida `--json` de wrangler, que antepone líneas de log al array. */
function leer(nombre: string): Record<string, unknown>[] {
  const archivo = path.join(DIR, nombre);
  if (!existsSync(archivo)) {
    console.error(`falta el volcado ${nombre}; ejecuta antes dump-sandbox.mjs`);
    process.exit(1);
  }
  const raw = readFileSync(archivo, 'utf8');
  const parsed = JSON.parse(raw.slice(raw.indexOf('[')));
  return parsed.flatMap((p: { results?: Record<string, unknown>[] }) => p.results ?? []);
}

// ─── Tipografías: los tres orígenes, de más específico a más genérico ─────────

/** Nombre → fichero, a partir de la lista curada de Google Fonts. */
const curadas = new Map<string, FontSource>();
for (const familia of HARDCODED_FONTS) {
  for (const estilo of familia.styles ?? []) {
    if (!estilo?.url) continue;
    const fuente: FontSource = {
      url: estilo.url,
      style: estilo.style && estilo.style !== 'regular' ? estilo.style : undefined,
    };
    // Por nombre de estilo ("Inter Bold") y, la primera, también por familia.
    if (estilo.name) curadas.set(estilo.name.toLowerCase(), fuente);
    if (!curadas.has(familia.family.toLowerCase())) {
      curadas.set(familia.family.toLowerCase(), fuente);
    }
  }
}

/** Fuentes declaradas en el brand kit de un proyecto de origen. */
function fuentesDeMarca(brandKit: unknown): Map<string, FontSource> {
  const salida = new Map<string, FontSource>();
  if (!brandKit || typeof brandKit !== 'object') return salida;
  for (const clave of ['headingFont', 'bodyFont'] as const) {
    const valor = (brandKit as Record<string, unknown>)[clave];
    if (!valor || typeof valor !== 'object') continue;
    const o = valor as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    if (!/^https?:\/\//i.test(url)) continue;
    const estilo = typeof o.style === 'string' && o.style !== 'regular' ? o.style : undefined;
    for (const nombre of [o.name, o.family]) {
      if (typeof nombre === 'string' && nombre.trim()) {
        salida.set(nombre.trim().toLowerCase(), { url, style: estilo });
      }
    }
  }
  return salida;
}

/** Se anota lo que no se pudo resolver, por diseño, para poder arreglarlo. */
const sinResolver = new Map<string, Set<string>>();

function resolvedorPara(marca: Map<string, FontSource>, designId: string) {
  return (nombre: string): FontSource | null => {
    const clave = nombre.toLowerCase();
    const hallado =
      marca.get(clave) ??
      curadas.get(clave) ??
      // "Canva Sans Regular" no está, pero "Canva Sans" quizá sí: se prueba
      // quitando el sufijo de estilo, que es como los nombra el editor legacy.
      curadas.get(clave.replace(/\s+(regular|bold|italic|light|medium|black)$/i, '')) ??
      null;
    if (!hallado) {
      if (!sinResolver.has(designId)) sinResolver.set(designId, new Set());
      sinResolver.get(designId)!.add(nombre);
    }
    return hallado;
  };
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

interface DisenoSandbox {
  id: string;
  name: string | null;
  pages: number | null;
  format: string | null;
  desc: string | null;
  projectId: string;
  spaceId: string | null;
  editorConfig: string | null;
}

/** Brand kit del proyecto de ORIGEN, indexado por proyecto del sandbox. */
const marcaPorProyecto = new Map<string, Map<string, FontSource>>();
for (const p of leer('origin-brandkits.json') as unknown as Array<{
  sandboxProjectId: string;
  brandKit: string | null;
}>) {
  let bk: unknown = null;
  try {
    bk = p.brandKit ? JSON.parse(p.brandKit) : null;
  } catch {
    bk = null;
  }
  marcaPorProyecto.set(p.sandboxProjectId, fuentesDeMarca(bk));
}

const disenos = leer('sandbox-designs.json') as unknown as DisenoSandbox[];
/** `editorConfig` legacy de origen, por id de diseño de origen. */
const origenes = new Map<string, string>();
for (const o of leer('origin-configs.json') as unknown as Array<{
  id: string;
  editorConfig: string;
}>) {
  origenes.set(o.id, o.editorConfig);
}

/** El id del original de producción, tal y como lo dejaron las migraciones. */
function idDeOrigen(desc: string | null): string | null {
  if (!desc) return null;
  for (const prefijo of ['copia de ', 'canvas2 · convertido de ']) {
    if (desc.startsWith(prefijo)) return desc.slice(prefijo.length).trim();
  }
  return null;
}

/** `content.id` que apunta a cada diseño, para poder repuntar y revertir. */
const contenidoPorDiseno = new Map<string, string>();
for (const c of leer('sandbox-content.json') as unknown as Array<{
  id: string;
  designId: string;
}>) {
  if (c.designId) contenidoPorDiseno.set(c.designId, c.id);
}

// ─── Conversión ──────────────────────────────────────────────────────────────

interface Entrada {
  diseno: string;
  proyecto: string;
  via: 'reescrito' | 'insertado';
  origen: string | null;
  tier: string;
  paginas: number;
  fuentes: string[];
  sinFuente: string[];
  perdidas: string[];
  bytes: number;
}

const sql: string[] = [
  '-- Sample Space → canvas2 con tipografía real.',
  `-- Generado ${NOW}. Solo toca filas del espacio ${SANDBOX_SPACE}.`,
];
const rollback: string[] = ['-- Vuelta atrás de sandbox-to-canvas2.'];
const informe: Entrada[] = [];
let saltados = 0;
let nativos = 0;

/**
 * ¿Este `editorConfig` es ya una escena de canvas2 y no un árbol legacy?
 *
 * Pasa con los diseños NACIDOS en canvas2 (un carrusel hecho a mano y sus
 * copias, que se marcan `desc='origen: <id>'`): no tienen antepasado legacy, así
 * que no hay nada que reconvertir y tocarlos solo podría estropearlos.
 */
function esEscenaCanvas2(cfg: string | null): boolean {
  if (!cfg) return false;
  try {
    const v = JSON.parse(cfg);
    return !!v && !Array.isArray(v) && Array.isArray(v.elements);
  } catch {
    return false;
  }
}

for (const d of disenos.sort((a, b) => a.id.localeCompare(b.id))) {
  if (d.spaceId && d.spaceId !== SANDBOX_SPACE) {
    // No debería llegar aquí: el volcado ya filtra. Es la segunda barrera.
    console.error(`SALTADO ${d.id}: spaceId=${d.spaceId} no es el sandbox`);
    saltados += 1;
    continue;
  }

  const origen = idDeOrigen(d.desc);
  // De dónde se lee el legacy: del original de producción si esta fila ya es
  // una copia convertida, o de ella misma si todavía es legacy.
  const legacy = origen ? origenes.get(origen) : d.editorConfig;
  if (!legacy) {
    console.error(`SALTADO ${d.id}: sin editorConfig legacy de partida (origen=${origen ?? '—'})`);
    saltados += 1;
    continue;
  }
  if (esEscenaCanvas2(legacy)) {
    // Nació en canvas2: ya está donde tiene que estar.
    nativos += 1;
    continue;
  }

  const resolver = resolvedorPara(marcaPorProyecto.get(d.projectId) ?? new Map(), d.id);
  const { elements, files, fonts, report } = legacyToScene(legacy, { resolveFontUrl: resolver });

  const escena = JSON.stringify({
    elements,
    appState: { viewBackgroundColor: '#f5f5f5' },
    files,
    // Las tipografías viajan CON el diseño: así se ve igual aunque el brand kit
    // del proyecto cambie después. Ver `fonts.ts`.
    ...(fonts.length ? { fonts } : {}),
  });
  const paginas = report.pages || d.pages || 1;

  const comun = {
    diseno: d.id,
    proyecto: d.projectId,
    origen,
    tier: report.tier,
    paginas,
    fuentes: fonts.map((f) => f.family),
    sinFuente: [...(sinResolver.get(d.id) ?? [])],
    perdidas: report.notes.map((n) => `p${n.page}/${n.kind}: ${n.detail}`),
    bytes: escena.length,
  };

  if (d.format === 'excalidraw') {
    // Ya es canvas2: solo se reescribe la escena. Id, contenidos y miniaturas
    // se quedan donde están.
    sql.push('', `-- ${d.id} (${comentario(d.name) || 'sin nombre'}) · reconversión ${report.tier} ${paginas}p`);
    sql.push(
      `UPDATE designs SET editorConfig=${q(escena)}, pages=${qn(paginas)}, ` +
        `updatedAt=${q(NOW)} WHERE id=${q(d.id)} AND spaceId=${q(SANDBOX_SPACE)};`,
    );
    // Revertir es reponer el `editorConfig` anterior; se guarda tal cual estaba.
    rollback.push(
      `UPDATE designs SET editorConfig=${q(d.editorConfig)}, pages=${qn(d.pages)} ` +
        `WHERE id=${q(d.id)} AND spaceId=${q(SANDBOX_SPACE)};`,
    );
    informe.push({ ...comun, via: 'reescrito' });
    continue;
  }

  // Sigue siendo legacy: gemelo canvas2, repunte y borrado del original.
  const nuevoId = randomUUID();
  const contenido = contenidoPorDiseno.get(d.id) ?? null;

  sql.push('', `-- ${d.id} → ${nuevoId} · ${report.tier} ${paginas}p (legacy, se borra)`);
  sql.push(
    'INSERT INTO designs (id, name, editorConfig, pages, createdBy, projectId, spaceId, template, "desc", format, createdAt, updatedAt) VALUES (' +
      `${q(nuevoId)}, ${q(d.name ?? 'Diseño')}, ${q(escena)}, ${qn(paginas)}, ${q(OWNER)}, ` +
      `${q(d.projectId)}, ${q(SANDBOX_SPACE)}, 0, ${q('canvas2 · convertido de ' + (origen ?? d.id))}, ` +
      `'excalidraw', ${q(NOW)}, ${q(NOW)});`,
  );
  if (contenido) {
    sql.push(`UPDATE content SET designId=${q(nuevoId)}, updatedAt=${q(NOW)} WHERE id=${q(contenido)};`);
  }
  // El borrado va DESPUÉS del repunte: si la ejecución se corta a medias, el
  // contenido nunca queda apuntando a una fila que ya no existe.
  sql.push(`DELETE FROM designs WHERE id=${q(d.id)} AND spaceId=${q(SANDBOX_SPACE)};`);

  rollback.push(
    'INSERT INTO designs (id, name, editorConfig, pages, createdBy, projectId, spaceId, template, "desc", format, createdAt, updatedAt) VALUES (' +
      `${q(d.id)}, ${q(d.name)}, ${q(d.editorConfig)}, ${qn(d.pages)}, ${q(OWNER)}, ` +
      `${q(d.projectId)}, ${q(SANDBOX_SPACE)}, 0, ${q(d.desc)}, ${q(d.format)}, ${q(NOW)}, ${q(NOW)});`,
  );
  if (contenido) rollback.push(`UPDATE content SET designId=${q(d.id)} WHERE id=${q(contenido)};`);
  rollback.push(`DELETE FROM designs WHERE id=${q(nuevoId)} AND spaceId=${q(SANDBOX_SPACE)};`);

  informe.push({ ...comun, via: 'insertado' });
}

// ─── Salida ──────────────────────────────────────────────────────────────────

/** Trocea por sentencias completas: partir un INSERT por la mitad no se ejecuta. */
function trocear(lineas: string[], base: string): string[] {
  const ficheros: string[] = [];
  let buffer: string[] = [];
  let bytes = 0;
  let parte = 1;
  const volcar = () => {
    if (!buffer.length) return;
    const nombre = `${base}.${String(parte).padStart(2, '0')}.sql`;
    writeFileSync(nombre, buffer.join('\n') + '\n', 'utf8');
    ficheros.push(nombre);
    parte += 1;
    buffer = [];
    bytes = 0;
  };
  for (const linea of lineas) {
    if (bytes + linea.length > MAX_SQL_BYTES) volcar();
    buffer.push(linea);
    bytes += linea.length + 1;
  }
  volcar();
  return ficheros;
}

const ficheros = trocear(sql, SALIDA);
writeFileSync(`${SALIDA}.rollback.sql`, rollback.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.informe.json`, JSON.stringify(informe, null, 1), 'utf8');

const conFuente = informe.filter((e) => e.fuentes.length).length;
const faltantes = new Set(informe.flatMap((e) => e.sinFuente));

console.log(`diseños procesados: ${informe.length} (nativos intactos: ${nativos}, saltados: ${saltados})`);
console.log(`  reescritos in situ: ${informe.filter((e) => e.via === 'reescrito').length}`);
console.log(`  insertados + legacy borrado: ${informe.filter((e) => e.via === 'insertado').length}`);
console.log(`con tipografía propia: ${conFuente}/${informe.length}`);
if (faltantes.size) {
  console.log(`fuentes sin fichero (${faltantes.size}): ${[...faltantes].sort().join(', ')}`);
}
console.log(`\nsql: ${ficheros.join('\n     ')}`);
console.log(`rollback: ${SALIDA}.rollback.sql`);
console.log(`informe: ${SALIDA}.informe.json`);
