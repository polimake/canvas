import type { SceneElement } from './excal';
import { PAGE_GAP } from './layout';

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
  } | null;
  n?: number;
  o?: string;
  u?: number;
  v?: string;
  w?: Array<{ a?: string; x?: string }>;
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
  report: ConversionReport;
}

// La separación viene de layout.ts (módulo sin dependencias) y no de pages.ts:
// si el convertidor usara su propio valor, un diseño migrado quedaría
// desalineado respecto a uno creado en el editor.
const PAPER_COLOR = '#ffffff';
const BG_MARKER = 'pageBackground';
/** 2 = "Normal" de Excalidraw. Es la que usa text.ts; no hay serif display. */
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

function styleValue(style: string, prop: string): string | null {
  const m = new RegExp(`${prop}\\s*:\\s*([^;"]+)`, 'i').exec(style);
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
    const pStyle = /<p\b[^>]*style="([^"]*)"/i.exec(p)?.[1] ?? '';
    const spanStyle = /<span\b[^>]*style="([^"]*)"/i.exec(p)?.[1] ?? '';
    const text = decodeEntities(p.replace(/<[^>]+>/g, '')).trim();
    if (!text) continue;
    const size = styleValue(pStyle, 'font-size');
    out.push({
      text,
      fontSize: size ? parseFloat(size) : 20,
      color: styleValue(spanStyle, 'color') ?? styleValue(pStyle, 'color') ?? '#1e1e1e',
      align: styleValue(pStyle, 'text-align') ?? 'left',
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
    if (head && head.fontSize === p.fontSize && head.color === p.color && head.align === p.align) {
      last.push(p);
    } else {
      groups.push([p]);
    }
  }
  return groups;
}

// ─── Conversión ──────────────────────────────────────────────────────────────

export function legacyToScene(editorConfig: unknown): LegacyScene {
  resetIdCounter();
  const raw: LegacyPage[] = Array.isArray(editorConfig)
    ? (editorConfig as LegacyPage[])
    : typeof editorConfig === 'string'
      ? (JSON.parse(editorConfig) as LegacyPage[])
      : [];

  const elements: SceneElement[] = [];
  const filesOut: Record<string, unknown> = {};
  const notes: ConversionNote[] = [];
  const counts: Record<string, number> = {};
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
        const fontName = g.w?.[0]?.x ?? g.w?.[0]?.a;
        if (fontName) {
          notes.push({
            page: pageIndex,
            layer: childId,
            kind: 'lossy',
            detail: `fuente "${fontName}" → familia 2 (Excalidraw no admite fuentes propias sin parche)`,
          });
        }
        let cursorY = y;
        for (const group of groups) {
          const head = group[0];
          const size = head.fontSize * scale;
          const text = group.map((p) => p.text).join('\n');
          const boxH = group.length * size * 1.25;
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
              fontFamily: DEFAULT_FONT_FAMILY,
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
    report: {
      pages: raw.length,
      tier,
      counts,
      notes,
      clean: notes.length === 0,
    },
  };
}
