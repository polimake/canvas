import type { SceneElement } from '../core/excal';
import { PAGE_GAP } from '../core/layout';
import {
  customFontFamilyId,
  dedupeFontFaces,
  fontFamilyAlias,
  normalizeFontName,
  normalizeFontSrc,
  type CustomFontFace,
} from '../core/fonts';

/**
 * Conversión polimake-canvas (legacy) → escena de Excalidraw.
 *
 * El `editorConfig` legacy es un array de páginas con las claves minificadas por
 * `packages/canvas/src/image/utils/minifier.ts` (`dataMapping`): a=name, c=layers,
 * d=ROOT, e=type, f=resolvedName, g=props, h=boxSize, i=width, j=height,
 * k=position, l=x, m=y, n=rotate, o=color, p=image, r=locked, s=child, t=parent,
 * u=scale, v=text, w=fonts, y=url, aj=thumb…
 *
 * Aquí NO se importa `@excalidraw/*` (solo el tipo, vía ./excal): la salida son
 * objetos planos, así la función es pura y testeable en node sin el editor.
 *
 * Deliberadamente sin dependencias de DOM: el HTML de las capas de texto se
 * parsea con expresiones regulares sobre el subconjunto que el editor legacy
 * genera (`<p style="…"><strong><span style="color:…">texto</span></strong></p>`),
 * no con un parser completo. Cualquier cosa fuera de ese molde se reporta.
 */

// ─── Modelo legacy (solo lo que se lee) ──────────────────────────────────────
/** Nodo de props legacy: valores anidados de tipo desconocido, leídos con `num()`/guardas. */
type LegacyProps = Record<string, unknown> & {
  h?: { i?: number; j?: number };
  k?: { l?: number; m?: number; x?: number; y?: number };
  p?: {
    y?: string;
    aj?: string;
    h?: { i?: number; j?: number };
    k?: { l?: number; m?: number };
    /** Rotación en grados. La imagen de fondo la lleva dentro, no en el root. */
    n?: number;
  } | null;
  n?: number;
  o?: string;
  u?: number;
  v?: string;
  /**
   * Fuentes que USA esta capa de texto, con su fichero. Claves minificadas:
   * a=name, x=family, y=url, z=style. La capa puede traer varias; cuál se
   * aplica a cada párrafo lo dice el `font-family` en línea del HTML de `v`.
   */
  w?: Array<{ a?: string; x?: string; y?: string; z?: string }>;
  /**
   * Media de una `VideoLayer`. NO va en `p` como la de una imagen:
   *   y  = mp4 reproducible
   *   as / at = miniatura (el póster)
   *   h  = tamaño escalado, k = desplazamiento del recorte, n = rotación
   */
  ar?: {
    y?: string;
    as?: string;
    at?: string;
    h?: { i?: number; j?: number };
    k?: { l?: number; m?: number };
    n?: number;
  } | null;
};

interface LegacyLayer {
  e?: { f?: string };
  g?: LegacyProps;
  s?: string[];
  t?: string | null;
  r?: boolean;
}
interface LegacyPage {
  a?: string;
  c?: Record<string, LegacyLayer>;
}

export type ConversionTier = 'T1' | 'T2' | 'T3';

export interface ConversionNote {
  page: number;
  layer: string;
  /** 'dropped' = no se pudo representar; 'lossy' = se representa distinto. */
  kind: 'dropped' | 'lossy';
  detail: string;
}

export interface ConversionReport {
  pages: number;
  tier: ConversionTier;
  counts: Record<string, number>;
  notes: ConversionNote[];
  /** true si nada se perdió por el camino. */
  clean: boolean;
}

export interface LegacyScene {
  elements: SceneElement[];
  files: Record<string, unknown>;
  /**
   * Tipografías propias que la escena necesita para verse como el original.
   * Se guardan junto a la escena (`editorConfig.fonts`) y el host las pasa a
   * `fontOverrides`, así que un diseño migrado es AUTOSUFICIENTE: no depende de
   * que el brand kit del proyecto siga teniendo esa fuente.
   */
  fonts: CustomFontFace[];
  report: ConversionReport;
}

// La separación viene de layout.ts (módulo sin dependencias) y no de pages.ts:
// si el convertidor usara su propio valor, un diseño migrado quedaría
// desalineado respecto a uno creado en el editor.
const PAPER_COLOR = '#ffffff';
const BG_MARKER = 'pageBackground';
/**
 * Respaldo cuando el párrafo no declara tipografía o la capa no trae su
 * fichero. 2 = "Helvetica", la familia sin trazo a mano de Excalidraw.
 */
const DEFAULT_FONT_FAMILY = 2;

let idCounter = 0;
/** Ids deterministas: la conversión debe ser reproducible para poder diffear. */
function makeId(seed: string): string {
  idCounter += 1;
  let hash = 2166136261;
  const input = `${seed}:${idCounter}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0') + idCounter.toString(36).padStart(3, '0');
}

/** Reinicia el contador para que dos llamadas con la misma entrada coincidan. */
export function resetIdCounter(): void {
  idCounter = 0;
}

function baseElement(extra: Record<string, unknown>): SceneElement {
  return {
    angle: 0,
    strokeColor: '#1e1e1e',
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
  } as unknown as SceneElement;
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

// ─── Texto ───────────────────────────────────────────────────────────────────

interface ParsedParagraph {
  text: string;
  fontSize: number;
  color: string;
  align: string;
  /** Nombre de familia declarado en línea, ya sin comillas. '' si no hay. */
  fontFamily: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Lee una propiedad de un `style="…"` YA DECODIFICADO (ver `parseLegacyText`).
 *
 * El valor llega hasta el `;` y no se excluye la comilla: el editor legacy
 * escribe la familia entrecomillada — `font-family: &quot;Canva Sans&quot;` —
 * y la comilla codificada TERMINA EN `;`, así que leer sobre el HTML crudo
 * devolvía literalmente `&quot`. Como la cadena que entra aquí es solo el
 * contenido del atributo (el `[^"]*` de fuera ya cortó en la comilla de
 * cierre), parar en el `;` es suficiente y no se puede uno salir de la etiqueta.
 */
function styleValue(style: string, prop: string): string | null {
  const m = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i').exec(style);
  return m ? m[1].trim() : null;
}

/**
 * Parte el HTML de una capa de texto en párrafos con su estilo efectivo. El
 * color del `<span>` interior gana al del `<p>`, que es como lo escribe el
 * editor legacy.
 */
export function parseLegacyText(html: string): ParsedParagraph[] {
  const out: ParsedParagraph[] = [];
  const paragraphs = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi);
  const chunks = paragraphs ?? (html.trim() ? [`<p>${html}</p>`] : []);

  for (const p of chunks) {
    // Se decodifican ANTES de leer propiedades: dentro del atributo las
    // comillas viajan como `&quot;`, y ese `;` partía el valor en dos.
    const pStyle = decodeEntities(/<p\b[^>]*style="([^"]*)"/i.exec(p)?.[1] ?? '');
    const spanStyle = decodeEntities(/<span\b[^>]*style="([^"]*)"/i.exec(p)?.[1] ?? '');
    const text = decodeEntities(p.replace(/<[^>]+>/g, '')).trim();
    if (!text) continue;
    const size = styleValue(pStyle, 'font-size');
    // `paragraphSpec.toDOM` la escribe en el <p>; se mira también el <span> por
    // si un documento antiguo la llevaba dentro.
    const familia = styleValue(spanStyle, 'font-family') ?? styleValue(pStyle, 'font-family');
    out.push({
      text,
      fontSize: size ? parseFloat(size) : 20,
      color: styleValue(spanStyle, 'color') ?? styleValue(pStyle, 'color') ?? '#1e1e1e',
      align: styleValue(pStyle, 'text-align') ?? 'left',
      fontFamily: familia ? normalizeFontName(familia) : '',
    });
  }
  return out;
}

/** Párrafos consecutivos con el mismo estilo caben en un solo elemento. */
function groupParagraphs(paras: ParsedParagraph[]): ParsedParagraph[][] {
  const groups: ParsedParagraph[][] = [];
  for (const p of paras) {
    const last = groups[groups.length - 1];
    const head = last?.[0];
    if (
      head &&
      head.fontSize === p.fontSize &&
      head.color === p.color &&
      head.align === p.align &&
      head.fontFamily === p.fontFamily
    ) {
      last.push(p);
    } else {
      groups.push([p]);
    }
  }
  return groups;
}

// ─── Conversión ──────────────────────────────────────────────────────────────

/** Fichero de una tipografía, venga de donde venga. */
export interface FontSource {
  url: string;
  style?: string;
}

export interface LegacyConversionOptions {
  /**
   * Último recurso para una fuente que el diseño nombra pero cuyo fichero no
   * guarda. Pasa MUCHO: el editor legacy solo escribía `url` en la capa cuando
   * la fuente venía de su lista curada, así que hay diseños que dicen
   * "Montserrat" sin decir de dónde bajarla.
   *
   * Se inyecta en vez de resolverse aquí para que el módulo siga siendo puro:
   * el script de migración lo cablea al brand kit del proyecto y a la lista de
   * Google Fonts del paquete legacy; los tests, a un mapa de mentira.
   */
  resolveFontUrl?: (name: string) => FontSource | null;
}

export function legacyToScene(
  editorConfig: unknown,
  options: LegacyConversionOptions = {},
): LegacyScene {
  resetIdCounter();
  const parsed: unknown =
    typeof editorConfig === 'string' ? JSON.parse(editorConfig) : editorConfig;

  // El legacy es un ARRAY de páginas, pero hay dos formas más por ahí: los
  // cargadores del editor antiguo aceptan una página suelta sin envolver
  // (DesignFrame.tsx la mete en un array), y un `editorConfig` de canvas2 es un
  // objeto {elements,…} que NO tiene nada que convertir. Distinguirlas aquí
  // evita que un diseño ya migrado reviente el convertidor con un
  // `raw.forEach is not a function`.
  const raw: LegacyPage[] = Array.isArray(parsed)
    ? (parsed as LegacyPage[])
    : parsed && typeof parsed === 'object' && !Array.isArray((parsed as { elements?: unknown }).elements)
      ? [parsed as LegacyPage]
      : [];

  const elements: SceneElement[] = [];
  const filesOut: Record<string, unknown> = {};
  const notes: ConversionNote[] = [];
  const counts: Record<string, number> = {};
  /** Tipografías propias vistas por el camino; se deduplican al final. */
  const caras: CustomFontFace[] = [];
  let offsetX = 0;
  let sawText = false;
  let sawUnsupported = false;

  raw.forEach((page, pageIndex) => {
    const layers = page.c ?? {};
    const root = layers.d;
    const width = num(root?.g?.h?.i, 1080);
    const height = num(root?.g?.h?.j, 1350);
    const pageId = makeId(`frame-${pageIndex}`);

    elements.push(
      baseElement({
        id: pageId,
        type: 'frame',
        x: offsetX,
        y: 0,
        width,
        height,
        name: page.a || `Página ${pageIndex + 1}`,
        strokeColor: '#bbb',
      }),
    );

    // Fondo: el `paper` que espera background.ts, con el color del RootLayer.
    elements.push(
      baseElement({
        id: makeId(`paper-${pageIndex}`),
        type: 'rectangle',
        x: offsetX,
        y: 0,
        width,
        height,
        backgroundColor: typeof root?.g?.o === 'string' ? root.g.o : PAPER_COLOR,
        fillStyle: 'solid',
        strokeColor: '#d4d4d8',
        strokeWidth: 1,
        roughness: 0,
        roundness: null,
        locked: true,
        frameId: pageId,
        customData: { c2: BG_MARKER },
      }),
    );

    // IMAGEN DE FONDO DE LA PÁGINA (`root.g.p`).
    //
    // En polimake-canvas la foto a sangre NO es una capa: se guarda como imagen
    // del propio RootLayer, con la misma forma que una ImageLayer (y=url,
    // h=tamaño escalado, k=desplazamiento del recorte). En Paella Power, 59 de
    // 64 páginas son así — mirar solo `root.s` dejaba la página en blanco y era
    // la causa de "las fotos se ven blancas".
    //
    // Va justo después del papel y antes de los hijos, que es su orden de
    // pintado: el fondo tapa al papel y las capas tapan al fondo.
    const bg = root?.g?.p;
    const bgUrl = bg?.y ?? bg?.aj;
    if (typeof bgUrl === 'string' && bgUrl) {
      counts.RootBackgroundImage = (counts.RootBackgroundImage ?? 0) + 1;
      if (bgUrl.startsWith('blob:')) {
        notes.push({
          page: pageIndex,
          layer: 'ROOT',
          kind: 'dropped',
          detail: 'fondo de página con URL blob: (bytes irrecuperables)',
        });
      } else {
        const bgFileId = makeId(`bgfile-${pageIndex}`);
        elements.push(
          baseElement({
            id: makeId(`bgimg-${pageIndex}`),
            type: 'image',
            x: offsetX + num(bg?.k?.l),
            y: num(bg?.k?.m),
            width: num(bg?.h?.i, width),
            height: num(bg?.h?.j, height),
            angle: (num(bg?.n) * Math.PI) / 180,
            fileId: bgFileId,
            status: 'saved',
            scale: [1, 1],
            crop: null,
            frameId: pageId,
            // El fondo no se selecciona al hacer clic en la foto: se comporta
            // como fondo, igual que en el editor legacy.
            locked: true,
          }),
        );
        filesOut[bgFileId] = {
          mimeType: bgUrl.endsWith('.webp') ? 'image/webp' : 'image/png',
          id: bgFileId,
          dataURL: bgUrl,
          created: 0,
          lastRetrieved: 0,
        };
      }
    }

    // Los hijos del root, en su orden de pintado.
    const childIds: string[] = Array.isArray(root?.s) ? root!.s! : [];
    childIds.forEach((childId) => {
      const layer = layers[childId];
      const kind = layer?.e?.f ?? 'Unknown';
      counts[kind] = (counts[kind] ?? 0) + 1;
      const g = layer?.g ?? {};
      const x = offsetX + num(g.k?.l);
      const y = num(g.k?.m);
      const w = num(g.h?.i, width);
      const h = num(g.h?.j, height);
      const angle = (num(g.n) * Math.PI) / 180;

      if (kind === 'ImageLayer') {
        const url = g.p?.y ?? g.p?.aj;
        if (typeof url !== 'string' || !url) {
          notes.push({ page: pageIndex, layer: childId, kind: 'dropped', detail: 'ImageLayer sin URL' });
          return;
        }
        if (url.startsWith('blob:')) {
          notes.push({ page: pageIndex, layer: childId, kind: 'dropped', detail: 'URL blob: (bytes irrecuperables)' });
          return;
        }
        // El legacy guarda la imagen escalada dentro de una caja recortante
        // (g.p.h = tamaño escalado, g.p.k = desplazamiento). Excalidraw no tiene
        // recorte por caja, así que el frame hace de recorte y el elemento va
        // colocado en el sitio equivalente.
        const innerW = num(g.p?.h?.i, w);
        const innerH = num(g.p?.h?.j, h);
        const innerX = num(g.p?.k?.l);
        const innerY = num(g.p?.k?.m);
        const fileId = makeId(`file-${pageIndex}-${childId}`);
        elements.push(
          baseElement({
            id: makeId(`img-${pageIndex}-${childId}`),
            type: 'image',
            x: x + innerX,
            y: y + innerY,
            width: innerW,
            height: innerH,
            angle,
            fileId,
            status: 'saved',
            scale: [1, 1],
            crop: null,
            frameId: pageId,
            locked: Boolean(layer?.r),
          }),
        );
        filesOut[fileId] = {
          mimeType: url.endsWith('.webp') ? 'image/webp' : 'image/png',
          id: fileId,
          // Excalidraw hace `image.src = <este campo>`, así que una URL remota
          // funciona. Nada de dataURL: la escena pesa como el editorConfig.
          dataURL: url,
          created: 0,
          lastRetrieved: 0,
        };
        return;
      }

      // VIDEOLAYER → SU PÓSTER.
      //
      // Excalidraw no sabe representar vídeo. Descartarla dejaba un hueco en la
      // página y el diseño parecía roto, cuando el fotograma de portada es una
      // representación fiel de cómo se ve esa pieza en el feed. Se convierte a
      // imagen y se anota como pérdida: la pieza está, la reproducción no.
      if (kind === 'VideoLayer') {
        // El póster vive en `g.ar.as` (miniatura del vídeo), no en `g.p` como
        // el de una imagen. Se comprobó contra un diseño real: mirar en `p`
        // dejaba las cuatro páginas de vídeo en blanco.
        const media = g.ar;
        const poster = media?.as ?? media?.at ?? g.p?.aj ?? g.p?.y;
        if (typeof poster !== 'string' || !poster || poster.startsWith('blob:')) {
          // Sin póster no queda nada de la pieza, así que sigue siendo T3: el
          // diseño convertido NO representa al original y hay que mirarlo.
          sawUnsupported = true;
          notes.push({
            page: pageIndex,
            layer: childId,
            kind: 'dropped',
            detail: 'VideoLayer sin póster recuperable',
          });
          return;
        }
        // Mismo recorte que una ImageLayer: el vídeo también se guarda escalado
        // dentro de una caja recortante (`ar.h` tamaño, `ar.k` desplazamiento).
        const innerW = num(media?.h?.i, w);
        const innerH = num(media?.h?.j, h);
        const innerX = num(media?.k?.l);
        const innerY = num(media?.k?.m);
        const fileId = makeId(`vfile-${pageIndex}-${childId}`);
        elements.push(
          baseElement({
            id: makeId(`vimg-${pageIndex}-${childId}`),
            type: 'image',
            x: x + innerX,
            y: y + innerY,
            width: innerW,
            height: innerH,
            angle,
            fileId,
            status: 'saved',
            scale: [1, 1],
            crop: null,
            frameId: pageId,
            locked: Boolean(layer?.r),
          }),
        );
        filesOut[fileId] = {
          mimeType: poster.endsWith('.webp') ? 'image/webp' : 'image/png',
          id: fileId,
          dataURL: poster,
          created: 0,
          lastRetrieved: 0,
        };
        notes.push({
          page: pageIndex,
          layer: childId,
          kind: 'lossy',
          detail: 'VideoLayer → póster: se conserva el fotograma, no la reproducción',
        });
        return;
      }

      if (kind === 'TextLayer') {
        sawText = true;
        const scale = num(g.u, 1);
        const paras = parseLegacyText(typeof g.v === 'string' ? g.v : '');
        if (paras.length === 0) {
          notes.push({ page: pageIndex, layer: childId, kind: 'dropped', detail: 'TextLayer vacía' });
          return;
        }
        const groups = groupParagraphs(paras);
        if (groups.length > 1) {
          notes.push({
            page: pageIndex,
            layer: childId,
            kind: 'lossy',
            detail: `estilos mixtos: 1 capa → ${groups.length} elementos (Excalidraw es un estilo por elemento)`,
          });
        }
        // Catálogo de ficheros que declara ESTA capa: nombre → url/estilo.
        // Es de donde sale la tipografía real; el brand kit del proyecto no
        // hace falta para nada aquí, y por eso el diseño migrado se ve igual
        // aunque la marca cambie de fuentes después.
        const catalogo = new Map<string, { url: string; style?: string }>();
        for (const f of g.w ?? []) {
          const nombre = normalizeFontName(f?.a ?? f?.x ?? '');
          const url = typeof f?.y === 'string' ? f.y.trim() : '';
          if (!nombre || !/^https?:\/\//i.test(url)) continue;
          catalogo.set(nombre.toLowerCase(), {
            url: normalizeFontSrc(url),
            style: f?.z && f.z !== 'regular' ? f.z : undefined,
          });
        }

        let cursorY = y;
        for (const group of groups) {
          const head = group[0];
          const size = head.fontSize * scale;
          const text = group.map((p) => p.text).join('\n');
          const boxH = group.length * size * 1.25;

          // Tipografía del grupo. Sin fichero no se puede registrar nada, así
          // que se cae a la familia por defecto y se anota: es una pérdida
          // real y silenciarla es lo que hacía que "las fuentes no funcionen".
          let fontFamily = DEFAULT_FONT_FAMILY;
          if (head.fontFamily) {
            const fichero =
              catalogo.get(head.fontFamily.toLowerCase()) ??
              options.resolveFontUrl?.(head.fontFamily) ??
              null;
            if (fichero) {
              fontFamily = customFontFamilyId(head.fontFamily);
              caras.push({
                family: fontFamilyAlias(head.fontFamily),
                src: normalizeFontSrc(fichero.url),
                style: fichero.style,
              });
            } else {
              notes.push({
                page: pageIndex,
                layer: childId,
                kind: 'lossy',
                detail: `sin fichero para la fuente "${head.fontFamily}"; se usa la de respaldo`,
              });
            }
          }

          elements.push(
            baseElement({
              id: makeId(`txt-${pageIndex}-${childId}`),
              type: 'text',
              x,
              y: cursorY,
              width: w * scale,
              height: boxH,
              angle,
              text,
              originalText: text,
              fontSize: size,
              fontFamily,
              textAlign: head.align === 'justify' ? 'left' : head.align,
              verticalAlign: 'top',
              containerId: null,
              lineHeight: 1.25,
              autoResize: false,
              strokeColor: head.color,
              frameId: pageId,
              locked: Boolean(layer?.r),
            }),
          );
          cursorY += boxH;
        }
        return;
      }

      sawUnsupported = true;
      notes.push({
        page: pageIndex,
        layer: childId,
        kind: 'dropped',
        detail: `capa no soportada: ${kind}`,
      });
    });

    offsetX += width + PAGE_GAP;
  });

  const tier: ConversionTier = sawUnsupported ? 'T3' : sawText ? 'T2' : 'T1';
  return {
    elements,
    files: filesOut,
    fonts: dedupeFontFaces(caras),
    report: {
      pages: raw.length,
      tier,
      counts,
      notes,
      clean: notes.length === 0,
    },
  };
}
