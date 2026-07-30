/**
 * Sistema de diseño compartido por los generadores de calendario.
 *
 * Se extrajo de `design-october.ts` cuando hizo falta el segundo calendario
 * (JotaEle): duplicar los arquetipos habria significado que un arreglo de
 * legibilidad — como el de las planchas sobre foto blanca — solo llegara a la
 * mitad de los disenos.
 *
 * Nada de esto escribe en disco ni en base de datos: son constructores puros de
 * escena de canvas2. Quien los usa decide que piezas componer y donde guardarlas.
 */
import { customFontFamilyId, fontFamilyAlias, type CustomFontFace } from '../../src/fonts';
import { HARDCODED_FONTS } from '../../../canvas/src/image/fonts/hardcoded-fonts';

// ─── Tipografías ──────────────────────────────────────────────────────────────

const CURADAS = new Map<string, string>();
for (const f of HARDCODED_FONTS) {
  const regular = f.styles.find((s) => s.style === 'regular') ?? f.styles[0];
  if (regular?.url) CURADAS.set(f.family.toLowerCase(), regular.url);
}
/** Negrita real cuando existe: un titular en 700 no es lo mismo que en 400. */
const CURADAS_BOLD = new Map<string, string>();
for (const f of HARDCODED_FONTS) {
  const bold = f.styles.find((s) => s.style === '700');
  if (bold?.url) CURADAS_BOLD.set(f.family.toLowerCase(), bold.url);
}

export interface Marca {
  sandboxProject: string;
  mmProject: string | null;
  /** Familia de titulares que se USA (puede ser sustituta). */
  heading: string;
  body: string;
  /** Lo que pedía el brand kit, si no se ha podido usar. */
  sustituye?: string;
  color: string;
  paleta: string[];
  /** Fondo de las piezas sin foto. */
  fondo: string;
  /** Tinta sobre ese fondo. */
  tinta: string;
  /** Color de realce (filetes, numeración). */
  realce: string;
}

/** Caras que hay que declarar para una marca, listas para `editorConfig.fonts`. */
export function carasDe(m: Marca): CustomFontFace[] {
  const out: CustomFontFace[] = [];
  const add = (nombre: string, bold: boolean) => {
    const url = (bold ? CURADAS_BOLD : CURADAS).get(nombre.toLowerCase());
    if (!url) return;
    out.push({ family: fontFamilyAlias(bold ? `${nombre} Bold` : nombre), src: url });
  };
  add(m.heading, false);
  add(m.heading, true);
  if (m.body.toLowerCase() !== m.heading.toLowerCase()) {
    add(m.body, false);
    add(m.body, true);
  }
  return out;
}

export const idFamilia = (nombre: string) =>
  CURADAS.has(nombre.toLowerCase()) || CURADAS_BOLD.has(nombre.toLowerCase())
    ? customFontFamilyId(nombre)
    : 2;

// ─── Constructores de escena ──────────────────────────────────────────────────

export type El = Record<string, unknown>;

let seq = 0;
/** Id corto y estable dentro de una ejecucion; el prefijo evita chocar con
 *  los ids que genera Excalidraw al editar despues. */
export const nid = () => `d2${(seq += 1).toString(36).padStart(5, '0')}`;

export function base(extra: El): El {
  return {
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 0,
    link: null,
    locked: false,
    ...extra,
  };
}

/** Parte el texto en líneas que caben, midiendo a ojo por ancho medio de glifo. */
function envolver(texto: string, ancho: number, size: number, factor = 0.52): string[] {
  const max = Math.max(6, Math.floor(ancho / (size * factor)));
  const out: string[] = [];
  for (const parrafo of texto.split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const cand = linea ? `${linea} ${palabra}` : palabra;
      if (cand.length > max && linea) {
        out.push(linea);
        linea = palabra;
      } else linea = cand;
    }
    out.push(linea);
  }
  return out.filter((l) => l !== '' || out.length === 1);
}

interface TextoOpts {
  x: number;
  y: number;
  ancho: number;
  size: number;
  familia: string;
  color: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  factor?: number;
  espaciado?: boolean;
}

/** Devuelve el elemento y la altura que ocupa, para poder apilar. */
export function texto(t: string, o: TextoOpts, frameId: string): { el: El; alto: number } {
  // El tracking se aplica por palabra: separar TODOS los caracteres, espacio
  // incluido, convertia 'Aldea Los Odres' en un solo bloque ilegible.
  const contenido = o.espaciado
    ? t.toUpperCase().split(' ').map((w) => w.split('').join(' ')).join('   ')
    : t;
  // El texto con tracking NO se envuelve: `envolver` normaliza los espacios con
  // /\s+/ y se comia la separacion entre palabras, dejando 'ALDEALOSODRES'.
  // Un kicker siempre cabe en una linea, asi que no hay nada que partir.
  const lineas = o.espaciado ? [contenido] : envolver(contenido, o.ancho, o.size, o.factor);
  const lh = o.lineHeight ?? 1.2;
  const alto = lineas.length * o.size * lh;
  return {
    alto,
    el: base({
      id: nid(),
      type: 'text',
      x: o.x,
      y: o.y,
      width: o.ancho,
      height: alto,
      text: lineas.join('\n'),
      originalText: lineas.join('\n'),
      fontSize: o.size,
      fontFamily: idFamilia(o.familia),
      textAlign: o.align ?? 'left',
      verticalAlign: 'top',
      containerId: null,
      lineHeight: lh,
      autoResize: false,
      strokeColor: o.color,
      frameId,
    }),
  };
}

export function rect(x: number, y: number, w: number, h: number, color: string, opacity: number, frameId: string): El {
  return base({
    id: nid(),
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    backgroundColor: color,
    fillStyle: 'solid',
    strokeColor: 'transparent',
    strokeWidth: 0,
    opacity,
    frameId,
    locked: true,
  });
}

export interface Foto {
  id: string;
  /**
   * Extensión del ORIGINAL en el bucket: la del mime en minúscula, no la del
   * nombre — un `P1043898.JPG` se guarda como `.jpg`.
   *
   * Es opcional solo por el calendario de octubre, que se generó antes de tener
   * los metadatos de las mediatecas de los otros clientes. Sin ella no se puede
   * construir la URL del original y se cae a la miniatura, que es peor: para
   * material nuevo, rellénala siempre (la da `get_file` de la MCP).
   */
  ext?: 'jpg' | 'webp' | 'png';
  /** Nombre original. Solo viaja en el Content-Disposition de la descarga. */
  name?: string;
  w?: number;
  h?: number;
  /** Para qué sirve, en una palabra. Guía las alternativas. */
  familia?: string;
}

/** Miniatura. Solo como respaldo cuando no se conoce el original. */
function urlPreview(proyecto: string, id: string): string {
  return `https://light-media.polimake.com/projects/${proyecto}/images/${id}/preview.webp`;
}

/**
 * URL del ORIGINAL a resolución completa.
 *
 * `light-media…/preview.webp` es la miniatura: sirve para una galería, no para
 * un diseño que luego se exporta a 1080 o más. El original se pide al
 * redimensionador con `quality=original`.
 */
export function urlOriginal(proyecto: string, f: Foto): string {
  if (!f.ext) return urlPreview(proyecto, f.id);
  const ruta = encodeURIComponent(`projects/${proyecto}/images/${f.id}.${f.ext}`);
  const nombre = encodeURIComponent(f.name ?? `${f.id}.${f.ext}`);
  return `https://image.polimake.com/?quality=original&path=${ruta}&filename=${nombre}`;
}

function registrarFichero(
  files: Record<string, unknown>,
  proyecto: string,
  f: Foto,
): string {
  const key = nid();
  files[key] = {
    mimeType: !f.ext || f.ext === 'jpg' ? 'image/jpeg' : `image/${f.ext}`,
    id: key,
    dataURL: urlOriginal(proyecto, f),
    created: 0,
    lastRetrieved: 0,
  };
  return key;
}

export interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Coloca la foto ENTERA dentro de una caja, centrada.
 *
 * Regla dura: ni recorte ni deformación. Antes se hacía `cover` — llenar la
 * página y dejar fuera lo que sobrara — y con fotos de 2000x869 o de 4336x5776
 * eso significaba tirar media imagen o, peor, estirarla. Ahora manda la foto:
 * se escala a lo que quepa manteniendo su proporción y el hueco que sobra lo
 * ocupa el color de marca, que para eso está el fondo de página.
 *
 * La consecuencia de composición es deliberada: el texto ya NO va encima de la
 * imagen, va debajo, sobre el fondo. Se lee mejor y no hace falta ningún velo.
 */
export function fotoContenida(
  f: Foto,
  mmProject: string,
  caja: Caja,
  frameId: string | null,
  files: Record<string, unknown>,
): El {
  const ratio = f.w && f.h ? f.w / f.h : 1.5;
  let w = caja.w;
  let h = caja.w / ratio;
  if (h > caja.h) {
    h = caja.h;
    w = caja.h * ratio;
  }
  return base({
    id: nid(),
    type: 'image',
    x: caja.x + (caja.w - w) / 2,
    y: caja.y + (caja.h - h) / 2,
    width: w,
    height: h,
    fileId: registrarFichero(files, mmProject, f),
    status: 'saved',
    scale: [1, 1],
    crop: null,
    frameId,
    locked: true,
  });
}

/**
 * Tira de alternativas SOBRE la página, fuera del marco.
 *
 * Van con `frameId: null` a propósito: al no pertenecer a la página no se
 * exportan ni cuentan como contenido, pero están a un arrastre de distancia
 * para cambiar la foto elegida sin salir del editor ni volver a la mediateca.
 * Se colocan arriba porque el carril de páginas ocupa la parte de abajo.
 */
export function alternativas(
  fotos: readonly Foto[],
  mmProject: string,
  W: number,
  files: Record<string, unknown>,
  m: Marca,
): El[] {
  if (!fotos.length) return [];
  const ANCHO = 460;
  const HUECO = 36;
  const out: El[] = [];

  const altos = fotos.map((f) => ANCHO / (f.w && f.h ? f.w / f.h : 1.5));
  const maxAlto = Math.max(...altos);
  const total = fotos.length * ANCHO + (fotos.length - 1) * HUECO;
  const x0 = (W - total) / 2;
  const yBase = -(maxAlto + 150);

  const rotulo = texto('Alternativas · arrastra una dentro de la página para sustituir la foto', {
    x: x0, y: yBase - 76, ancho: total, size: 30, familia: m.body, color: '#6b7280',
  }, '');
  (rotulo.el as { frameId: string | null }).frameId = null;
  out.push(rotulo.el);

  fotos.forEach((f, i) => {
    const alto = altos[i];
    const el = base({
      id: nid(),
      type: 'image',
      x: x0 + i * (ANCHO + HUECO),
      y: yBase + (maxAlto - alto),
      width: ANCHO,
      height: alto,
      fileId: registrarFichero(files, mmProject, f),
      status: 'saved',
      scale: [1, 1],
      crop: null,
      frameId: null,
      locked: false,
    });
    out.push(el);
  });
  return out;
}

// ─── Arquetipos de composición ────────────────────────────────────────────────

export interface Ctx {
  W: number;
  H: number;
  m: Marca;
  frameId: string;
  files: Record<string, unknown>;
  /** Margen lateral y zona segura vertical (las stories recortan arriba y abajo). */
  pad: number;
  safeTop: number;
  safeBottom: number;
}

export interface Pieza {
  titular: string;
  cuerpo: string[];
  kicker?: string;
  cta?: string;
  img?: Foto;
  encuadre?: number;
}

/**
 * Centra verticalmente un bloque ya compuesto dentro de la zona segura.
 *
 * Las composiciones se apilan desde arriba, lo que en un 9:16 deja el contenido
 * en el tercio superior y media página vacía. Se mide lo ya colocado y se
 * desplaza entero, así el centrado es exacto aunque el texto haya envuelto en
 * más líneas de las previstas.
 */
function centrarVertical(els: El[], c: Ctx): void {
  if (!els.length) return;
  let arriba = Infinity;
  let abajo = -Infinity;
  for (const el of els) {
    const y = el.y as number;
    arriba = Math.min(arriba, y);
    abajo = Math.max(abajo, y + (el.height as number));
  }
  const usable = c.H - c.safeTop - c.safeBottom;
  const delta = c.safeTop + (usable - (abajo - arriba)) / 2 - arriba;
  if (delta <= 0) return;
  for (const el of els) (el as { y: number }).y = (el.y as number) + delta;
}

/**
 * Foto entera arriba, texto debajo sobre el color de marca.
 *
 * El bloque de texto se compone primero para saber cuánto ocupa; lo que queda
 * por encima es la caja de la foto. Así la imagen es todo lo grande que puede
 * ser sin recortarse y sin comerse el texto.
 */
function fotoTitular(c: Ctx, p: Pieza): El[] {
  const out: El[] = [];
  const ancho = c.W - c.pad * 2;
  const sizeTit = c.H > 1500 ? 76 : 66;

  const bloque: Array<{ el: El; alto: number; gap: number }> = [];
  if (p.kicker) {
    const k = texto(p.kicker, {
      x: c.pad, y: 0, ancho, size: 22, familia: c.m.body, color: c.m.realce, espaciado: true, factor: 0.95,
    }, c.frameId);
    bloque.push({ ...k, gap: 26 });
  }
  const t = texto(p.titular, {
    x: c.pad, y: 0, ancho, size: sizeTit, familia: c.m.heading, color: c.m.tinta, lineHeight: 1.12,
  }, c.frameId);
  bloque.push({ ...t, gap: 24 });

  if (p.cuerpo.length) {
    const b = texto(p.cuerpo.join(' '), {
      x: c.pad, y: 0, ancho, size: 30, familia: c.m.body, color: c.m.tinta, lineHeight: 1.45, factor: 0.55,
    }, c.frameId);
    (b.el as { opacity: number }).opacity = 80;
    bloque.push({ ...b, gap: 24 });
  }
  if (p.cta) {
    const cta = texto(p.cta, {
      x: c.pad, y: 0, ancho, size: 24, familia: c.m.body, color: c.m.realce, espaciado: true, factor: 0.95,
    }, c.frameId);
    bloque.push({ ...cta, gap: 0 });
  }

  const altoBloque = bloque.reduce((a, b, i) => a + b.alto + (i < bloque.length - 1 ? b.gap : 0), 0);
  const yTexto = c.H - c.safeBottom - altoBloque;

  if (p.img && c.m.mmProject) {
    out.push(fotoContenida(p.img, c.m.mmProject, {
      x: c.pad, y: c.safeTop, w: ancho, h: yTexto - c.safeTop - 56,
    }, c.frameId, c.files));
  }

  let y = yTexto;
  for (const b of bloque) {
    (b.el as { y: number }).y = y;
    out.push(b.el);
    y += b.alto + b.gap;
  }
  return out;
}

/** Foto sola, entera y centrada. Para los briefs que piden imagen limpia. */
function fotoLimpia(c: Ctx, p: Pieza): El[] {
  const out: El[] = [];
  const ancho = c.W - c.pad * 2;
  const altoKicker = p.kicker ? 80 : 0;

  if (p.img && c.m.mmProject) {
    out.push(fotoContenida(p.img, c.m.mmProject, {
      x: c.pad, y: c.safeTop, w: ancho, h: c.H - c.safeTop - c.safeBottom - altoKicker,
    }, c.frameId, c.files));
  }
  if (p.kicker) {
    const k = texto(p.kicker, {
      x: c.pad, y: c.H - c.safeBottom - 30, ancho, size: 24,
      familia: c.m.body, color: c.m.realce, espaciado: true, factor: 0.95, align: 'center',
    }, c.frameId);
    out.push(k.el);
  }
  return out;
}

/** Editorial tipográfico sobre color de marca. Sin foto. */
function editorial(c: Ctx, p: Pieza): El[] {
  const out: El[] = [];
  const ancho = c.W - c.pad * 2;
  let y = c.safeTop + (c.H > 1500 ? 180 : 90);

  if (p.kicker) {
    const k = texto(p.kicker, {
      x: c.pad, y, ancho, size: 24, familia: c.m.body, color: c.m.realce, espaciado: true, factor: 0.9,
    }, c.frameId);
    out.push(k.el); y += k.alto + 44;
  }
  const t = texto(p.titular, {
    x: c.pad, y, ancho, size: c.H > 1500 ? 96 : 86, familia: c.m.heading, color: c.m.tinta, lineHeight: 1.08,
  }, c.frameId);
  out.push(t.el); y += t.alto + 46;

  out.push(rect(c.pad, y, 120, 5, c.m.realce, 100, c.frameId));
  y += 46;

  if (p.cuerpo.length) {
    const b = texto(p.cuerpo.join('\n'), {
      x: c.pad, y, ancho, size: 34, familia: c.m.body, color: c.m.tinta, lineHeight: 1.5, factor: 0.55,
    }, c.frameId);
    out.push(b.el);
  }
  centrarVertical(out, c);
  if (p.cta) {
    const cta = texto(p.cta, {
      x: c.pad, y: c.H - c.safeBottom - 34, ancho, size: 24,
      familia: c.m.body, color: c.m.realce, espaciado: true, factor: 0.9,
    }, c.frameId);
    out.push(cta.el);
  }
  return out;
}

/** Lista numerada. Para checklists y comparativas: cada punto respira. */
function lista(c: Ctx, p: Pieza): El[] {
  const out: El[] = [];
  const ancho = c.W - c.pad * 2;
  let y = c.safeTop + (c.H > 1500 ? 170 : 80);

  if (p.kicker) {
    const k = texto(p.kicker, {
      x: c.pad, y, ancho, size: 24, familia: c.m.body, color: c.m.realce, espaciado: true, factor: 0.9,
    }, c.frameId);
    out.push(k.el); y += k.alto + 40;
  }
  const t = texto(p.titular, {
    x: c.pad, y, ancho, size: c.H > 1500 ? 76 : 68, familia: c.m.heading, color: c.m.tinta, lineHeight: 1.1,
  }, c.frameId);
  out.push(t.el); y += t.alto + 56;

  p.cuerpo.forEach((linea, i) => {
    const num = texto(String(i + 1).padStart(2, '0'), {
      x: c.pad, y, ancho: 90, size: 34, familia: c.m.body, color: c.m.realce, factor: 0.62,
    }, c.frameId);
    out.push(num.el);
    const tx = texto(linea, {
      x: c.pad + 104, y: y - 4, ancho: ancho - 104, size: 34, familia: c.m.body,
      color: c.m.tinta, lineHeight: 1.4, factor: 0.55,
    }, c.frameId);
    out.push(tx.el);
    y += Math.max(num.alto, tx.alto) + 40;
  });
  centrarVertical(out, c);
  return out;
}

/**
 * Story de acción: foto entera arriba y la llamada debajo, sobre el fondo.
 *
 * La banda translúcida sobre la foto se retiró junto con el recorte: si la
 * imagen no sangra, no hay nada que tapar y el CTA se lee sobre color plano.
 */
function ctaStory(c: Ctx, p: Pieza): El[] {
  const out: El[] = [];
  const ancho = c.W - c.pad * 2;

  const t = texto(p.cta ?? 'RESERVA', {
    x: c.pad, y: 0, ancho, size: c.H > 1500 ? 104 : 88, familia: c.m.heading,
    color: c.m.tinta, align: 'center', lineHeight: 1.05,
  }, c.frameId);
  const sub = p.titular
    ? texto(p.titular, {
        x: c.pad, y: 0, ancho, size: 30, familia: c.m.body, color: c.m.tinta,
        align: 'center', lineHeight: 1.4, factor: 0.55,
      }, c.frameId)
    : null;
  const kick = p.kicker
    ? texto(p.kicker, {
        x: c.pad, y: 0, ancho, size: 22, familia: c.m.body, color: c.m.realce,
        align: 'center', espaciado: true, factor: 0.95,
      }, c.frameId)
    : null;

  const altoTexto = (kick ? kick.alto + 30 : 0) + t.alto + (sub ? 26 + sub.alto : 0);
  const yTexto = c.H - c.safeBottom - altoTexto;

  if (p.img && c.m.mmProject) {
    out.push(fotoContenida(p.img, c.m.mmProject, {
      x: c.pad, y: c.safeTop, w: ancho, h: yTexto - c.safeTop - 56,
    }, c.frameId, c.files));
  }

  let y = yTexto;
  if (kick) { (kick.el as { y: number }).y = y; out.push(kick.el); y += kick.alto + 30; }
  (t.el as { y: number }).y = y;
  out.push(t.el);
  if (sub) { (sub.el as { y: number }).y = y + t.alto + 26; out.push(sub.el); }
  return out;
}

export const ARQUETIPOS = { fotoTitular, fotoLimpia, editorial, lista, ctaStory } as const;
export type Arquetipo = keyof typeof ARQUETIPOS;
