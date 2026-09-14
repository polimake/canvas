/**
 * Copia los proyectos de producción a sus gemelos del Sample Space, convirtiendo
 * los diseños de polimake-canvas a canvas2 (Excalidraw).
 *
 * Generaliza el script de un solo proyecto: ahora son cinco pares y el alcance
 * ya no es "solo lo que tiene diseño", sino TODO el contenido del último año.
 *
 * Alcance
 *   · contenidos con `timeupload` dentro del último año, tengan diseño o no
 *   · de cada uno: copy, fecha, tipo, estado, tags, enlace simple y el diseño
 *     convertido; para los que no tienen diseño, `thumbnail` (una URL externa)
 *     es lo único que los hace visibles, así que sí viaja
 *   · comentarios, feedback, docs y assets de publicación NO viajan
 *
 * Lo que NUNCA viaja, y por qué
 *   · `mediaProjectId` / `libraryId` — compartir librería significa que borrar
 *     una foto en el sandbox la borra en la del cliente. Misma decisión que ya
 *     tomó `duplicateProject` en el backend.
 *   · los IDs de media (`thumbnailMediaFileId`, `videoMediaFileId`,
 *     `publicationMediaFileId`) — un ID es un asa por la que el sandbox podría
 *     acabar escribiendo en la librería del cliente. Las URLs resueltas del
 *     mismo material sí viajan: son lectura y no tienen asa.
 *   · `public_tokens` — son enlaces vivos compartidos con clientes.
 *   · el workflow — el destino ya tiene el suyo, y sin acciones (verificado:
 *     0 acciones en los cinco). Copiarlo podría arrastrar un `instagram_publish`
 *     y convertir un arrastre de tarjeta en una publicación real.
 *
 * Idempotencia: relee el destino antes de generar. Un diseño ya copiado se
 * reconoce por `designs.desc = 'copia de <idOrigen>'`; un contenido sin diseño,
 * por la terna fecha+tipo+copy. Volver a ejecutar no duplica nada — importa
 * porque Paella ya está migrado a medias y el resto no.
 *
 * Emite SQL troceado + rollback (por ID, nunca `WHERE project=`, que se llevaría
 * por delante los calendarios que ya viven en el destino) + manifiesto + los
 * scripts de copia de miniaturas. No escribe en la base de datos.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { legacyToScene } from '../../src/converters/legacy';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

/** Directorio de trabajo: volcados de entrada y SQL de salida. */
const SP = arg('sp');
/** Pares origen→destino, tal como los emite `sandbox-new-projects.ts`. */
const PARES_JSON = arg('pares');

if (!SP || !PARES_JSON) {
  console.error('faltan --sp=<directorio> y/o --pares=<pares.json>');
  process.exit(1);
}

const DESTINO_SPACE = arg('space') ?? 'c26a8b61-3da8-45ea-b888-4cad00c00a0e';
const OWNER = arg('owner') ?? 'usr_2ed033dba4e4ded6728894e0114474ea';
const NOW = arg('now') ?? new Date().toISOString();
/** Tope por fichero SQL: `wrangler d1 execute --file` se atraganta con blobs enormes. */
const MAX_SQL_BYTES = 3_500_000;

interface Par {
  slug: string;
  nombre: string;
  origen: string;
  destino: string;
}

const PARES: Par[] = JSON.parse(readFileSync(PARES_JSON, 'utf8'));

interface Fila {
  contentId: string;
  copy: string | null;
  timeupload: string | null;
  typecontent: string | null;
  status: string | null;
  pages: number | null;
  thumbnail: string | null;
  tags: string | null;
  simpleLink: string | null;
  videoUrl: string | null;
  videoPosterKey: string | null;
  videoHlsUrl: string | null;
  videoSpriteUrl: string | null;
  videoFilename: string | null;
  videoMimeType: string | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoDurationSec: number | null;
  designId: string | null;
  designName: string | null;
  designPages: number | null;
  editorConfig: string | null;
}

const q = (s: unknown) =>
  s === null || s === undefined || s === '' ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
const qn = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? String(n) : 'NULL');

/** Lee la salida `--json` de wrangler, que antepone líneas de log al array. */
function leerWrangler(archivo: string): Record<string, unknown>[] {
  if (!existsSync(archivo)) return [];
  const raw = readFileSync(archivo, 'utf8');
  const parsed = JSON.parse(raw.slice(raw.indexOf('[')));
  return parsed[0]?.results ?? [];
}

/**
 * Huella de un contenido sin diseño. Incluye tipo y miniatura además de la
 * fecha porque en un mismo día conviven varias piezas con `copy` vacío: solo
 * con fecha+copy se descartarían piezas distintas creyéndolas repetidas.
 */
const huella = (project: string, f: Pick<Fila, 'timeupload' | 'typecontent' | 'copy' | 'thumbnail'>) =>
  createHash('sha1')
    .update([project, f.timeupload ?? '', f.typecontent ?? '', f.copy ?? '', f.thumbnail ?? ''].join('\u0000'))
    .digest('hex');

// ── Estado actual del destino ────────────────────────────────────────────────
const yaCopiado = new Set<string>(); // designIds de origen ya migrados
for (const d of leerWrangler(`${SP}/destino-designs.json`)) {
  const desc = String(d.desc ?? '');
  if (desc.startsWith('copia de ')) yaCopiado.add(desc.slice('copia de '.length).trim());
}
const huellasDestino = new Set<string>();
for (const c of leerWrangler(`${SP}/destino-content.json`)) {
  huellasDestino.add(
    huella(String(c.project), {
      timeupload: (c.timeupload as string) ?? null,
      typecontent: (c.typecontent as string) ?? null,
      copy: (c.copy as string) ?? null,
      thumbnail: null,
    }),
  );
}

/** Estados del workflow destino, para no dejar contenido en una columna inexistente. */
const estados = new Map<string, { validos: Set<string>; inicial: string }>();
for (const p of leerWrangler(`${SP}/destino-workflows.json`)) {
  const wf = JSON.parse(String(p.workflow ?? '{}')) as { states?: { name: string; order?: number }[] };
  const lista = [...(wf.states ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  estados.set(String(p.id), {
    validos: new Set(lista.map((s) => s.name)),
    inicial: lista[0]?.name ?? 'Borrador',
  });
}

interface Entrada {
  proyecto: string;
  contenidoOrigen: string;
  contenidoDestino: string;
  disenoOrigen: string | null;
  disenoDestino: string | null;
  tier: string | null;
  paginas: number;
  limpio: boolean;
  estadoOriginal: string | null;
  estadoFinal: string | null;
  notas: string[];
}

const informe: Entrada[] = [];
const rollback: string[] = ['-- Rollback: borra SOLO las filas creadas por esta copia, por ID.'];
const thumbs: { from: string; to: string }[] = [];
const resumen: Record<string, Record<string, number>> = {};

for (const par of PARES) {
  const origen = `${SP}/origen-${par.slug}.json`;
  if (!existsSync(origen)) {
    console.log(`· ${par.nombre}: sin volcado (${origen}), se salta`);
    continue;
  }
  const filas: Fila[] = JSON.parse(readFileSync(origen, 'utf8'));
  filas.sort((a, b) => String(a.timeupload).localeCompare(String(b.timeupload)));

  const wf = estados.get(par.destino);
  const cuenta = { total: filas.length, nuevos: 0, saltados: 0, conDiseno: 0, sinDiseno: 0, fallidos: 0, estadoReubicado: 0 };
  const sql: string[] = [`-- ${par.nombre}: ${par.origen} → ${par.destino}. Origen en solo lectura.`];

  for (const fila of filas) {
    const tieneDiseno = Boolean(fila.designId && fila.editorConfig);

    // ── Deduplicación ──
    if (tieneDiseno && yaCopiado.has(String(fila.designId))) {
      cuenta.saltados += 1;
      continue;
    }
    if (!tieneDiseno && huellasDestino.has(huella(par.destino, fila))) {
      cuenta.saltados += 1;
      continue;
    }

    const nuevoContenido = randomUUID();
    let nuevoDiseno: string | null = null;
    let tier: string | null = null;
    let limpio = true;
    let notas: string[] = [];
    let paginas = fila.pages ?? 1;

    if (tieneDiseno) {
      try {
        const { elements, files, report } = legacyToScene(fila.editorConfig as string);
        const escena = JSON.stringify({ elements, appState: { viewBackgroundColor: '#f5f5f5' }, files });
        nuevoDiseno = randomUUID();
        tier = report.tier;
        limpio = report.clean;
        notas = report.notes.map((n) => `p${n.page}/${n.kind}: ${n.detail}`);
        paginas = fila.designPages ?? fila.pages ?? report.pages;

        sql.push(
          '',
          `-- ${fila.contentId} · ${tier} · ${paginas} pág.`,
          'INSERT INTO designs (id, name, editorConfig, pages, createdBy, projectId, spaceId, template, "desc", format, createdAt, updatedAt) VALUES (' +
            `${q(nuevoDiseno)}, ${q(fila.designName ?? 'Diseño')}, ${q(escena)}, ${qn(paginas)}, ${q(OWNER)}, ` +
            `${q(par.destino)}, ${q(DESTINO_SPACE)}, 0, ${q('copia de ' + fila.designId)}, 'excalidraw', ${q(NOW)}, ${q(NOW)});`,
        );
        rollback.push(`DELETE FROM designs WHERE id=${q(nuevoDiseno)};`);
        for (let page = 0; page < paginas; page += 1) {
          thumbs.push({
            from: `design/${par.origen}/design-preview/${fila.designId}/${page}.webp`,
            to: `design/${par.destino}/design-preview/${nuevoDiseno}/${page}.webp`,
          });
        }
        cuenta.conDiseno += 1;
      } catch (e) {
        // Un diseño que no convierte no debe tumbar la migración entera: la pieza
        // viaja sin lienzo y queda anotada para revisarla a mano.
        cuenta.fallidos += 1;
        notas = [`conversión fallida: ${e instanceof Error ? e.message : String(e)}`];
        limpio = false;
        nuevoDiseno = null;
        paginas = 1;
      }
    } else {
      cuenta.sinDiseno += 1;
    }

    // Un estado que no existe en el workflow destino dejaría la tarjeta fuera de
    // toda columna del Kanban. NULL se respeta: en producción significa "sin estado".
    let estadoFinal = fila.status;
    if (estadoFinal && wf && !wf.validos.has(estadoFinal)) {
      estadoFinal = wf.inicial;
      cuenta.estadoReubicado += 1;
    }

    // `thumbnail` solo para las piezas sin diseño: con diseño el calendario deriva
    // la URL de projectId+designId y el campo es inerte, así que copiarlo únicamente
    // dejaría un puntero al proyecto de producción.
    sql.push(
      'INSERT INTO content (id, contentid, project, typecontent, status, copy, timeupload, thumbnail, pages, designId, tags, simpleLink, videoUrl, videoPosterKey, videoHlsUrl, videoSpriteUrl, videoFilename, videoMimeType, videoWidth, videoHeight, videoDurationSec, thumbVersion, createdAt, updatedAt) VALUES (' +
        `${q(nuevoContenido)}, ${q(nuevoContenido)}, ${q(par.destino)}, ${q(fila.typecontent)}, ${q(estadoFinal)}, ` +
        `${q(fila.copy)}, ${q(fila.timeupload)}, ${nuevoDiseno ? 'NULL' : q(fila.thumbnail)}, ${qn(paginas)}, ${q(nuevoDiseno)}, ` +
        `${q(fila.tags)}, ${q(fila.simpleLink)}, ${q(fila.videoUrl)}, ${q(fila.videoPosterKey)}, ${q(fila.videoHlsUrl)}, ` +
        `${q(fila.videoSpriteUrl)}, ${q(fila.videoFilename)}, ${q(fila.videoMimeType)}, ${qn(fila.videoWidth)}, ` +
        `${qn(fila.videoHeight)}, ${qn(fila.videoDurationSec)}, ${Date.parse(NOW)}, ${q(NOW)}, ${q(NOW)});`,
    );
    rollback.push(`DELETE FROM content WHERE id=${q(nuevoContenido)};`);

    informe.push({
      proyecto: par.nombre,
      contenidoOrigen: fila.contentId,
      contenidoDestino: nuevoContenido,
      disenoOrigen: fila.designId ?? null,
      disenoDestino: nuevoDiseno,
      tier,
      paginas,
      limpio,
      estadoOriginal: fila.status,
      estadoFinal: estadoFinal ?? null,
      notas,
    });
    cuenta.nuevos += 1;
  }

  // Troceado por tamaño: cada fichero entra entero en `wrangler d1 execute --file`.
  let parte = 1;
  let buffer: string[] = [];
  let bytes = 0;
  const volcar = () => {
    if (!buffer.length) return;
    writeFileSync(`${SP}/copia-${par.slug}.${String(parte).padStart(2, '0')}.sql`, buffer.join('\n') + '\n', 'utf8');
    parte += 1;
    buffer = [];
    bytes = 0;
  };
  for (const linea of sql) {
    if (bytes + linea.length > MAX_SQL_BYTES && buffer.length) volcar();
    buffer.push(linea);
    bytes += linea.length + 1;
  }
  volcar();

  resumen[par.nombre] = { ...cuenta, ficheros: parte - 1 };
}

writeFileSync(`${SP}/copia.rollback.sql`, rollback.join('\n') + '\n', 'utf8');
writeFileSync(`${SP}/copia.informe.json`, JSON.stringify(informe, null, 1), 'utf8');
writeFileSync(`${SP}/copia.thumbs.json`, JSON.stringify(thumbs), 'utf8');

// ── Copia de miniaturas ──────────────────────────────────────────────────────
// El bucket se sirve público, así que la lectura es un GET normal y solo la
// escritura necesita wrangler: la mitad de procesos que con `r2 object get`.
// Se reparte en turnos para poder lanzarlos en paralelo; es lo que domina el
// reloj (≈1 proceso por objeto).
const TURNOS = 6;
const CDN = 'https://pub-6f8de2fba505476e832e9c5bcb1ab230.r2.dev';
for (let t = 0; t < TURNOS; t += 1) {
  const mios = thumbs.filter((_, i) => i % TURNOS === t);
  const sh = [
    '#!/usr/bin/env bash',
    `# Turno ${t + 1}/${TURNOS} — ${mios.length} miniaturas.`,
    '# Sin esto las piezas con diseño salen SIN imagen: la URL se deriva de',
    '# projectId + designId, no del campo `thumbnail`.',
    'set -u',
    'cd "/c/Users/OliSR/Desktop/studio/apps/server" || exit 1',
    `T="$(mktemp -d)"`,
    'ok=0; fail=0',
    ...mios.flatMap(({ from, to }, i) => [
      `if curl -fsS "${CDN}/${from}" -o "$T/t.webp" 2>/dev/null; then`,
      `  npx wrangler r2 object put "plan-images/${to}" --remote --file "$T/t.webp" --content-type image/webp >/dev/null 2>&1 && ok=$((ok+1)) || fail=$((fail+1))`,
      // Una página sin miniatura en origen no es un fallo: el diseño puede no
      // haberse abierto nunca desde que existe el render de previews.
      `else fail=$((fail+1)); fi`,
      // El contador es el índice de JavaScript, ya resuelto: dentro del `.sh` no
      // existe ninguna variable de bucle, y con `set -u` una referencia a `$i`
      // aborta el turno entero en el primer punto de control.
      ...(i % 25 === 24 ? [`echo "  turno ${t + 1}: ${i + 1}/${mios.length} · ok=$ok fail=$fail"`] : []),
    ]),
    'rm -rf "$T"',
    `echo "turno ${t + 1} terminado: ok=$ok fail=$fail"`,
  ].join('\n');
  writeFileSync(`${SP}/thumbs-turno-${t + 1}.sh`, sh, 'utf8');
}

console.log(`pares: ${PARES.length} · contenidos nuevos: ${informe.length} · miniaturas: ${thumbs.length}`);
console.table(resumen);
const sucios = informe.filter((e) => !e.limpio);
console.log(`con notas: ${sucios.length}`);
for (const e of sucios.slice(0, 10)) console.log(`  ${e.proyecto} ${e.contenidoOrigen}: ${e.notas.join(' | ')}`);
if (sucios.length > 10) console.log(`  … y ${sucios.length - 10} más`);
