/**
 * Diseña en canvas2 el contenido de octubre que estaba sin diseño.
 *
 * QUÉ CRITERIO SIGUE
 *
 * El copy ya estaba escrito, así que aquí NO se inventa texto de marketing: el
 * titular sale siempre de la primera línea del propio copy de la pieza. La única
 * decisión creativa es la composición.
 *
 * Y hay una distinción que importa más que ninguna otra: en estos calendarios,
 * el `copy` de muchas stories NO es un pie de foto, es un BRIEF de producción
 * ("Foto de la carta de esta semana", "Enlace directo de reserva", "Plato de la
 * semana en primer plano. Sin texto de más"). Estampar esa frase sobre la
 * imagen sería publicar la instrucción en vez de la pieza. Por eso cada pieza
 * declara su arquetipo a mano (`PLAN`) y los briefs se resuelven con una
 * composición limpia y, como mucho, un CTA corto — que es justo lo que el brief
 * pide.
 *
 * TIPOGRAFÍA
 *
 * Se usa la del brand kit siempre que exista fichero. Tres marcas usan fuentes
 * comerciales que no están en ninguna parte accesible ('Circular', 'The
 * Seasons', 'Jhon Halend'): ahí se sustituye por la Google más cercana y se
 * DECLARA en el informe, en vez de fingir que es la de marca.
 *
 * IMÁGENES
 *
 * Siempre por referencia a MediaMonster (nunca bytes en el diseño). Aldea Los
 * Odres y Barbecho no tienen librería accesible, así que van con composición
 * tipográfica sobre color de marca.
 *
 * NO ESCRIBE EN LA BASE DE DATOS: emite SQL + rollback + informe.
 *
 * Uso: npx tsx packages/canvas2/scripts/design-october.ts <dirVolcados>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const SANDBOX_SPACE = 'c26a8b61-3da8-45ea-b888-4cad00c00a0e';
const OWNER = 'usr_2ed033dba4e4ded6728894e0114474ea';
const NOW = new Date('2026-07-30T12:00:00.000Z').toISOString();

const DIR = process.argv[2];
if (!DIR) {
  console.error('uso: design-october.ts <dirVolcados>');
  process.exit(1);
}

import {
  ARQUETIPOS, base, carasDe, nid,
  type Arquetipo, type Ctx, type El, type Marca, type Pieza,
} from './lib/design-system';

const MARCAS: Record<string, Marca> = {
  'Paella Power': {
    sandboxProject: '8ef87292-e993-47d8-b655-bec2e15d5d8d',
    mmProject: '1b3f4604-66cb-4454-a7d5-38f2a076fcf4',
    heading: 'DM Serif Display',
    body: 'Montserrat',
    color: '#e6b019',
    paleta: ['#e6b019', '#ca7507'],
    fondo: '#1a1206',
    tinta: '#ffffff',
    realce: '#e6b019',
  },
  'El Invernadero': {
    sandboxProject: 'aa7a4376-c815-4020-b753-851e94eec970',
    mmProject: '0b7ee41e-761b-4f95-822d-7175d26e7777',
    heading: 'Playfair Display',
    body: 'Montserrat',
    sustituye: "brand kit pide 'Jhon Halend' (titulares) y 'The Seasons' (texto); no hay fichero de ninguna",
    color: '#278F5E',
    paleta: ['#278F5E', '#946a47', '#000c24', '#ffffff'],
    fondo: '#000c24',
    tinta: '#ffffff',
    realce: '#278F5E',
  },
  Barbecho: {
    sandboxProject: '382777b3-d560-4969-9b88-ac3ecd1988aa',
    mmProject: null,
    heading: 'Lora',
    body: 'Montserrat',
    sustituye: "brand kit pide 'The Seasons'; no hay fichero",
    color: '#b67c2b',
    paleta: ['#b67c2b', '#e7ad0c', '#353435', '#ffffff'],
    fondo: '#353435',
    tinta: '#ffffff',
    realce: '#e7ad0c',
  },
  'Aldea Los Odres': {
    sandboxProject: 'f5c2e8b9-1751-4803-bfee-c75bc2d464cc',
    mmProject: null,
    heading: 'Poppins',
    body: 'Poppins',
    sustituye: "brand kit pide 'Circular'; no hay fichero (Poppins es la geométrica más cercana)",
    color: '#ee434b',
    paleta: ['#ee434b', '#fdf0e0', '#b9e0f0', '#5e4c4b', '#e7b3be'],
    fondo: '#5e4c4b',
    tinta: '#fdf0e0',
    realce: '#ee434b',
  },
  Nebular: {
    sandboxProject: '232d3ce3-4e28-42aa-b488-be23d7be7e1d',
    mmProject: '64a2871a-b4dd-45c8-80fb-7beeb07a873a',
    heading: 'Work Sans',
    body: 'Space Mono',
    color: '#3D4767',
    paleta: ['#3D4767', '#ffffff', '#bdbdbd'],
    fondo: '#3D4767',
    tinta: '#ffffff',
    realce: '#bdbdbd',
  },
};

// ─── Plan por pieza ───────────────────────────────────────────────────────────
//
// Las piezas con mediateca se planifican A MANO: qué composición y qué foto.
// La clave es `proyecto|fecha` (la fecha almacenada, no la mostrada).
// Los ids de imagen salen de búsquedas semánticas en MediaMonster.

interface Entrada {
  arq: Arquetipo;
  img?: string;
  encuadre?: number;
  kicker?: string;
  cta?: string;
  /** Sustituye al titular derivado del copy (solo para briefs). */
  titular?: string;
  cuerpo?: string[];
}

const PLAN: Record<string, Entrada> = {
  // ── El Invernadero ─────────────────────────────────────────────────────────
  'El Invernadero|2026-09-30': { arq: 'fotoTitular', img: 'aaa88a9d-cf00-4440-8af7-01c6bf377eba', kicker: 'Temporada' },
  'El Invernadero|2026-10-01': { arq: 'fotoLimpia', img: '22ded7f7-10eb-4c05-8919-33383d8a4ce0' },
  'El Invernadero|2026-10-04': { arq: 'fotoTitular', img: '210665f5-9a6b-4894-a4af-27fba263b971', kicker: 'Raiz', encuadre: 0.45 },
  'El Invernadero|2026-10-06': { arq: 'fotoLimpia', img: '2592ff66-7406-4677-a4bf-7ab92f92d25e', kicker: 'Mesa del Chef' },
  'El Invernadero|2026-10-07': { arq: 'fotoTitular', img: '7ec85f5c-2753-48ae-87f4-5cfd7f385970', kicker: 'Hongos' },
  'El Invernadero|2026-10-09': { arq: 'ctaStory', img: '1854ce19-d129-44ba-afd5-db182d9ba48d', cta: 'RESERVA', kicker: 'Fin de semana', titular: 'Disponibilidad de viernes a domingo' },
  'El Invernadero|2026-10-11': { arq: 'fotoTitular', img: '80a2ee48-a3b2-437f-b2ee-9c916e225a82', kicker: 'Producto' },
  'El Invernadero|2026-10-13': { arq: 'fotoLimpia', img: '61eccbe8-aa6d-4de0-95f9-0b12386b28c7', kicker: 'En servicio' },
  'El Invernadero|2026-10-14': { arq: 'fotoTitular', img: '57a8f61a-1050-4f59-bf75-c43961435b24', kicker: 'Origen', encuadre: 0.45 },
  'El Invernadero|2026-10-15': { arq: 'editorial', kicker: '16 de octubre', titular: 'Dia Mundial de la Alimentacion', cuerpo: ['Sostenibilidad real: producto de temporada, proveedor cercano y cero discurso.'] },
  'El Invernadero|2026-10-18': { arq: 'fotoTitular', img: '70c543ec-ec1a-41c1-b05b-5f02ecd9c126', kicker: 'Gastrobotanica' },
  'El Invernadero|2026-10-20': { arq: 'lista', kicker: 'Las dos experiencias', titular: 'Vegetalia y Gastrobotanica', cuerpo: ['Vegetalia: el vegetal en estado puro, sin producto animal.', 'Gastrobotanica: el vegetal como protagonista, con tecnica de alta cocina.'] },
  'El Invernadero|2026-10-21': { arq: 'fotoTitular', img: '3e307031-8d30-4102-a3b2-d160856aaa69', kicker: 'Fermentados' },
  'El Invernadero|2026-10-23': { arq: 'ctaStory', img: '01c709bd-5e15-4daf-970d-5c50bea430ee', cta: 'RESERVA', kicker: 'Fin de semana', titular: 'Enlace en la biografia' },
  'El Invernadero|2026-10-25': { arq: 'fotoTitular', img: '5db1343b-c224-49ec-8cc6-5485ad984724', kicker: 'Menu de otono' },
  'El Invernadero|2026-10-27': { arq: 'fotoLimpia', img: 'cda65506-4107-4cbc-b214-a9207f4de59a', kicker: 'Sala y servicio' },
  'El Invernadero|2026-10-28': { arq: 'fotoTitular', img: 'd6134398-5940-4cb8-8527-4bb3afaa4990', kicker: 'Otono' },
  'El Invernadero|2026-10-29': { arq: 'ctaStory', img: '978a559c-1135-41c6-9f9c-fa45f8459f12', cta: 'NOVIEMBRE', kicker: 'Cierre de octubre', titular: 'Disponibilidad abierta' },

  // ── Nebular ────────────────────────────────────────────────────────────────
  'Nebular|2026-10-04': { arq: 'editorial', kicker: 'Cierre de ano' },
  'Nebular|2026-10-07': { arq: 'lista', kicker: 'Checklist', titular: 'Checklist de cierre de ano' },
  'Nebular|2026-10-11': { arq: 'lista', kicker: 'Metodo', titular: 'Como trabajamos un proyecto' },
  'Nebular|2026-10-14': { arq: 'fotoLimpia', img: '6f8fed86-8f5c-4dbd-8d8d-30879e3b8a6f', kicker: 'Jornada de rodaje' },
  'Nebular|2026-10-18': { arq: 'editorial', kicker: 'Medicion' },
  'Nebular|2026-10-21': { arq: 'editorial', kicker: 'Presupuestos 2027' },
  'Nebular|2026-10-25': { arq: 'lista', kicker: 'Errores', titular: 'Tres errores al cerrar el ano' },
  'Nebular|2026-10-28': { arq: 'fotoTitular', img: '9e30dc69-45c5-4504-82b1-e0888dd7e472', kicker: 'Equipo' },

  // ── Paella Power ───────────────────────────────────────────────────────────
  'Paella Power|2026-10-30': { arq: 'ctaStory', img: '5817e0f3-1926-4bd6-8168-906a8274cf95', cta: '31 OCT', kicker: 'Sabado de Halloween', titular: 'Mercado · Centro · Fuego encendido' },
};

/** Etiqueta corta para un brief sin mediateca. Nunca se estampa el brief entero. */
function etiquetaDeBrief(copy: string): string | null {
  const c = copy.toLowerCase();
  const reglas: Array<[RegExp, string]> = [
    [/encuesta/, 'ENCUESTA'],
    [/reserva|link sticker|enlace/, 'RESERVA'],
    [/pizarra|carta de la semana|carta nueva|carta de esta semana/, 'LA CARTA'],
    [/repost|ugc|huesped|huésped/, 'GRACIAS'],
    [/ruta recomendada|ruta del mes/, 'RUTA DEL MES'],
    [/chimenea|amanece/, 'BUENOS DIAS'],
    [/pet friendly|perro|mascota/, 'PET FRIENDLY'],
    [/cambia la hora|cambio de hora/, 'CAMBIO DE HORA'],
    [/la barra|barra:/, 'LA BARRA'],
    [/cocina en vivo|manos, fuego/, 'EN VIVO'],
    [/encargo/, 'ENCARGOS'],
    [/plato de la semana/, 'PLATO DE LA SEMANA'],
    [/cena en el restaurante|cordero|cuchara/, 'CENA'],
    [/mediodia|mediodía|almuerzo/, 'MEDIODIA'],
    [/noche del 31|31 en la aldea/, '31 DE OCTUBRE'],
  ];
  for (const [re, etq] of reglas) if (re.test(c)) return etq;
  return null;
}

// ─── Generacion ───────────────────────────────────────────────────────────────

interface Fila {
  proyecto: string;
  id: string;
  timeupload: string;
  tipo: string;
  copy: string | null;
}

const q = (s: unknown) =>
  s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
const comentario = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 70);

const rawIn = readFileSync(path.join(DIR, 'plan-in.json'), 'utf8');
const filas: Fila[] = JSON.parse(rawIn.slice(rawIn.indexOf('[')))[0].results;

const sql: string[] = [
  '-- Disenos de octubre generados en canvas2.',
  `-- ${NOW}. Solo toca filas del espacio ${SANDBOX_SPACE}.`,
];
const rollback: string[] = ['-- Vuelta atras: borra los disenos y despunta los contenidos.'];
const informe: Array<Record<string, unknown>> = [];

for (const f of filas) {
  const m = MARCAS[f.proyecto];
  if (!m) { console.error('sin marca:', f.proyecto); continue; }

  const fecha = f.timeupload.slice(0, 10);
  const esVertical = f.tipo !== 'image';
  const W = 1080;
  const H = esVertical ? 1920 : 1350;

  const lineas = (f.copy ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const utiles = lineas.filter((l) => !/^#/.test(l));
  const plan = PLAN[`${f.proyecto}|${fecha}`];

  let arq: Arquetipo;
  let pieza: Pieza;

  if (plan) {
    arq = plan.arq;
    pieza = {
      titular: plan.titular ?? utiles[0] ?? '',
      cuerpo: plan.cuerpo ?? (plan.arq === 'lista' ? utiles.slice(1) : utiles.slice(1, 2)),
      kicker: plan.kicker,
      cta: plan.cta,
      img: plan.img ? { id: plan.img } : undefined,
      encuadre: plan.encuadre,
    };
  } else {
    // Sin mediateca: o es un caption de verdad (editorial) o es un brief (tarjeta).
    const etiqueta = etiquetaDeBrief(f.copy ?? '');
    const esCaption = utiles.length > 1 && /[.!?…]$|[\u{1F300}-\u{1FAFF}]$/u.test(utiles[0]);
    if (esCaption) {
      arq = 'editorial';
      pieza = { titular: utiles[0], cuerpo: utiles.slice(1, 2), kicker: f.proyecto };
    } else {
      arq = 'ctaStory';
      pieza = { titular: '', cuerpo: [], cta: etiqueta ?? f.proyecto.toUpperCase(), kicker: f.proyecto };
    }
  }

  // Una composicion con foto necesita mediateca; si no la hay, se degrada.
  if ((arq === 'fotoTitular' || arq === 'fotoLimpia') && (!m.mmProject || !pieza.img)) {
    arq = arq === 'fotoLimpia' ? 'ctaStory' : 'editorial';
  }

  const frameId = nid();
  const files: Record<string, unknown> = {};
  const ctx: Ctx = {
    W, H, m, frameId, files,
    pad: 84,
    safeTop: esVertical ? 250 : 70,
    safeBottom: esVertical ? 300 : 80,
  };

  const elementos: El[] = [
    base({ id: frameId, type: 'frame', x: 0, y: 0, width: W, height: H, name: `${fecha} · ${f.tipo}`, strokeColor: '#bbb' }),
    base({
      id: nid(), type: 'rectangle', x: 0, y: 0, width: W, height: H,
      backgroundColor: m.fondo, fillStyle: 'solid', strokeColor: '#d4d4d8', strokeWidth: 1,
      locked: true, frameId, customData: { c2: 'pageBackground' },
    }),
    ...ARQUETIPOS[arq](ctx, pieza),
  ];

  const escena = JSON.stringify({
    elements: elementos,
    appState: { viewBackgroundColor: '#f5f5f5' },
    files,
    fonts: carasDe(m),
  });

  const designId = randomUUID();
  const nombre = `${fecha} · ${f.tipo} · ${arq}`;
  sql.push('', `-- ${f.proyecto} ${fecha} [${f.tipo}] ${arq} :: ${comentario(utiles[0])}`);
  sql.push(
    'INSERT INTO designs (id, name, editorConfig, pages, createdBy, projectId, spaceId, template, "desc", format, createdAt, updatedAt) VALUES (' +
      `${q(designId)}, ${q(nombre)}, ${q(escena)}, 1, ${q(OWNER)}, ${q(m.sandboxProject)}, ` +
      `${q(SANDBOX_SPACE)}, 0, ${q('canvas2 · diseno automatico de octubre')}, 'excalidraw', ${q(NOW)}, ${q(NOW)});`,
  );
  sql.push(`UPDATE content SET designId=${q(designId)}, updatedAt=${q(NOW)} WHERE id=${q(f.id)} AND designId IS NULL;`);
  rollback.push(`UPDATE content SET designId=NULL WHERE id=${q(f.id)};`);
  rollback.push(`DELETE FROM designs WHERE id=${q(designId)} AND spaceId=${q(SANDBOX_SPACE)};`);

  informe.push({
    proyecto: f.proyecto, fecha, tipo: f.tipo, arquetipo: arq, designId,
    conFoto: !!pieza.img, titular: pieza.titular.slice(0, 70),
    fuentes: carasDe(m).map((c) => c.family),
    sustitucion: m.sustituye ?? null,
    bytes: escena.length,
  });
}

const SALIDA = path.join(DIR, 'octubre-disenos');
writeFileSync(`${SALIDA}.sql`, sql.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.rollback.sql`, rollback.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.informe.json`, JSON.stringify(informe, null, 1), 'utf8');

const porArq: Record<string, number> = {};
const porProy: Record<string, number> = {};
for (const e of informe) {
  porArq[e.arquetipo as string] = (porArq[e.arquetipo as string] ?? 0) + 1;
  porProy[e.proyecto as string] = (porProy[e.proyecto as string] ?? 0) + 1;
}
console.log('disenos generados:', informe.length);
console.log('por proyecto:', JSON.stringify(porProy));
console.log('por composicion:', JSON.stringify(porArq));
console.log('con foto real:', informe.filter((e) => e.conFoto).length);
console.log('mayor sentencia:', Math.max(...sql.map((l) => l.length)), 'bytes');
console.log(`\nsql: ${SALIDA}.sql`);
