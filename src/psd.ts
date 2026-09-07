import type { SceneElement } from './excal';
import { PAGE_GAP } from './layout';
import {
  customFontFamilyId,
  dedupeFontFaces,
  fontFamilyAlias,
  normalizeFontName,
  normalizeFontSrc,
  type CustomFontFace,
} from './fonts';

/**
 * Conversión Photoshop (.psd/.psb) → escena de Excalidraw.
 *
 * Hermano de `legacy.ts` y con sus mismas reglas, que no son estilísticas:
 *
 *   PURO      Aquí NO se importa `ag-psd` ni `@excalidraw/*` (solo el tipo, vía
 *             ./excal). La entrada es la forma ESTRUCTURAL de un documento ya
 *             parseado —las interfaces `Psd*` de abajo son un calco del modelo
 *             de ag-psd, no un import suyo—, así que el módulo se testea en node
 *             con objetos a mano y no arrastra el lector de PSD al bundle del
 *             navegador. Quien lee bytes es `scripts/import-psd.ts`.
 *
 *   SIN DOM   Nada de canvas, Image ni measureText. Las medidas salen de lo que
 *             el PSD ya trae calculado (bbox de capa, bbox de texto, matriz de
 *             transformación), no de re-medir.
 *
 *   SIN BYTES Ninguna capa rasterizada entra en la escena como base64: la regla
 *             de `media.ts` lo prohíbe y aquí se respeta por construcción. Cada
 *             capa de píxeles se convierte en un PLACEHOLDER con la geometría y
 *             la proporción EXACTAS del original, y se anota en `assets` para
 *             que el llamante suba los píxeles a MediaMonster y los cambie
 *             después con {@link listImagePlaceholders}.
 *
 * EL OBJETIVO es no perder nada en silencio. Todo lo que Photoshop sabe y
 * Excalidraw no puede representar (modos de fusión, máscaras, degradados,
 * sombras, capas de ajuste) se convierte a lo más parecido que haya y se APUNTA
 * en `report.notes`. Una capa que desaparece sin nota es un bug de este módulo.
 */

// ─── Modelo PSD (calco estructural de ag-psd; solo lo que se lee) ────────────

/** Valor con unidades de Photoshop (`{units:'Pixels', value:12}`). */
export interface PsdUnits {
  units?: string;
  value?: number;
}

/**
 * El color de Photoshop llega en el espacio en el que se guardó. Ninguna clave
 * es obligatoria porque la unión de ag-psd (RGB | FRGB | CMYK | LAB | Grayscale
 * | HSB) se aplana aquí en un solo objeto laxo: `toHex` decide por presencia.
 */
export interface PsdColor {
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  fr?: number;
  fg?: number;
  fb?: number;
  c?: number;
  m?: number;
  y?: number;
  k?: number;
  l?: number;
  h?: number;
  s?: number;
}

export interface PsdUnitsBounds {
  top?: PsdUnits;
  left?: PsdUnits;
  right?: PsdUnits;
  bottom?: PsdUnits;
}

export interface PsdTextStyle {
  font?: { name?: string };
  fontSize?: number;
  fauxBold?: boolean;
  fauxItalic?: boolean;
  autoLeading?: boolean;
  leading?: number;
  tracking?: number;
  fillColor?: PsdColor;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface PsdParagraphStyle {
  justification?: string;
}

export interface PsdText {
  text?: string;
  /** `[xx, xy, yx, yy, tx, ty]`. Lleva la escala real del texto. */
  transform?: number[];
  style?: PsdTextStyle;
  styleRuns?: Array<{ length?: number; style?: PsdTextStyle }>;
  paragraphStyle?: PsdParagraphStyle;
  paragraphStyleRuns?: Array<{ length?: number; style?: PsdParagraphStyle }>;
  shapeType?: 'point' | 'box';
  /** `[left, top, right, bottom]` relativo al origen de `transform`. */
  boxBounds?: number[];
  bounds?: PsdUnitsBounds;
  boundingBox?: PsdUnitsBounds;
}

export interface PsdBezierPath {
  open?: boolean;
  operation?: string;
  fillRule?: string;
  /** `points` = `[cp1x, cp1y, anchorX, anchorY, cp2x, cp2y]`, YA en píxeles. */
  knots?: Array<{ linked?: boolean; points?: number[] }>;
}

/**
 * Un efecto de capa. Las dos banderas importan por igual y ninguna basta sola.
 *
 * Photoshop guarda TODOS los efectos de una capa en cuanto se abre su diálogo
 * de estilo, aunque no se marque ninguno: quedan con `present:false` (nunca se
 * activó) o `enabled:false` (se activó y luego se apagó). Mirar solo si el
 * array existe hacía que una capa cualquiera saliera con ocho avisos de
 * "efectos no representables" que no tenía, y eso tapa los avisos de verdad.
 */
export interface PsdEffect {
  present?: boolean;
  enabled?: boolean;
}

export interface PsdVectorContent {
  type?: string;
  color?: PsdColor;
  /** Degradado: se lee la primera parada para no dejar la forma sin color. */
  gradient?: { colorStops?: Array<{ color?: PsdColor; location?: number }> };
}

export interface PsdLayer {
  id?: number;
  name?: string;
  hidden?: boolean;
  /** 0..1 en ag-psd, no 0..100. */
  opacity?: number;
  fillOpacity?: number;
  blendMode?: string;
  clipping?: boolean;
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
  children?: PsdLayer[];
  text?: PsdText;
  vectorFill?: PsdVectorContent;
  vectorStroke?: {
    strokeEnabled?: boolean;
    fillEnabled?: boolean;
    lineWidth?: PsdUnits;
    lineDashSet?: PsdUnits[];
    content?: PsdVectorContent;
  };
  vectorMask?: { disable?: boolean; paths?: PsdBezierPath[] };
  vectorOrigination?: {
    keyDescriptorList?: Array<{
      keyOriginType?: number;
      keyOriginShapeBoundingBox?: PsdUnitsBounds;
      keyOriginRRectRadii?: {
        topLeft?: PsdUnits;
        topRight?: PsdUnits;
        bottomLeft?: PsdUnits;
        bottomRight?: PsdUnits;
      };
    }>;
  };
  effects?: {
    disabled?: boolean;
    dropShadow?: PsdEffect[];
    innerShadow?: PsdEffect[];
    outerGlow?: PsdEffect;
    innerGlow?: PsdEffect;
    bevel?: PsdEffect;
    satin?: PsdEffect;
    patternOverlay?: PsdEffect;
    gradientOverlay?: PsdEffect[];
    solidFill?: Array<PsdEffect & { color?: PsdColor; opacity?: number }>;
    stroke?: Array<PsdEffect & { size?: PsdUnits; color?: PsdColor; position?: string }>;
  };
  mask?: {
    disabled?: boolean;
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  };
  adjustment?: { type?: string } & Record<string, unknown>;
  placedLayer?: { type?: string; name?: string };
  artboard?: {
    rect?: { top?: number; left?: number; bottom?: number; right?: number };
    presetName?: string;
    color?: PsdColor;
    backgroundType?: number;
  };
  /** Presencia = la capa tiene píxeles propios. No se leen nunca aquí. */
  imageData?: unknown;
  canvas?: unknown;
  sectionDivider?: { type?: number };
}

export interface PsdDocument {
  width?: number;
  height?: number;
  children?: PsdLayer[];
  imageData?: unknown;
  canvas?: unknown;
}

// ─── Contrato de salida ──────────────────────────────────────────────────────

/** Marcador de `customData.c2` de un hueco de imagen. Ver la cabecera. */
export const PSD_IMAGE_MARKER = 'psdImage';

/**
 * Una capa de píxeles del PSD que la escena representa con un placeholder.
 *
 * `address` es el camino de índices desde `psd.children` hasta la capa, y es lo
 * que permite al script CLI volver a por sus píxeles sin que este módulo los
 * haya tocado: `psd.children[a][b]…`.
 */
export interface PsdAssetSlot {
  /** Id del elemento placeholder en la escena. Es la llave del intercambio. */
  id: string;
  name: string;
  page: number;
  /** Ruta de grupos hasta la capa, para nombrar el fichero de forma legible. */
  path: string[];
  /** Tamaño natural en píxeles del PSD (antes de `scale`). */
  naturalWidth: number;
  naturalHeight: number;
  /** Nombre de fichero sugerido, ya saneado y único dentro de la conversión. */
  filename: string;
  address: number[];
}

export interface PsdNote {
  page: number;
  layer: string;
  /** 'dropped' = no se pudo representar; 'lossy' = se representa distinto. */
  kind: 'dropped' | 'lossy';
  detail: string;
}

export type PsdTier = 'T1' | 'T2' | 'T3';

export interface PsdReport {
  /** Tamaño del documento tal y como venía, antes de `scale`. */
  document: { width: number; height: number; scale: number };
  pages: number;
  tier: PsdTier;
  /**
   * Recuento de CAPAS, una capa una unidad. Los elementos van aparte porque una
   * capa puede dar varios —un texto de estilos mixtos, una forma de varios
   * subcaminos— y mezclarlos hacía que "convertidas" superara a "vistas".
   *
   * Un grupo cuenta como convertido si su contenido produjo algo; si no, no
   * suma en ningún cajón, porque sus hijos ya están contados en el suyo.
   */
  layers: { total: number; converted: number; hidden: number; dropped: number };
  /** Elementos de Excalidraw que produjo la conversión, marcos y papeles aparte. */
  elements: number;
  /** Cuántas capas de cada clase se vieron (`text`, `shape`, `image`…). */
  counts: Record<string, number>;
  /** Tipografías que el diseño nombra y si se les encontró fichero. */
  fonts: Array<{ name: string; resolved: boolean }>;
  notes: PsdNote[];
  clean: boolean;
}

export interface PsdScene {
  elements: SceneElement[];
  /** Siempre vacío hoy: sin bytes no hay ficheros. Está por simetría con `legacy.ts`. */
  files: Record<string, unknown>;
  fonts: CustomFontFace[];
  assets: PsdAssetSlot[];
  report: PsdReport;
}

/** Fichero de una tipografía, venga de donde venga (mismo contrato que legacy). */
export interface PsdFontSource {
  url: string;
  /**
   * Sufijo de estilo ("Bold", "BoldItalic"). Si no se da, se usa el que trae el
   * nombre PostScript del PSD. Se traduce a CSS con `postScriptStyleToCss`.
   */
  style?: string;
  /** `font-weight` ya en CSS, si quien resuelve el fichero lo sabe mejor. */
  weight?: string;
}

export interface PsdImportOptions {
  /**
   * Último recurso para una fuente que el PSD nombra. Un PSD guarda el nombre
   * PostScript de la tipografía ("Montserrat-Bold") pero NUNCA el fichero, así
   * que sin esto todo el texto cae a la familia de respaldo. Se inyecta —igual
   * que en `legacy.ts`— para que el módulo siga siendo puro: el CLI lo cablea
   * al brand kit del proyecto, los tests a un mapa de mentira.
   */
  resolveFontUrl?: (name: string, style?: string) => PsdFontSource | null;
  /**
   * Factor sobre TODAS las coordenadas. Por defecto 1: un PSD de 300 ppp mide
   * miles de píxeles y reescalar por nuestra cuenta sería cambiar el diseño sin
   * que nadie lo pida. Quien quiera una página manejable lo pasa explícito.
   */
  scale?: number;
  /**
   * Incluir capas ocultas. Por defecto NO: Photoshop no las pinta, y meterlas
   * taparía el diseño con material que el autor decidió no enseñar. Se cuentan
   * igual en el informe para que se sepa lo que quedó fuera.
   */
  includeHidden?: boolean;
  /** Nombre base de los ficheros de asset. Por defecto 'capa'. */
  documentName?: string;
  /**
   * A partir de cuántos subcaminos una capa vectorial deja de vectorizarse.
   *
   * No es una optimización: es lo que separa una escena usable de una que no se
   * puede abrir. Una textura de pincel real trae 900-2700 subcaminos, y cada uno
   * sale como una polilínea de ~55 puntos — 14 MB de JSON para UNA capa, y el
   * editor se arrastra. Por encima del tope la capa se trata como imagen (que es
   * lo que es: una mancha), conservando su aspecto EXACTO y dejando la escena en
   * unos kilobytes. Por defecto 64, que deja pasar cualquier logo o icono real.
   */
  maxSubpaths?: number;
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

const PAPER_COLOR = '#ffffff';
const BG_MARKER = 'pageBackground';
/** 2 = "Helvetica", la familia sin trazo a mano de Excalidraw. */
const DEFAULT_FONT_FAMILY = 2;
/** Gris del hueco de imagen: se lee como "aquí va una foto", no como diseño. */
const PLACEHOLDER_FILL = '#e9ecef';
const PLACEHOLDER_STROKE = '#adb5bd';
const PLACEHOLDER_TEXT = '#6c757d';

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Unidades de Photoshop → píxeles.
 *
 * Solo 'Pixels' y 'Points' aparecen en los descriptores que se leen aquí, y a
 * 72 ppp —la resolución del espacio de descriptores, no la del documento— un
 * punto ES un píxel. Cualquier otra unidad se deja pasar con su valor crudo
 * antes que inventarse una conversión.
 */
function unitsToPx(u: PsdUnits | undefined): number {
  return num(u?.value);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hex2 = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');

/**
 * Cualquier color de Photoshop → `#rrggbb`.
 *
 * El orden de las comprobaciones importa: `{r,g,b}` (0..255) y `{fr,fg,fb}`
 * (0..1) coexisten en el mismo tipo unión de ag-psd, y CMYK trae `k` igual que
 * Grayscale — por eso CMYK se mira ANTES, comprobando que estén las cuatro.
 */
export function psdColorToHex(color: PsdColor | undefined | null): string | null {
  if (!color || typeof color !== 'object') return null;
  const { r, g, b, fr, fg, fb, c, m, y, k, l } = color;

  if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
    return `#${hex2(r / 255)}${hex2(g / 255)}${hex2(b / 255)}`;
  }
  if (typeof fr === 'number' && typeof fg === 'number' && typeof fb === 'number') {
    return `#${hex2(fr)}${hex2(fg)}${hex2(fb)}`;
  }
  if (
    typeof c === 'number' &&
    typeof m === 'number' &&
    typeof y === 'number' &&
    typeof k === 'number'
  ) {
    // Los descriptores de Photoshop (`CMYC`) dan las tintas en 0..100, con 100 =
    // tinta llena. La estructura de color BINARIA, en cambio, sale de ag-psd en
    // 0..255 (`readUint16 / 257`), así que el rango se deduce del propio valor:
    // sin esto, un color binario se pasaría de 100 y saldría negro entero.
    const tope = Math.max(c, m, y, k) > 100 ? 255 : 100;
    // Conversión ingenua a propósito: sin perfil ICC cualquier fórmula "buena"
    // sería igual de aproximada, y esta al menos es predecible.
    return (
      `#${hex2((1 - clamp01(c / tope)) * (1 - clamp01(k / tope)))}` +
      `${hex2((1 - clamp01(m / tope)) * (1 - clamp01(k / tope)))}` +
      `${hex2((1 - clamp01(y / tope)) * (1 - clamp01(k / tope)))}`
    );
  }
  if (typeof k === 'number' && typeof c !== 'number') {
    // Escala de grises (`GRYC`): un NIVEL de gris en 0..100, 0 = negro. No es la
    // K de CMYK, que va al revés; por eso se comprueba que no haya `c`.
    const v = clamp01(k / 100);
    return `#${hex2(v)}${hex2(v)}${hex2(v)}`;
  }
  if (typeof l === 'number') {
    // Lab sin conversión real: se usa solo la luminosidad. Es una aproximación
    // y quien la use debe anotarla como pérdida.
    const v = clamp01(l / 100);
    return `#${hex2(v)}${hex2(v)}${hex2(v)}`;
  }
  return null;
}

let idCounter = 0;
let idSeed = '';

/**
 * Ids deterministas Y ÚNICOS POR DOCUMENTO.
 *
 * Deterministas porque la conversión tiene que ser reproducible para poder
 * diffear dos pasadas. Únicos por documento porque, sin la sal del nombre, cada
 * PSD empieza en el mismo contador con las mismas semillas y el marco de TODOS
 * los diseños acababa con el mismo id: al convertir un pack entero, el 57 % de
 * los elementos chocaba entre ficheros.
 *
 * No es cosmético. Excalidraw indexa la escena por id: juntar dos páginas
 * importadas en un documento —copiar y pegar, o montar un carrusel con piezas
 * de dos plantillas— hacía que una tapara a la otra, que los `frameId` y los
 * `groupIds` apuntaran a la página equivocada y que borrar un elemento se
 * llevara por delante a su homónimo.
 */
function makeId(seed: string): string {
  idCounter += 1;
  let hash = 2166136261;
  const input = `${idSeed}:${seed}:${idCounter}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0') + idCounter.toString(36).padStart(3, '0');
}

/**
 * Reinicia el contador para que dos llamadas con la misma entrada coincidan.
 *
 * `seed` es la sal por documento: dos PSD distintos tienen que dar ids
 * distintos, o no se pueden juntar en una escena. Ver {@link makeId}.
 */
export function resetPsdIdCounter(seed = ''): void {
  idCounter = 0;
  idSeed = seed;
}

function baseElement(extra: Record<string, unknown>): SceneElement {
  return {
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    // 0 = trazo limpio. Un PSD no tiene nada dibujado a mano alzada y el
    // "roughness" de Excalidraw destrozaría la geometría que venimos de medir.
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
  } as unknown as SceneElement;
}

/**
 * Nombre PostScript de Photoshop → familia + estilo.
 *
 * Un PSD guarda "Montserrat-BoldItalic", no "Montserrat" + negrita + cursiva:
 * el estilo va DENTRO del nombre. Sin separarlos, cada peso de una misma
 * tipografía se registraría como una familia distinta y `resolveFontUrl` no
 * encontraría ninguna, porque los brand kits indexan por familia.
 */
export function splitPostScriptFont(raw: string): { family: string; style?: string } {
  const limpio = normalizeFontName(raw ?? '');
  if (!limpio) return { family: '' };
  const guion = limpio.indexOf('-');
  const base = guion > 0 ? limpio.slice(0, guion) : limpio;
  const style = guion > 0 ? limpio.slice(guion + 1) : undefined;
  // "HelveticaNeue" → "Helvetica Neue". Los nombres PostScript van pegados y
  // sin esto no casarían nunca con el "Helvetica Neue" de un brand kit.
  const familia = base
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return { family: familia, style: style ? style : undefined };
}

/** Pesos CSS por nombre, del más específico al más genérico. */
const PESOS: Array<[RegExp, string]> = [
  [/extrabold|ultrabold/i, '800'],
  [/semibold|demibold/i, '600'],
  [/extralight|ultralight/i, '200'],
  [/black|heavy/i, '900'],
  [/\bbold\b|bold/i, '700'],
  [/medium/i, '500'],
  [/light/i, '300'],
  [/\bthin\b|hairline/i, '100'],
];

/**
 * Sufijo PostScript ("BoldItalic") → `font-weight` + `font-style` de CSS.
 *
 * No es cosmético: `buildFontFaceCss` vuelca `style` tal cual en `font-style`,
 * y ahí "Bold" no es un valor válido — el navegador descarta el descriptor y la
 * fuente se pinta con el peso que sea. El peso tiene que ir en `weight`.
 */
export function postScriptStyleToCss(style: string | undefined): {
  weight?: string;
  style?: string;
} {
  if (!style) return {};
  const italic = /italic|oblique/i.test(style) ? 'italic' : undefined;
  const peso = PESOS.find(([re]) => re.test(style))?.[1];
  return { weight: peso, style: italic };
}

/** Justificación de Photoshop → `textAlign` de Excalidraw. */
function toTextAlign(justification: string | undefined): 'left' | 'center' | 'right' {
  switch (justification) {
    case 'right':
    case 'justify-right':
      return 'right';
    case 'center':
    case 'justify-center':
      return 'center';
    // 'justify-all' y 'justify-left' se quedan a la izquierda: Excalidraw no
    // justifica, y alinear a la izquierda es lo que menos mueve el bloque.
    default:
      return 'left';
  }
}

/** Nombre de capa → trozo de nombre de fichero utilizable. */
function slugify(name: string): string {
  const s = (name || 'capa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, 48) || 'capa';
}

// ─── Vectores ────────────────────────────────────────────────────────────────

/** Muestras por curva al aplanar un bézier. 12 no se distingue del original a
 *  tamaño de pantalla y no infla la escena como haría 32. */
const BEZIER_STEPS = 12;

/** Tope de subcaminos por defecto. Ver {@link PsdImportOptions.maxSubpaths}. */
export const DEFAULT_MAX_SUBPATHS = 64;

/** Subcaminos con geometría de verdad que tiene una capa. */
export function countSubpaths(layer: PsdLayer): number {
  return (layer.vectorMask?.paths ?? []).filter((p) => (p.knots?.length ?? 0) > 1).length;
}

function cubicAt(p0: number, c1: number, c2: number, p1: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p1;
}

/**
 * Un `BezierPath` de Photoshop → polilínea en píxeles del documento.
 *
 * Los nudos vienen `[cp_entrada, ancla, cp_salida]` (ag-psd ya los multiplica
 * por el tamaño del documento, ver `readBezierKnot`), así que el tramo entre el
 * nudo i y el i+1 es la cúbica ancla_i → salida_i → entrada_{i+1} → ancla_{i+1}.
 *
 * Un tramo cuyos dos controles coinciden con sus anclas es una recta: se emite
 * como un solo punto y no como 12, que es lo que mantiene manejable un logo con
 * cientos de esquinas.
 */
export function flattenBezierPath(path: PsdBezierPath): Array<[number, number]> {
  const knots = (path.knots ?? []).filter((k) => Array.isArray(k.points) && k.points.length >= 6);
  if (knots.length === 0) return [];

  const anchor = (i: number) => {
    const p = knots[i].points as number[];
    return [p[2], p[3]] as [number, number];
  };
  const out: Array<[number, number]> = [anchor(0)];
  const cerrado = path.open === false;
  const tramos = cerrado ? knots.length : knots.length - 1;

  for (let i = 0; i < tramos; i += 1) {
    const a = knots[i].points as number[];
    const b = knots[(i + 1) % knots.length].points as number[];
    const [ax, ay] = [a[2], a[3]];
    const [c1x, c1y] = [a[4], a[5]];
    const [c2x, c2y] = [b[0], b[1]];
    const [bx, by] = [b[2], b[3]];

    const recto = c1x === ax && c1y === ay && c2x === bx && c2y === by;
    if (recto) {
      out.push([bx, by]);
      continue;
    }
    for (let s = 1; s <= BEZIER_STEPS; s += 1) {
      const t = s / BEZIER_STEPS;
      out.push([cubicAt(ax, c1x, c2x, bx, t), cubicAt(ay, c1y, c2y, by, t)]);
    }
  }
  return out;
}

/** Tipos de `keyOriginType` que Photoshop sabe describir sin recurrir al path. */
const ORIGIN_RECT = 1;
const ORIGIN_ROUNDED_RECT = 2;
const ORIGIN_ELLIPSE = 4;
const ORIGIN_LINE = 5;

// ─── Conversión ──────────────────────────────────────────────────────────────

/** Estado que el recorrido de capas va acumulando. */
interface Walk {
  elements: SceneElement[];
  assets: PsdAssetSlot[];
  notes: PsdNote[];
  counts: Record<string, number>;
  caras: CustomFontFace[];
  fuentes: Map<string, boolean>;
  usados: Set<string>;
  total: number;
  converted: number;
  hidden: number;
  dropped: number;
  sawText: boolean;
  sawUnsupported: boolean;
}

interface PageCtx {
  index: number;
  frameId: string;
  /** Traslación de coordenadas de documento a coordenadas de escena. */
  dx: number;
  dy: number;
  scale: number;
}

function bump(w: Walk, key: string): void {
  w.counts[key] = (w.counts[key] ?? 0) + 1;
}

function note(w: Walk, page: number, layer: string, kind: PsdNote['kind'], detail: string): void {
  w.notes.push({ page, layer, kind, detail });
}

/**
 * Modos de fusión que Excalidraw reproduce (porque no hace nada raro con ellos).
 * Cualquier otro cambia el aspecto y se anota.
 */
const BLEND_OK = new Set(['normal', 'pass through', undefined as unknown as string]);

/** Nombre único de fichero dentro de una conversión. */
function uniqueFilename(w: Walk, base: string, ext: string): string {
  let candidato = `${base}.${ext}`;
  let n = 2;
  while (w.usados.has(candidato)) {
    candidato = `${base}-${n}.${ext}`;
    n += 1;
  }
  w.usados.add(candidato);
  return candidato;
}

/** Rectángulo visible de una capa: su bbox, recortado por la máscara si la hay. */
function visibleBounds(layer: PsdLayer): { left: number; top: number; right: number; bottom: number } {
  let left = num(layer.left);
  let top = num(layer.top);
  let right = num(layer.right);
  let bottom = num(layer.bottom);
  const m = layer.mask;
  if (m && m.disabled !== true && typeof m.left === 'number' && typeof m.right === 'number') {
    left = Math.max(left, num(m.left));
    top = Math.max(top, num(m.top));
    right = Math.min(right, num(m.right));
    bottom = Math.min(bottom, num(m.bottom));
  }
  return { left, top, right, bottom };
}

/**
 * Propiedades comunes a todo elemento nacido de una capa: opacidad, bloqueo y
 * pertenencia a la página y a los grupos.
 */
function commonProps(
  layer: PsdLayer,
  page: PageCtx,
  groupIds: string[],
  inherited = 1,
): Record<string, unknown> {
  // `opacity` de ag-psd es 0..1; `fillOpacity` es un segundo factor que en
  // Photoshop solo afecta al relleno. Multiplicarlos es la aproximación honesta:
  // sin trazo aparte, relleno y capa son lo mismo para nosotros.
  //
  // `inherited` trae la opacidad de los grupos de encima. Excalidraw no tiene
  // opacidad de grupo, así que se reparte entre los hijos: no es lo mismo (dos
  // hijos que se solapan se ven distinto), pero un grupo al 20% que se pinta
  // opaco sí es un error visible, y esto no lo es.
  const o = num(layer.opacity, 1) * num(layer.fillOpacity, 1) * inherited;
  return {
    opacity: Math.round(clamp01(o) * 100),
    frameId: page.frameId,
    groupIds: groupIds.slice(),
  };
}

/** Aplica a un elemento el efecto de trazo de la capa, si lo tiene activo. */
function applyStrokeEffect(
  layer: PsdLayer,
  props: Record<string, unknown>,
  scale: number,
): boolean {
  const trazo = layer.effects?.stroke?.find(isOn);
  if (!trazo) return false;
  const color = psdColorToHex(trazo.color);
  if (!color) return false;
  props.strokeColor = color;
  props.strokeWidth = Math.max(0.5, unitsToPx(trazo.size) * scale);
  return true;
}

/** ¿Este efecto está puesto de verdad? Ver {@link PsdEffect}. */
function isOn(fx: PsdEffect | undefined | null): boolean {
  return Boolean(fx) && fx!.enabled !== false && fx!.present !== false;
}

const anyOn = (fx: PsdEffect[] | undefined): boolean => (fx ?? []).some(isOn);

/** Anota los efectos de capa ACTIVOS que no se pueden representar. */
function noteEffects(w: Walk, layer: PsdLayer, page: number, nombre: string): void {
  const e = layer.effects;
  if (!e || e.disabled === true) return;
  const perdidos: string[] = [];
  if (anyOn(e.dropShadow)) perdidos.push('sombra paralela');
  if (anyOn(e.innerShadow)) perdidos.push('sombra interior');
  if (isOn(e.outerGlow)) perdidos.push('resplandor exterior');
  if (isOn(e.innerGlow)) perdidos.push('resplandor interior');
  if (isOn(e.bevel)) perdidos.push('bisel');
  if (isOn(e.satin)) perdidos.push('satinado');
  if (anyOn(e.gradientOverlay)) perdidos.push('superposición de degradado');
  if (isOn(e.patternOverlay)) perdidos.push('superposición de motivo');
  if (perdidos.length) {
    note(w, page, nombre, 'lossy', `efectos no representables: ${perdidos.join(', ')}`);
  }
}

/** Color de relleno efectivo de una capa de forma. */
function fillColorOf(layer: PsdLayer): { color: string | null; approx: boolean } {
  // La superposición de color GANA al relleno vectorial: es lo que se ve.
  const overlay = layer.effects?.solidFill?.find(isOn);
  const overlayHex = psdColorToHex(overlay?.color);
  if (overlayHex) return { color: overlayHex, approx: false };

  const fill = layer.vectorFill;
  if (!fill) return { color: null, approx: false };
  if (fill.type === 'color') return { color: psdColorToHex(fill.color), approx: false };
  // Degradado o motivo: Excalidraw solo tiene color plano. Se coge la primera
  // parada para que la forma no salga transparente, y se marca aproximado.
  const parada = fill.gradient?.colorStops?.[0]?.color;
  const hex = psdColorToHex(parada);
  return { color: hex, approx: hex !== null };
}

// ─── Capas de texto ──────────────────────────────────────────────────────────

interface RunGroup {
  text: string;
  style: PsdTextStyle;
}

/**
 * Parte el texto en grupos de estilo consecutivos.
 *
 * Excalidraw es UN estilo por elemento; Photoshop permite uno por carácter. Los
 * `styleRuns` que comparten tamaño, color y familia se funden, así que un texto
 * uniforme —el caso normal— sale como un único elemento y solo se trocea cuando
 * de verdad hay estilos mezclados.
 */
export function groupStyleRuns(text: string, textData: PsdText): RunGroup[] {
  const runs = textData.styleRuns ?? [];
  const base = textData.style ?? {};
  if (runs.length === 0) return text ? [{ text, style: base }] : [];

  const clave = (s: PsdTextStyle) =>
    `${s.fontSize ?? ''}|${s.font?.name ?? ''}|${psdColorToHex(s.fillColor) ?? ''}|${s.leading ?? ''}`;

  const grupos: RunGroup[] = [];
  let cursor = 0;
  for (const run of runs) {
    const len = num(run.length);
    if (len <= 0) continue;
    const trozo = text.slice(cursor, cursor + len);
    cursor += len;
    if (!trozo) continue;
    const estilo = { ...base, ...(run.style ?? {}) };
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && clave(ultimo.style) === clave(estilo)) ultimo.text += trozo;
    else grupos.push({ text: trozo, style: estilo });
  }
  // Cola sin run declarado (pasa cuando los runs no suman la longitud total).
  if (cursor < text.length) {
    const trozo = text.slice(cursor);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && clave(ultimo.style) === clave(base)) ultimo.text += trozo;
    else grupos.push({ text: trozo, style: base });
  }
  return grupos.filter((g) => g.text.length > 0);
}

/**
 * Caja del texto en coordenadas de documento.
 *
 * Se prefieren los datos del propio motor de texto (`transform` + `boxBounds` o
 * `boundingBox`) al bbox de la capa: el bbox rasterizado incluye lo que pinten
 * las sombras y el resplandor, así que colocar por él desplaza el texto. Si el
 * PSD no trae ninguno de los dos, el bbox es el único dato que queda.
 */
function textBox(
  layer: PsdLayer,
  t: PsdText,
): { x: number; y: number; width: number; height: number; scale: number } {
  const tr = Array.isArray(t.transform) && t.transform.length >= 6 ? t.transform : null;
  const sx = tr ? Math.hypot(tr[0], tr[1]) || 1 : 1;
  const sy = tr ? Math.hypot(tr[2], tr[3]) || 1 : 1;
  const tx = tr ? tr[4] : 0;
  const ty = tr ? tr[5] : 0;

  if (tr && Array.isArray(t.boxBounds) && t.boxBounds.length >= 4) {
    const [l, top, r, b] = t.boxBounds;
    return {
      x: tx + l * sx,
      y: ty + top * sy,
      width: (r - l) * sx,
      height: (b - top) * sy,
      scale: sx,
    };
  }

  const bb = t.boundingBox ?? t.bounds;
  if (tr && bb && bb.left && bb.right) {
    const l = unitsToPx(bb.left);
    const top = unitsToPx(bb.top);
    const r = unitsToPx(bb.right);
    const b = unitsToPx(bb.bottom);
    return {
      x: tx + l * sx,
      y: ty + top * sy,
      width: (r - l) * sx,
      height: (b - top) * sy,
      scale: sx,
    };
  }

  const vb = visibleBounds(layer);
  return {
    x: vb.left,
    y: vb.top,
    width: vb.right - vb.left,
    height: vb.bottom - vb.top,
    scale: sx,
  };
}

function convertText(
  w: Walk,
  layer: PsdLayer,
  page: PageCtx,
  groupIds: string[],
  inherited: number,
  options: PsdImportOptions,
): void {
  const t = layer.text!;
  const nombre = layer.name || 'texto';
  const crudo = typeof t.text === 'string' ? t.text : '';
  // Photoshop termina las líneas con CR; sin normalizar, Excalidraw pinta el
  // párrafo entero en una sola línea con cuadraditos.
  const texto = crudo.replace(/\r\n?/g, '\n').replace(/\u0003/g, '\n');
  if (!texto.trim()) {
    w.dropped += 1;
    note(w, page.index, nombre, 'dropped', 'capa de texto vacía');
    return;
  }

  const caja = textBox(layer, t);
  const align = toTextAlign(t.paragraphStyle?.justification);
  const grupos = groupStyleRuns(texto, t);
  if (grupos.length > 1) {
    note(
      w,
      page.index,
      nombre,
      'lossy',
      `estilos mixtos: 1 capa → ${grupos.length} elementos (Excalidraw es un estilo por elemento)`,
    );
  }
  noteEffects(w, layer, page.index, nombre);
  if (!BLEND_OK.has(layer.blendMode as string)) {
    note(w, page.index, nombre, 'lossy', `modo de fusión "${layer.blendMode}" no soportado`);
  }

  const S = page.scale;
  let cursorY = page.dy + caja.y * S;

  for (const grupo of grupos) {
    const estilo = grupo.style;
    // El tamaño del PSD está en el espacio SIN transformar: la escala del texto
    // vive en la matriz. Sin multiplicar, un texto agrandado a mano sale diminuto.
    const size = Math.max(1, num(estilo.fontSize, 20) * caja.scale * S);
    const leading = estilo.autoLeading === false ? num(estilo.leading) : 0;
    const lineHeight = leading > 0 ? Math.max(0.5, leading / num(estilo.fontSize, 20)) : 1.25;
    const lineas = grupo.text.split('\n').length;
    const alto = lineas * size * lineHeight;

    let fontFamily = DEFAULT_FONT_FAMILY;
    const psName = estilo.font?.name ?? '';
    if (psName) {
      const { family, style } = splitPostScriptFont(psName);
      if (family) {
        const fichero = options.resolveFontUrl?.(family, style) ?? null;
        w.fuentes.set(family, (w.fuentes.get(family) ?? false) || fichero !== null);
        if (fichero) {
          fontFamily = customFontFamilyId(family);
          // El peso y la inclinación salen del sufijo PostScript ("Bold",
          // "BoldItalic") salvo que quien resuelve el fichero los dé ya hechos.
          const css = postScriptStyleToCss(fichero.style ?? style);
          w.caras.push({
            family: fontFamilyAlias(family),
            src: normalizeFontSrc(fichero.url),
            weight: fichero.weight ?? css.weight,
            style: css.style,
          });
        } else {
          note(
            w,
            page.index,
            nombre,
            'lossy',
            `sin fichero para la fuente "${psName}"; se usa la de respaldo`,
          );
        }
      }
    }

    const props = {
      ...commonProps(layer, page, groupIds, inherited),
      id: makeId(`txt-${page.index}-${nombre}`),
      type: 'text',
      x: page.dx + caja.x * S,
      y: cursorY,
      width: Math.max(1, caja.width * S),
      height: Math.max(1, alto),
      text: grupo.text,
      originalText: grupo.text,
      fontSize: size,
      fontFamily,
      textAlign: align,
      verticalAlign: 'top',
      containerId: null,
      lineHeight,
      // false: la caja la manda el PSD. Con autoResize, Excalidraw remide el
      // texto con SU tipografía y el bloque deja de coincidir con el original.
      autoResize: false,
      strokeColor: psdColorToHex(estilo.fillColor) ?? '#1e1e1e',
    } as Record<string, unknown>;

    w.elements.push(baseElement(props));
    cursorY += alto;
  }
  bump(w, 'text');
}

// ─── Capas de forma ──────────────────────────────────────────────────────────

function convertShape(
  w: Walk,
  layer: PsdLayer,
  page: PageCtx,
  groupIds: string[],
  inherited: number,
): void {
  const nombre = layer.name || 'forma';
  const S = page.scale;
  const desc = layer.vectorOrigination?.keyDescriptorList?.[0];
  const tipo = desc?.keyOriginType;
  const { color, approx } = fillColorOf(layer);
  if (approx) {
    note(w, page.index, nombre, 'lossy', 'relleno no plano (degradado o motivo) → color de la primera parada');
  }
  noteEffects(w, layer, page.index, nombre);
  if (!BLEND_OK.has(layer.blendMode as string)) {
    note(w, page.index, nombre, 'lossy', `modo de fusión "${layer.blendMode}" no soportado`);
  }

  const props: Record<string, unknown> = {
    ...commonProps(layer, page, groupIds, inherited),
    backgroundColor: color ?? 'transparent',
    fillStyle: 'solid',
    // Sin trazo el rectángulo de Excalidraw se pinta igual con su borde negro
    // por defecto, y una forma de color plano acabaría con un contorno que el
    // PSD no tiene. Transparente salvo que la capa declare trazo de verdad.
    strokeColor: 'transparent',
    strokeWidth: 1,
  };

  const trazoVec = layer.vectorStroke;
  if (trazoVec && trazoVec.strokeEnabled !== false) {
    const c = psdColorToHex(trazoVec.content?.color);
    if (c) {
      props.strokeColor = c;
      props.strokeWidth = Math.max(0.5, unitsToPx(trazoVec.lineWidth) * S);
      if (trazoVec.lineDashSet?.length) props.strokeStyle = 'dashed';
    }
  }
  applyStrokeEffect(layer, props, S);

  // La caja que Photoshop declaró para la forma es más fiel que el bbox
  // rasterizado, que crece con los efectos.
  const bbox = desc?.keyOriginShapeBoundingBox;
  const vb = visibleBounds(layer);
  const left = bbox?.left ? unitsToPx(bbox.left) : vb.left;
  const top = bbox?.top ? unitsToPx(bbox.top) : vb.top;
  const right = bbox?.right ? unitsToPx(bbox.right) : vb.right;
  const bottom = bbox?.bottom ? unitsToPx(bbox.bottom) : vb.bottom;
  const x = page.dx + left * S;
  const y = page.dy + top * S;
  const width = Math.max(1, (right - left) * S);
  const height = Math.max(1, (bottom - top) * S);

  if (tipo === ORIGIN_ELLIPSE) {
    w.elements.push(
      baseElement({ ...props, id: makeId(`ell-${page.index}-${nombre}`), type: 'ellipse', x, y, width, height }),
    );
    bump(w, 'shape:ellipse');
    return;
  }

  if (tipo === ORIGIN_RECT || tipo === ORIGIN_ROUNDED_RECT) {
    const radios = desc?.keyOriginRRectRadii;
    const r = radios
      ? Math.max(
          unitsToPx(radios.topLeft),
          unitsToPx(radios.topRight),
          unitsToPx(radios.bottomLeft),
          unitsToPx(radios.bottomRight),
        )
      : 0;
    if (
      radios &&
      new Set(
        [radios.topLeft, radios.topRight, radios.bottomLeft, radios.bottomRight].map(unitsToPx),
      ).size > 1
    ) {
      note(w, page.index, nombre, 'lossy', 'radios de esquina distintos → Excalidraw solo tiene uno');
    }
    w.elements.push(
      baseElement({
        ...props,
        id: makeId(`rec-${page.index}-${nombre}`),
        type: 'rectangle',
        x,
        y,
        width,
        height,
        // `adaptive` es el redondeo variable de Excalidraw; `proportional` con
        // un valor fijo es lo que respeta el radio que puso el diseñador.
        roundness: r > 0 ? { type: 2, value: r * S } : null,
      }),
    );
    bump(w, tipo === ORIGIN_ROUNDED_RECT ? 'shape:roundedRect' : 'shape:rect');
    return;
  }

  // Camino libre (o línea): se aplana a polilínea. Es la única forma de que un
  // logo vectorial llegue como vector y no como caja gris.
  const paths = (layer.vectorMask?.paths ?? []).filter((p) => (p.knots?.length ?? 0) > 1);
  if (paths.length === 0) {
    // Sin descriptor y sin camino no queda geometría: se cae al rectángulo del
    // bbox, que al menos conserva sitio, tamaño y color.
    w.elements.push(
      baseElement({ ...props, id: makeId(`rec-${page.index}-${nombre}`), type: 'rectangle', x, y, width, height }),
    );
    bump(w, 'shape:bbox');
    note(w, page.index, nombre, 'lossy', 'forma sin geometría legible → rectángulo de su caja');
    return;
  }

  if (paths.length > 1) {
    note(
      w,
      page.index,
      nombre,
      'lossy',
      `${paths.length} subcaminos → ${paths.length} elementos (Excalidraw no tiene caminos compuestos, ni agujeros)`,
    );
  }

  for (const path of paths) {
    const puntos = flattenBezierPath(path);
    if (puntos.length < 2) continue;
    const cerrado = path.open === false;
    const xs = puntos.map((p) => p[0]);
    const ys = puntos.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const locales = puntos.map(([px, py]) => [(px - minX) * S, (py - minY) * S] as [number, number]);
    // Excalidraw rellena una línea SOLO si el camino se cierra sobre sí mismo
    // (primer punto === último). Sin repetir el punto, un logo sale como
    // contorno hueco.
    if (cerrado) locales.push([locales[0][0], locales[0][1]]);

    w.elements.push(
      baseElement({
        ...props,
        id: makeId(`pth-${page.index}-${nombre}`),
        type: 'line',
        x: page.dx + minX * S,
        y: page.dy + minY * S,
        width: (Math.max(...xs) - minX) * S,
        height: (Math.max(...ys) - minY) * S,
        points: locales,
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        // Un camino abierto no es una silueta rellenable: pintarlo relleno
        // inventaría una forma que el PSD no dibuja.
        backgroundColor: cerrado ? (props.backgroundColor as string) : 'transparent',
        strokeColor: cerrado
          ? (props.strokeColor as string)
          : ((props.strokeColor as string) === 'transparent' ? (color ?? '#1e1e1e') : props.strokeColor),
      }),
    );
  }
  bump(w, tipo === ORIGIN_LINE ? 'shape:line' : 'shape:path');
}

// ─── Capas de píxeles → placeholder ──────────────────────────────────────────

function convertRaster(
  w: Walk,
  layer: PsdLayer,
  page: PageCtx,
  groupIds: string[],
  inherited: number,
  address: number[],
  path: string[],
  documentName: string,
): void {
  const nombre = layer.name || 'imagen';
  const S = page.scale;
  const vb = visibleBounds(layer);
  const naturalWidth = Math.round(vb.right - vb.left);
  const naturalHeight = Math.round(vb.bottom - vb.top);
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    w.dropped += 1;
    note(w, page.index, nombre, 'dropped', 'capa de píxeles sin área visible');
    return;
  }

  if (layer.mask && layer.mask.disabled !== true) {
    note(
      w,
      page.index,
      nombre,
      'lossy',
      'máscara de capa → el hueco se recorta a la caja visible (Excalidraw no tiene máscaras)',
    );
  }
  if (layer.clipping) {
    note(w, page.index, nombre, 'lossy', 'máscara de recorte no soportada');
  }
  if (!BLEND_OK.has(layer.blendMode as string)) {
    note(w, page.index, nombre, 'lossy', `modo de fusión "${layer.blendMode}" no soportado`);
  }
  noteEffects(w, layer, page.index, nombre);

  const x = page.dx + vb.left * S;
  const y = page.dy + vb.top * S;
  const width = Math.max(1, naturalWidth * S);
  const height = Math.max(1, naturalHeight * S);

  const slotId = makeId(`img-${page.index}-${nombre}`);
  const filename = uniqueFilename(
    w,
    `${slugify(documentName)}-p${page.index + 1}-${slugify([...path, nombre].join('-'))}`,
    'png',
  );

  // El hueco y su etiqueta van en el MISMO grupo para que arrastrarlo mueva las
  // dos cosas: media caja suelta por el lienzo no se entiende.
  const grupo = makeId(`imggrp-${page.index}-${nombre}`);
  const gruposConHueco = [grupo, ...groupIds];

  w.elements.push(
    baseElement({
      ...commonProps(layer, page, gruposConHueco, inherited),
      id: slotId,
      type: 'rectangle',
      x,
      y,
      width,
      height,
      backgroundColor: PLACEHOLDER_FILL,
      fillStyle: 'solid',
      strokeColor: PLACEHOLDER_STROKE,
      strokeStyle: 'dashed',
      strokeWidth: 1,
      roundness: null,
      // La proporción original viaja en el propio elemento: quien cambie el
      // hueco por la foto de verdad puede comprobar que no la deforma.
      customData: {
        c2: PSD_IMAGE_MARKER,
        psd: { layer: nombre, path, asset: filename, naturalWidth, naturalHeight },
      },
    }),
  );

  // Etiqueta: sin ella la página convertida es una sucesión de cajas grises
  // indistinguibles y no hay forma de saber qué foto va en cada una.
  const size = Math.max(10, Math.min(28, Math.min(width, height) / 10));
  const etiqueta = `${nombre}\n${naturalWidth}×${naturalHeight}`;
  const alto = 2 * size * 1.25;
  w.elements.push(
    baseElement({
      ...commonProps(layer, page, gruposConHueco, inherited),
      id: makeId(`imglbl-${page.index}-${nombre}`),
      type: 'text',
      x,
      y: y + Math.max(0, (height - alto) / 2),
      width,
      height: alto,
      text: etiqueta,
      originalText: etiqueta,
      fontSize: size,
      fontFamily: DEFAULT_FONT_FAMILY,
      textAlign: 'center',
      verticalAlign: 'top',
      containerId: null,
      lineHeight: 1.25,
      autoResize: false,
      strokeColor: PLACEHOLDER_TEXT,
    }),
  );

  w.assets.push({
    id: slotId,
    name: nombre,
    page: page.index,
    path,
    naturalWidth,
    naturalHeight,
    filename,
    address,
  });
  bump(w, 'image');
}

// ─── Recorrido ───────────────────────────────────────────────────────────────

/** ¿Esta capa es una carpeta de grupo? */
function isGroup(layer: PsdLayer): boolean {
  return Array.isArray(layer.children);
}

/** ¿Esta capa dibuja algo con vectores? */
function isShape(layer: PsdLayer): boolean {
  return Boolean(layer.vectorFill || layer.vectorMask || layer.vectorOrigination);
}

/**
 * Una capa, con su dirección YA resuelta.
 *
 * Está separada de `walkLayers` porque `address` tiene que poder recorrerse
 * desde `psd.children` tal cual (`psd.children[a].children[b]…`): es lo único
 * que le permite al importador volver a por los píxeles de una capa sin que
 * este módulo los haya tocado. En un PSD con mesas de trabajo las capas de
 * primer nivel se recorren FILTRADAS (mesas por un lado, sueltas por otro), así
 * que el índice del bucle NO es el índice real; quien llama pasa el bueno.
 */
function walkLayer(
  w: Walk,
  layer: PsdLayer,
  page: PageCtx,
  groupIds: string[],
  inherited: number,
  dir: number[],
  path: string[],
  options: PsdImportOptions,
  documentName: string,
): void {
  const nombre = layer.name || `capa ${dir[dir.length - 1] + 1}`;
  w.total += 1;
  // Marca de agua para saber DESPUÉS si esta capa produjo algo. Contar dentro
  // de cada conversor mezclaba capas con elementos: una forma de 911 subcaminos
  // sumaba 911 "capas convertidas" y el informe decía más convertidas que
  // vistas. Aquí la cuenta es una capa, una unidad.
  const antes = w.elements.length;
  const cuenta = () => {
    if (w.elements.length > antes) w.converted += 1;
  };

  if (layer.hidden === true && !options.includeHidden) {
    w.hidden += 1;
    bump(w, 'hidden');
    return;
  }

  if (isGroup(layer)) {
    bump(w, 'group');
    // Un grupo de Photoshop es un grupo de Excalidraw: se pierde el
    // plegado, pero mover el conjunto sigue moviendo el conjunto.
    const gid = makeId(`grp-${page.index}-${nombre}`);
    if (layer.blendMode && layer.blendMode !== 'pass through' && layer.blendMode !== 'normal') {
      note(w, page.index, nombre, 'lossy', `grupo con modo de fusión "${layer.blendMode}"`);
    }
    if (num(layer.opacity, 1) < 1) {
      // Excalidraw no tiene opacidad de grupo: se aplica capa a capa, que se
      // ve distinto en cuanto dos hijos se solapan.
      note(w, page.index, nombre, 'lossy', 'opacidad de grupo → aplicada a cada hijo');
    }
    walkLayers(
      w,
      layer.children!,
      page,
      [gid, ...groupIds],
      // La opacidad del grupo BAJA a sus hijos: es lo que la nota de arriba
      // promete, y sin esto un grupo al 20% se pintaba opaco.
      inherited * clamp01(num(layer.opacity, 1)),
      dir,
      [...path, nombre],
      options,
      documentName,
    );
    // El grupo cuenta como convertido si su contenido dio algo. Si no dio nada
    // —hijos todos ocultos, por ejemplo— no es una pérdida suya: los hijos ya
    // están contados en su propio cajón.
    cuenta();
    return;
  }

  if (layer.text) {
    w.sawText = true;
    convertText(w, layer, page, groupIds, inherited, options);
    cuenta();
    return;
  }

  if (isShape(layer)) {
    // TEXTURA, NO FORMA. Una capa con cientos de subcaminos es una mancha de
    // pincel, no un dibujo que nadie vaya a editar nudo a nudo: vectorizarla
    // produce megabytes de polilíneas y un lienzo que no se puede mover. Como
    // Photoshop guarda además su versión rasterizada, tratarla como imagen
    // conserva el aspecto EXACTO y deja la escena en kilobytes.
    const subcaminos = countSubpaths(layer);
    const tope = options.maxSubpaths ?? DEFAULT_MAX_SUBPATHS;
    if (subcaminos > tope && (layer.imageData || layer.canvas)) {
      note(
        w,
        page.index,
        nombre,
        'lossy',
        `${subcaminos} subcaminos (tope ${tope}) → se trata como imagen; ` +
          'sus píxeles salen en .assets/ y conserva su aspecto',
      );
      convertRaster(w, layer, page, groupIds, inherited, dir, path, documentName);
      cuenta();
      return;
    }
    convertShape(w, layer, page, groupIds, inherited);
    cuenta();
    return;
  }

  if (layer.adjustment) {
    // Una capa de ajuste modifica lo que tiene debajo. Excalidraw no compone
    // nada: representarla como un rectángulo mentiría más que omitirla.
    w.dropped += 1;
    w.sawUnsupported = true;
    bump(w, 'adjustment');
    note(w, page.index, nombre, 'dropped', 'capa de ajuste (no se puede componer en Excalidraw)');
    return;
  }

  if (layer.imageData || layer.canvas || layer.placedLayer) {
    if (layer.placedLayer) {
      note(
        w,
        page.index,
        nombre,
        'lossy',
        'objeto inteligente → hueco de imagen con su tamaño colocado (se pierde el original enlazado)',
      );
    }
    convertRaster(w, layer, page, groupIds, inherited, dir, path, documentName);
    // `convertRaster` puede rendirse (una capa sin área visible) y ya lo apunta
    // en `dropped`; por eso la cuenta mira si de verdad salió algo.
    cuenta();
    return;
  }

  // Capa sin píxeles, sin vectores y sin texto: en un PSD suele ser una capa
  // vacía o un separador. Se cuenta pero no es una pérdida real.
  w.dropped += 1;
  bump(w, 'empty');
  note(w, page.index, nombre, 'dropped', 'capa sin contenido representable');
}

/** Recorre una lista de hijos cuyos índices SÍ son los reales dentro del padre. */
function walkLayers(
  w: Walk,
  layers: PsdLayer[],
  page: PageCtx,
  groupIds: string[],
  inherited: number,
  address: number[],
  path: string[],
  options: PsdImportOptions,
  documentName: string,
): void {
  // El array de ag-psd va de ABAJO a arriba y Excalidraw pinta en orden de
  // array, así que el orden se conserva tal cual: índice 0 = capa de fondo.
  layers.forEach((layer, i) => {
    walkLayer(w, layer, page, groupIds, inherited, [...address, i], path, options, documentName);
  });
}

// ─── Entrada pública ─────────────────────────────────────────────────────────

/**
 * Convierte un documento de Photoshop YA PARSEADO en una escena de canvas2.
 *
 * Las mesas de trabajo (artboards) se convierten en páginas: si el PSD tiene,
 * cada una es un frame; si no, el documento entero es una página. En los dos
 * casos las páginas se colocan en fila con la separación `PAGE_GAP` del editor,
 * y cada una lleva su "papel" con el marcador que espera `background.ts`, así
 * que un diseño importado se comporta igual que uno creado a mano.
 */
export function psdToScene(psd: PsdDocument, options: PsdImportOptions = {}): PsdScene {
  const S = options.scale && options.scale > 0 ? options.scale : 1;
  const docW = Math.max(1, num(psd.width, 1080));
  const docH = Math.max(1, num(psd.height, 1350));
  const documentName = options.documentName || 'psd';
  // El nombre del documento sala los ids. Con `documentName` distinto —que es
  // lo que pasa al convertir un pack— dos diseños nunca comparten un id, y se
  // pueden juntar en una misma escena sin remapear nada.
  resetPsdIdCounter(documentName);

  const w: Walk = {
    elements: [],
    assets: [],
    notes: [],
    counts: {},
    caras: [],
    fuentes: new Map(),
    usados: new Set(),
    total: 0,
    converted: 0,
    hidden: 0,
    dropped: 0,
    sawText: false,
    sawUnsupported: false,
  };

  const raiz = psd.children ?? [];
  // Photoshop marca las mesas de trabajo como grupos de primer nivel con
  // `artboard`. Mirar solo el primero no vale: un PSD puede mezclar mesas con
  // capas sueltas, y esas van a una página aparte.
  //
  // Se guarda el índice REAL dentro de `raiz` junto a cada capa: es el primer
  // tramo del `address` de sus assets, y con los arrays ya filtrados el índice
  // del bucle apuntaría a otra capa al ir a buscar los píxeles.
  const mesas = raiz.map((l, i) => ({ l, i })).filter(({ l }) => l.artboard?.rect);
  const sueltas = raiz.map((l, i) => ({ l, i })).filter(({ l }) => !l.artboard?.rect);

  let offsetX = 0;

  const abrePagina = (
    index: number,
    nombre: string,
    left: number,
    top: number,
    width: number,
    height: number,
    fondo: string,
  ): PageCtx => {
    const frameId = makeId(`frame-${index}`);
    const pw = Math.max(1, width * S);
    const ph = Math.max(1, height * S);
    w.elements.push(
      baseElement({
        id: frameId,
        type: 'frame',
        x: offsetX,
        y: 0,
        width: pw,
        height: ph,
        name: nombre,
        strokeColor: '#bbb',
      }),
    );
    w.elements.push(
      baseElement({
        id: makeId(`paper-${index}`),
        type: 'rectangle',
        x: offsetX,
        y: 0,
        width: pw,
        height: ph,
        backgroundColor: fondo,
        fillStyle: 'solid',
        strokeColor: '#d4d4d8',
        strokeWidth: 1,
        roundness: null,
        locked: true,
        frameId,
        customData: { c2: BG_MARKER },
      }),
    );
    // `dx`/`dy` llevan las coordenadas de DOCUMENTO a las de escena: restan el
    // origen de la mesa (que puede ser negativo) y suman el carril de la página.
    return { index, frameId, dx: offsetX - left * S, dy: -top * S, scale: S };
  };

  if (mesas.length > 0) {
    mesas.forEach(({ l: mesa, i: real }, i) => {
      const r = mesa.artboard!.rect!;
      const left = num(r.left);
      const top = num(r.top);
      const width = Math.max(1, num(r.right) - left);
      const height = Math.max(1, num(r.bottom) - top);
      const fondo = psdColorToHex(mesa.artboard?.color) ?? PAPER_COLOR;
      const page = abrePagina(i, mesa.name || `Mesa ${i + 1}`, left, top, width, height, fondo);
      // Los hijos de la mesa se recorren SIN crear grupo por ella: la mesa ya
      // es la página, y un grupo extra haría que seleccionar cualquier cosa
      // seleccionara la página entera.
      walkLayers(w, mesa.children ?? [], page, [], 1, [real], [], options, documentName);
      offsetX += Math.max(1, width * S) + PAGE_GAP;
    });
    if (sueltas.length > 0) {
      const page = abrePagina(mesas.length, 'Fuera de mesa', 0, 0, docW, docH, PAPER_COLOR);
      for (const { l, i: real } of sueltas) {
        walkLayer(w, l, page, [], 1, [real], [], options, documentName);
      }
      offsetX += Math.max(1, docW * S) + PAGE_GAP;
    }
  } else {
    const page = abrePagina(0, documentName || 'Página 1', 0, 0, docW, docH, PAPER_COLOR);
    walkLayers(w, raiz, page, [], 1, [], [], options, documentName);
  }

  const pages = mesas.length > 0 ? mesas.length + (sueltas.length > 0 ? 1 : 0) : 1;

  // T1 = geometría y color, nada que revisar. T2 = hay texto, que es lo que
  // más se mueve al cambiar de motor de tipografía. T3 = algo no se pudo
  // representar y el resultado NO equivale al original.
  const tier: PsdTier = w.sawUnsupported ? 'T3' : w.sawText ? 'T2' : 'T1';

  return {
    elements: w.elements,
    files: {},
    fonts: dedupeFontFaces(w.caras),
    assets: w.assets,
    report: {
      document: { width: docW, height: docH, scale: S },
      pages,
      tier,
      layers: {
        total: w.total,
        converted: w.converted,
        hidden: w.hidden,
        dropped: w.dropped,
      },
      // Marcos y papeles fuera: son andamiaje de la página, no contenido.
      elements: w.elements.filter(
        (e) => (e as unknown as { type?: string }).type !== 'frame',
      ).length - pages,
      counts: w.counts,
      fonts: [...w.fuentes].map(([name, resolved]) => ({ name, resolved })),
      notes: w.notes,
      clean: w.notes.length === 0,
    },
  };
}

/** Un hueco de imagen ya colocado en la escena, listo para recibir su foto. */
export interface PsdImagePlaceholder {
  id: string;
  layer: string;
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Localiza en una escena los huecos que dejó la importación.
 *
 * Es la otra mitad del contrato: sin esto, el placeholder sería un callejón sin
 * salida. Con esto, el host recorre los huecos, sube cada PNG a MediaMonster y
 * llama a `insertImageFromUrl` con la geometría exacta que ya venía anotada.
 */
export function listImagePlaceholders(
  elements: readonly SceneElement[],
): PsdImagePlaceholder[] {
  const out: PsdImagePlaceholder[] = [];
  for (const el of elements) {
    const cd = (el as { customData?: { c2?: string; psd?: Record<string, unknown> } }).customData;
    if (cd?.c2 !== PSD_IMAGE_MARKER || !cd.psd) continue;
    const e = el as unknown as { id: string; x: number; y: number; width: number; height: number };
    out.push({
      id: e.id,
      layer: String(cd.psd.layer ?? ''),
      asset: String(cd.psd.asset ?? ''),
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      naturalWidth: num(cd.psd.naturalWidth),
      naturalHeight: num(cd.psd.naturalHeight),
    });
  }
  return out;
}
