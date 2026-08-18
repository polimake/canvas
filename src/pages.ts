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

/**
 * El orden del documento vive en el marco, no en su `x`.
 *
 * Deducirlo de la posición era barato pero frágil: los marcos se pueden
 * arrastrar (Excalidraw dibuja su rótulo y tira de él), así que empujar una
 * página 20 px a la izquierda la colaba delante de su vecina y el siguiente
 * reempaquetado —o la simple recarga, que llama a `relayoutPages`— consolidaba
 * ese cambio de orden que nadie había pedido. Se guarda en `customData`, el
 * mismo canal público que ya usa el papel de fondo (Excalidraw lo devuelve tal
 * cual), y la `x` pasa a ser una CONSECUENCIA del orden en vez de su origen.
 */
const PAGE_MARKER = 'c2page';

interface PageMarker {
  index: number;
}

function pageOrderOf(el: SceneElement): number | null {
  const raw = (el.customData as { [PAGE_MARKER]?: PageMarker } | undefined)?.[PAGE_MARKER]?.index;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/**
 * Los marcos, en orden de documento.
 *
 * Manda la marca guardada, pero SOLO si la llevan todas: con una sola sin
 * marcar no hay forma de intercalarla entre índices (¿va antes o después de la
 * 3?), así que se cae en bloque a ordenar por `x` —el comportamiento histórico—
 * y el siguiente `packPagesInArray` vuelve a marcarlas todas. Eso cubre a la vez
 * las escenas antiguas (ninguna marcada) y el marco que alguien acaba de dibujar
 * a mano (una sin marcar).
 */
function framesInArray(elements: readonly SceneElement[]): FrameElement[] {
  const frames = elements.filter((e): e is FrameElement => e.type === 'frame');
  const marked = frames.length > 0 && frames.every((f) => pageOrderOf(f) !== null);
  return frames
    .slice()
    .sort(
      marked
        ? (a, b) => (pageOrderOf(a) as number) - (pageOrderOf(b) as number)
        : (a, b) => a.x - b.x,
    );
}

/** Lado mínimo de una página, en px de escena. */
const MIN_PAGE_SIDE = 16;

/**
 * Un tamaño de página utilizable.
 *
 * `addPage` aceptaba lo que le dieran, así que un `pageSize` mal calculado por
 * el host producía un marco de 0×0: no se puede seleccionar, no se exporta y no
 * aparece en la tira más que como una raya. Se recorta aquí, una sola vez, en
 * lugar de repetir la comprobación en cada sitio que crea páginas.
 */
function usableSize(size: PageSize | null | undefined): PageSize {
  const side = (v: number | undefined, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.max(MIN_PAGE_SIDE, v) : fallback;
  return {
    width: side(size?.width, DEFAULT_PAGE_SIZE.width),
    height: side(size?.height, DEFAULT_PAGE_SIZE.height),
  };
}

function getFrames(api: ExcalidrawImperativeAPI): FrameElement[] {
  return framesInArray(api.getSceneElements());
}

/**
 * PURE: re-pack pages flush left → right, preserving `order` (default: current
 * document order) and anchoring the strip at the current leftmost x and at the
 * y de la PRIMERA página. Members travel with their frame. De paso graba en cada
 * marco su posición (ver `PAGE_MARKER`), que es lo que hace que el orden
 * sobreviva a un arrastre. Returns the SAME array reference when nothing moves.
 *
 * La `y` se alinea igual que la `x` porque si no la fila se desmigaja sin vuelta
 * atrás: nada la reponía, así que una página arrastrada hacia abajo se quedaba
 * ahí para siempre y `addPage` colocaba además la nueva en `y = 0` aunque la
 * fila entera viviera en otra altura.
 */
export function packPagesInArray(
  elements: readonly SceneElement[],
  orderedFrameIds?: string[],
): readonly SceneElement[] {
  const known = framesInArray(elements);
  if (known.length === 0) return elements;
  const order = orderedFrameIds
    ? orderedFrameIds
        .map((id) => known.find((f) => f.id === id))
        .filter((f): f is FrameElement => Boolean(f))
    : known;
  if (order.length === 0) return elements;

  interface Move {
    dx: number;
    dy: number;
    index: number;
  }
  const moves = new Map<string, Move>();
  const anchorY = order[0].y;
  let cursor = Math.min(...order.map((f) => f.x));
  order.forEach((frame, index) => {
    const dx = cursor - frame.x;
    const dy = anchorY - frame.y;
    cursor += frame.width + PAGE_GAP;
    const stale = pageOrderOf(frame) !== index;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || stale) {
      moves.set(frame.id, { dx, dy, index });
    }
  });
  if (moves.size === 0) return elements;

  return elements.map((e) => {
    const isFrame = e.type === 'frame';
    const move = moves.get(isFrame ? e.id : (e.frameId ?? ''));
    if (!move) return e;
    const updates: Record<string, unknown> = {};
    if (Math.abs(move.dx) > 0.01) updates.x = e.x + move.dx;
    if (Math.abs(move.dy) > 0.01) updates.y = e.y + move.dy;
    if (isFrame && pageOrderOf(e) !== move.index) {
      updates.customData = {
        ...((e.customData as Record<string, unknown> | undefined) ?? {}),
        [PAGE_MARKER]: { index: move.index },
      };
    }
    return Object.keys(updates).length
      ? patchElement(e, updates as Partial<SceneElement>)
      : e;
  });
}

/**
 * PURE: da nombre de página a los marcos que han entrado por su cuenta.
 *
 * La herramienta de marco de Excalidraw sigue accesible (la tecla `F` no se
 * puede desactivar), y todo marco de la escena ES una página para este modelo:
 * salía en la tira, se exportaba y se llevaba su hueco en la fila, pero con el
 * nombre por defecto de Excalidraw, que `renumberPagesInArray` no reconoce y por
 * tanto nunca renumeraba.
 *
 * Solo actúa cuando el documento YA está marcado y aparece un marco sin marcar:
 * si no lo está NINGUNO estamos ante una escena antigua recién abierta, y
 * renombrarla en bloque borraría los nombres que haya puesto el usuario.
 */
export function adoptStrayFramesInArray(
  elements: readonly SceneElement[],
): readonly SceneElement[] {
  const frames = elements.filter((e): e is FrameElement => e.type === 'frame');
  const strays = frames.filter((f) => pageOrderOf(f) === null);
  if (strays.length === 0 || strays.length === frames.length) return elements;

  const strayIds = new Set(strays.map((f) => f.id));
  let n = 0;
  return elements.map((e) =>
    strayIds.has(e.id)
      ? // El número da igual: al llevar el patrón por defecto, `renumberPagesInArray`
        // le pone el de su posición real en el mismo commit.
        patchElement(e, { name: `Página ${++n}` } as Partial<SceneElement>)
      : e,
  );
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
  const size = usableSize(pageSize);
  const id = createId();
  const skeleton: Parameters<typeof convertToExcalidrawElements>[0] = [
    {
      type: 'frame',
      id,
      name: 'Página 1',
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      children: [],
      customData: { [PAGE_MARKER]: { index: 0 } },
    },
  ];
  const frame = convertToExcalidrawElements(skeleton, { regenerateIds: false });
  const paper = buildPageBackground(
    id,
    { x: 0, y: 0, width: size.width, height: size.height },
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
 * page and with `beforePageId` right before it (pages to the right shift over);
 * with neither, it is appended at the end. One undo entry; returns the new
 * frame id.
 *
 * `beforePageId` existe para el insertador de la tira, que ofrece una juntura
 * ANTES de cada página —incluida la primera—. Sin él, insertar en cabeza había
 * que hacerlo en dos pasos (crear al final + mover), o sea dos entradas de
 * deshacer para un solo gesto.
 */
export function addPage(
  api: ExcalidrawImperativeAPI,
  pageSize: PageSize = DEFAULT_PAGE_SIZE,
  opts: { afterPageId?: string; beforePageId?: string; capture?: CaptureMode } = {},
): string {
  const size = usableSize(pageSize);
  const elements = api.getSceneElements();
  const frames = framesInArray(elements);
  const anchorId = opts.afterPageId ?? opts.beforePageId;
  const source = anchorId ? frames.find((f) => f.id === anchorId) : undefined;
  const before = source ? !opts.afterPageId : false;

  const id = createId();
  // La x solo tiene que ser plausible: `packPagesInArray` reempaqueta la fila
  // entera según el orden explícito de abajo.
  const x = source
    ? before
      ? source.x
      : source.x + source.width
    : frames.length
      ? Math.max(...frames.map((f) => f.x + f.width)) + PAGE_GAP
      : 0;
  // La y se hereda de la fila, no es 0: un documento cuyas páginas viven a otra
  // altura recibía la nueva descolgada del resto.
  const y = source ? source.y : (frames[0]?.y ?? 0);

  const order = frames.map((f) => f.id);
  const insertAt = source
    ? order.indexOf(source.id) + (before ? 0 : 1)
    : order.length;
  order.splice(insertAt, 0, id);

  const skeleton: Parameters<typeof convertToExcalidrawElements>[0] = [
    {
      type: 'frame',
      id,
      name: `Página ${insertAt + 1}`,
      x,
      y,
      width: size.width,
      height: size.height,
      children: [],
    },
  ];
  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false });
  const paper = buildPageBackground(id, { x, y, width: size.width, height: size.height }, PAPER_COLOR);

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
 * Deja la escena en su forma canónica: adopta los marcos que hayan entrado por
 * fuera, reempaqueta la fila (x, y y marca de orden) y renumera. Un solo commit,
 * y NINGUNO cuando ya estaba bien —de ahí que las tres primitivas devuelvan la
 * misma referencia si no tocan nada—, que es lo que permite llamarla desde cada
 * cambio de escena sin llenar el historial de entradas vacías.
 *
 * `capture` por defecto es undoable; las migraciones de carga y la normalización
 * continua pasan 'never'.
 */
export function relayoutPages(
  api: ExcalidrawImperativeAPI,
  capture: CaptureMode = 'undoable',
): void {
  const elements = api.getSceneElements();
  let next = adoptStrayFramesInArray(elements);
  next = packPagesInArray(next);
  next = renumberPagesInArray(next, framesInArray(next).map((f) => f.id));
  if (next === elements) return;
  commitElements(api, next, capture);
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
  if (!frame) return;
  // Un 0 o un NaN aquí NO se recorta como en `addPage`: pedir un tamaño
  // imposible es un error de quien llama, y encoger la página a 16 px sería
  // menos recuperable que no hacer nada.
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return;
  if (size.width <= 0 || size.height <= 0) return;

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

  // Sin el marco clonado no hay página que insertar: seguir metía un `undefined`
  // en el orden y el reempaquetado se degradaba en silencio.
  const cloneId = idMap.get(pageId);
  if (!cloneId) return null;
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
