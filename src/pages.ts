import {
  convertToExcalidrawElements,
  type ExcalidrawImperativeAPI,
  type SceneElement,
  type SceneElements,
} from './excal';
import { asSceneElements, commitElements, patchElement, type CaptureMode } from './mutate';
import { buildPageBackground, isPageBackground } from './background';
import { cloneSceneElements } from './components';
import { PAGE_GAP } from './layout';

/**
 * "Pages" / artboards on top of Excalidraw's infinite canvas.
 *
 * A design is a fixed-size, multi-page document; Excalidraw is an infinite
 * plane. We emulate pages with native Excalidraw **frames** laid out left to
 * right: each frame is a fixed-size artboard, content placed inside it belongs
 * to that page, and a frame clips + exports to its own bounds. This is a *soft*
 * boundary — the canvas stays pannable.
 *
 * Every compound operation here commits EXACTLY ONE scene update (one undo
 * entry) via mutate.ts — building the final array with pure helpers
 * (packPagesInArray / renumberPagesInArray) instead of chaining updates.
 */

export interface PageSize {
  width: number;
  height: number;
}

export interface PageInfo {
  id: string;
  name: string;
  index: number;
  width: number;
  height: number;
  locked: boolean;
  /** Posición del marco en coordenadas de ESCENA (no de pantalla). La usa la
   *  barra de acciones flotante para anclarse junto al nombre de la página. */
  x: number;
  y: number;
}

/** Social-first default (IG feed 4:5) — new documents are made to publish. */
export const DEFAULT_PAGE_SIZE: PageSize = { width: 1080, height: 1350 };

/** Named artboard sizes offered by the size menu (social-first, like Canva). */
export interface PageSizePreset extends PageSize {
  key: string;
  label: string;
}

export const PAGE_SIZE_PRESETS: PageSizePreset[] = [
  { key: 'ig-post', label: 'Post 4:5', width: 1080, height: 1350 },
  { key: 'square', label: 'Cuadrado 1:1', width: 1080, height: 1080 },
  { key: 'story', label: 'Story / Reel 9:16', width: 1080, height: 1920 },
  { key: 'landscape', label: 'Horizontal 16:9', width: 1920, height: 1080 },
  { key: 'yt-thumb', label: 'Miniatura YouTube', width: 1280, height: 720 },
  { key: 'a4', label: 'A4', width: 794, height: 1123 },
  { key: 'default', label: 'Lienzo clásico', width: 1640, height: 924 },
];



/** Default paper color for a new page. */
const PAPER_COLOR = '#ffffff';

const DEFAULT_NAME_RE = /^Página \d+$/;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pg_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

type FrameElement = Extract<SceneElement, { type: 'frame' }>;

function framesInArray(elements: readonly SceneElement[]): FrameElement[] {
  return elements
    .filter((e): e is FrameElement => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
}

function getFrames(api: ExcalidrawImperativeAPI): FrameElement[] {
  return framesInArray(api.getSceneElements());
}

/**
 * PURE: re-pack pages flush left → right, preserving `order` (default:
 * current x order) and anchoring the strip at the current leftmost x.
 * Members travel with their frame. Returns the SAME array reference when
 * nothing moves.
 */
export function packPagesInArray(
  elements: readonly SceneElement[],
  orderedFrameIds?: string[],
): readonly SceneElement[] {
  const byX = framesInArray(elements);
  if (byX.length < 2) return elements;
  const order = orderedFrameIds
    ? orderedFrameIds
        .map((id) => byX.find((f) => f.id === id))
        .filter((f): f is FrameElement => Boolean(f))
    : byX;
  if (order.length === 0) return elements;

  const shiftByFrame = new Map<string, number>();
  let cursor = Math.min(...order.map((f) => f.x));
  for (const frame of order) {
    const dx = cursor - frame.x;
    if (Math.abs(dx) > 0.01) shiftByFrame.set(frame.id, dx);
    cursor += frame.width + PAGE_GAP;
  }
  if (shiftByFrame.size === 0) return elements;

  return elements.map((e) => {
    const dx =
      e.type === 'frame'
        ? shiftByFrame.get(e.id)
        : e.frameId
          ? shiftByFrame.get(e.frameId)
          : undefined;
    return dx ? patchElement(e, { x: e.x + dx }) : e;
  });
}

/**
 * PURE: give default-named pages ("Página N") their positional number, in
 * `orderedFrameIds` order. Custom names (incl. "(copia)") are left alone.
 *
 * Returns the SAME array reference when no page needs renaming — igual que
 * `packPagesInArray`. Sin eso, `.map` devolvía siempre un array nuevo y quien
 * encadena las dos primitivas no podía distinguir "no ha cambiado nada" de "ha
 * cambiado algo", y acababa escribiendo en la escena una entrada de deshacer
 * vacía.
 */
export function renumberPagesInArray(
  elements: readonly SceneElement[],
  orderedFrameIds: string[],
): readonly SceneElement[] {
  const nameById = new Map(orderedFrameIds.map((id, i) => [id, `Página ${i + 1}`]));
  let changed = false;
  const next = elements.map((e) => {
    if (e.type !== 'frame') return e;
    const target = nameById.get(e.id);
    const current = (e as FrameElement).name ?? '';
    if (!target || target === current || !DEFAULT_NAME_RE.test(current)) return e;
    changed = true;
    return patchElement(e, { name: target } as Partial<SceneElement>);
  });
  return changed ? next : elements;
}

/**
 * Build a blank scene containing a single page frame. Feed the result to
 * `Canvas2Editor`'s `initialScene`.
 */
export function createBlankScene(
  pageSize: PageSize = DEFAULT_PAGE_SIZE,
): { elements: SceneElements } {
  const id = createId();
  const skeleton: Parameters<typeof convertToExcalidrawElements>[0] = [
    {
      type: 'frame',
      id,
      name: 'Página 1',
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height,
      children: [],
    },
  ];
  const frame = convertToExcalidrawElements(skeleton, { regenerateIds: false });
  const paper = buildPageBackground(
    id,
    { x: 0, y: 0, width: pageSize.width, height: pageSize.height },
    PAPER_COLOR,
  );
  return {
    elements: asSceneElements([...(frame as readonly SceneElement[]), ...paper]),
  };
}

/** Snapshot of the current pages, ordered left → right. */
export function listPages(api: ExcalidrawImperativeAPI): PageInfo[] {
  return getFrames(api).map((f, index) => ({
    id: f.id,
    name: f.name ?? `Página ${index + 1}`,
    index,
    width: Math.round(f.width),
    height: Math.round(f.height),
    locked: Boolean(f.locked),
    x: f.x,
    y: f.y,
  }));
}

/** Current size of one page (frame), or null if it doesn't exist. */
export function getPageSize(api: ExcalidrawImperativeAPI, pageId: string): PageSize | null {
  const frame = getFrames(api).find((f) => f.id === pageId);
  return frame ? { width: Math.round(frame.width), height: Math.round(frame.height) } : null;
}

/**
 * Add a blank page. With `afterPageId` the page is inserted right after that
 * page (pages to the right shift over); otherwise it is appended at the end.
 * One undo entry; returns the new frame id.
 */
export function addPage(
  api: ExcalidrawImperativeAPI,
  pageSize: PageSize = DEFAULT_PAGE_SIZE,
  opts: { afterPageId?: string; capture?: CaptureMode } = {},
): string {
  const elements = api.getSceneElements();
  const frames = framesInArray(elements);
  const source = opts.afterPageId
    ? frames.find((f) => f.id === opts.afterPageId)
    : undefined;

  const id = createId();
  const x = source
    ? source.x + source.width
    : frames.length
      ? Math.max(...frames.map((f) => f.x + f.width)) + PAGE_GAP
      : 0;
  const y = source ? source.y : 0;

  const order = frames.map((f) => f.id);
  const insertAt = source ? order.indexOf(source.id) + 1 : order.length;
  order.splice(insertAt, 0, id);

  const skeleton: Parameters<typeof convertToExcalidrawElements>[0] = [
    {
      type: 'frame',
      id,
      name: `Página ${insertAt + 1}`,
      x,
      y,
      width: pageSize.width,
      height: pageSize.height,
      children: [],
    },
  ];
  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false });
  const paper = buildPageBackground(id, { x, y, width: pageSize.width, height: pageSize.height }, PAPER_COLOR);

  let combined: readonly SceneElement[] = [
    ...elements,
    ...(created as readonly SceneElement[]),
    ...paper,
  ];
  combined = packPagesInArray(combined, order);
  combined = renumberPagesInArray(combined, order);
  commitElements(api, combined, opts.capture ?? 'undoable');
  return id;
}

/** Center + zoom the viewport onto a page. */
/**
 * Cuánto de la pantalla ocupa la página al saltar a ella (0,1–1).
 *
 * `fitToContent` la pegaba a los bordes del viewport: se veía la página y nada
 * más, sin margen para arrastrar algo desde fuera ni para entender dónde estás
 * dentro del documento. Con 0,72 queda aire alrededor.
 */
const PAGE_VIEWPORT_COVERAGE = 0.72;

export function goToPage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  opts?: { coverage?: number },
): void {
  const frame = api.getSceneElements().find((e) => e.id === pageId);
  if (!frame) return;
  api.scrollToContent(frame, {
    fitToViewport: true,
    viewportZoomFactor: Math.min(1, Math.max(0.1, opts?.coverage ?? PAGE_VIEWPORT_COVERAGE)),
    animate: true,
    duration: 300,
  });
}

/** Rename a page (its frame). */
export function renamePage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  name: string,
): void {
  const next = api
    .getSceneElements()
    .map((e) =>
      e.id === pageId && e.type === 'frame'
        ? patchElement(e, { name } as Partial<SceneElement>)
        : e,
    );
  commitElements(api, next);
}

/**
 * Delete a page and everything inside it, re-packing and renumbering the
 * survivors in the same (single) undo entry. Refuses to delete the last page.
 */
/**
 * Encuadra TODAS las páginas a la vez.
 *
 * El editor legacy apilaba las páginas en vertical y verlas todas era el estado
 * por defecto; aquí van en fila y `goToPage` encuadra solo una, así que sin esto
 * la única forma de ver el conjunto era alejar el zoom a mano. `scrollToContent`
 * sin elemento concreto ajusta a la escena entera.
 */
export function fitAllPages(api: ExcalidrawImperativeAPI, opts?: { coverage?: number }): void {
  const marcos = framesInArray(api.getSceneElements());
  if (!marcos.length) return;
  api.scrollToContent(marcos, {
    fitToViewport: true,
    viewportZoomFactor: Math.min(1, Math.max(0.1, opts?.coverage ?? 0.9)),
    animate: true,
    duration: 300,
  });
}

/**
 * Borra una página y todo lo que contiene.
 *
 * Devuelve `false` sin tocar nada cuando es la última: un diseño sin ninguna
 * página no es representable (ni se exporta, ni tiene miniatura, ni sabe a qué
 * tamaño volver). Quien llama DEBE decir por qué no ha pasado nada — que el
 * botón se quedara mudo era la razón de que pareciera roto.
 */
export function deletePage(api: ExcalidrawImperativeAPI, pageId: string): boolean {
  const elements = api.getSceneElements();
  if (framesInArray(elements).length <= 1) return false;
  let remaining: readonly SceneElement[] = elements.filter(
    (e) => e.id !== pageId && e.frameId !== pageId,
  );
  const order = framesInArray(remaining).map((f) => f.id);
  remaining = packPagesInArray(remaining, order);
  remaining = renumberPagesInArray(remaining, order);
  commitElements(api, remaining);
  return true;
}

/**
 * Re-pack the live scene flush left → right (see packPagesInArray). `capture`
 * defaults to undoable; load-time migrations pass 'never'.
 */
export function relayoutPages(
  api: ExcalidrawImperativeAPI,
  capture: CaptureMode = 'undoable',
): void {
  const elements = api.getSceneElements();
  const packed = packPagesInArray(elements);
  if (packed === elements) return;
  commitElements(api, packed, capture);
}

/** Whether a page (its frame) is locked. */
export function isPageLocked(api: ExcalidrawImperativeAPI, pageId: string): boolean {
  const frame = getFrames(api).find((f) => f.id === pageId);
  return Boolean(frame?.locked);
}

/**
 * Lock or unlock a page — the canvas2 analogue of the clone's lockPage: the
 * frame AND every member element get the flag, so nothing on the page can be
 * moved/edited until unlocked.
 */
export function setPageLocked(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  locked: boolean,
): void {
  const next = api
    .getSceneElements()
    .map((e) =>
      e.id === pageId || e.frameId === pageId ? patchElement(e, { locked }) : e,
    );
  commitElements(api, next);
}

/**
 * Move a page one slot left (-1) or right (+1) in the strip — one undo entry.
 */
/**
 * Lleva una página a una posición concreta (arrastrar y soltar en la tira).
 *
 * `movePage` solo intercambia con la vecina, que sirve para los botones ◀ ▶
 * pero no para soltar una página cinco puestos más allá. Se apoya en las mismas
 * dos primitivas —reempaquetar y renumerar— así que el resultado es idéntico al
 * de mover de una en una, sin duplicar la lógica de layout.
 */
export function movePageTo(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  targetIndex: number,
): void {
  const elements = api.getSceneElements();
  const frames = framesInArray(elements);
  const from = frames.findIndex((f) => f.id === pageId);
  if (from < 0) return;

  const to = Math.max(0, Math.min(frames.length - 1, Math.trunc(targetIndex)));
  if (to === from) return;

  const order = frames.map((f) => f.id);
  order.splice(to, 0, ...order.splice(from, 1));

  let next = packPagesInArray(elements, order);
  next = renumberPagesInArray(next, order);
  commitElements(api, next);
}

export function movePage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  direction: -1 | 1,
): void {
  const elements = api.getSceneElements();
  const frames = framesInArray(elements);
  const idx = frames.findIndex((f) => f.id === pageId);
  if (idx < 0 || !frames[idx + direction]) return;

  const order = frames.map((f) => f.id);
  [order[idx], order[idx + direction]] = [order[idx + direction], order[idx]];

  let next = packPagesInArray(elements, order);
  next = renumberPagesInArray(next, order);
  commitElements(api, next);
}

/**
 * Change a page's size — the canvas2 analogue of the Canva clone's resize.
 *
 * With `scaleContent` (default), members keep their RELATIVE layout: each
 * element's center is remapped proportionally into the new bounds and its size
 * (and font size) scales uniformly by min(sx, sy) — proportional reflow without
 * distorting images or text. With `scaleContent: false` content stays anchored
 * to the page's top-left corner (overflow just clips at the frame edge).
 * Pages to the right are re-packed in the SAME single undo entry.
 */
export function resizePage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  size: PageSize,
  opts: { scaleContent?: boolean } = {},
): void {
  const scaleContent = opts.scaleContent ?? true;
  const elements = api.getSceneElements();
  const frame = elements.find(
    (e): e is FrameElement => e.id === pageId && e.type === 'frame',
  );
  if (!frame || size.width <= 0 || size.height <= 0) return;

  const sx = size.width / frame.width;
  const sy = size.height / frame.height;
  const k = Math.min(sx, sy);

  const resized = elements.map((e) => {
    if (e.id === pageId && e.type === 'frame') {
      return patchElement(e, { width: size.width, height: size.height });
    }
    if (e.frameId !== pageId) return e;
    // The paper sheet always stretches to the exact new bounds (a uniform
    // scale would leave uncovered strips when the aspect ratio changes).
    if (isPageBackground(e)) {
      return patchElement(e, {
        x: frame.x,
        y: frame.y,
        width: size.width,
        height: size.height,
      });
    }
    if (!scaleContent) return e;

    const cx = frame.x + (e.x + e.width / 2 - frame.x) * sx;
    const cy = frame.y + (e.y + e.height / 2 - frame.y) * sy;
    const width = Math.max(1, e.width * k);
    const height = Math.max(1, e.height * k);
    const updates: Record<string, unknown> = {
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
    };
    if (e.type === 'text') {
      const text = e as SceneElement & { fontSize?: number };
      if (typeof text.fontSize === 'number') {
        updates.fontSize = Math.max(4, text.fontSize * k);
      }
    }
    return patchElement(e, updates as Partial<SceneElement>);
  });

  commitElements(api, packPagesInArray(resized));
}

/**
 * Duplicate a page and its contents, inserting the copy right AFTER the
 * source (pages to the right shift over) — one undo entry.
 *
 * Clones the frame + its member elements with fresh ids, remapping intra-page
 * references (frameId, container/binding ids, groupIds). Cross-page bindings
 * are an accepted v1 limitation.
 */
export function duplicatePage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
): string | null {
  const elements = api.getSceneElements();
  const source = elements.find(
    (e): e is FrameElement => e.id === pageId && e.type === 'frame',
  );
  if (!source) return null;

  const members = elements.filter((e) => e.frameId === pageId);
  // La mecánica de clonado (ids frescos, remapeo de referencias internas) es
  // compartida con la instanciación de componentes — vive en components.ts.
  const { clones, idMap } = cloneSceneElements([source, ...members], {
    dx: source.width + PAGE_GAP,
  });

  const cloneId = idMap.get(pageId)!;
  for (const clone of clones) {
    if (clone.id === cloneId) {
      (clone as Record<string, unknown>).name = `${source.name ?? 'Página'} (copia)`;
    }
  }
  const order = framesInArray(elements).map((f) => f.id);
  order.splice(order.indexOf(pageId) + 1, 0, cloneId);

  let combined: readonly SceneElement[] = [...elements, ...clones];
  combined = packPagesInArray(combined, order);
  combined = renumberPagesInArray(combined, order);
  commitElements(api, combined);
  return cloneId;
}
