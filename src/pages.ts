import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
  type ExcalidrawImperativeAPI,
  type SceneElement,
  type SceneElements,
} from './excal';

/**
 * "Pages" / artboards on top of Excalidraw's infinite canvas.
 *
 * polimake-canvas is a fixed-size multi-page editor; Excalidraw is an infinite
 * plane. We emulate pages with native Excalidraw **frames** laid out left to
 * right: each frame is a fixed-size artboard, content placed inside it belongs
 * to that page, and a frame clips + exports to its own bounds. This is a *soft*
 * boundary (the canvas stays pannable) — the realistic mapping discussed in the
 * plan.
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
}

/** Matches polimake-canvas's default ROOT boxSize (pagesSlice). */
export const DEFAULT_PAGE_SIZE: PageSize = { width: 1640, height: 924 };

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

/** Horizontal gap between consecutive page frames, in scene units. */
const PAGE_GAP = 160;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pg_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function getFrames(api: ExcalidrawImperativeAPI) {
  return api
    .getSceneElements()
    .filter((e): e is Extract<SceneElement, { type: 'frame' }> => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
}

function nextPageX(api: ExcalidrawImperativeAPI): number {
  const frames = getFrames(api);
  if (frames.length === 0) return 0;
  return Math.max(...frames.map((f) => f.x + f.width)) + PAGE_GAP;
}

/**
 * Build a blank scene containing a single page frame — the canvas2 analogue of
 * polimake-canvas's `createBlankEditorPages`. Feed the result to
 * `Canvas2Editor`'s `initialScene`.
 */
export function createBlankScene(
  pageSize: PageSize = DEFAULT_PAGE_SIZE,
): { elements: SceneElements } {
  const skeleton: Parameters<typeof convertToExcalidrawElements>[0] = [
    {
      type: 'frame',
      id: createId(),
      name: 'Página 1',
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height,
      children: [],
    },
  ];
  return {
    elements: convertToExcalidrawElements(skeleton, { regenerateIds: false }) as SceneElements,
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
  }));
}

/** Current size of one page (frame), or null if it doesn't exist. */
export function getPageSize(api: ExcalidrawImperativeAPI, pageId: string): PageSize | null {
  const frame = getFrames(api).find((f) => f.id === pageId);
  return frame ? { width: Math.round(frame.width), height: Math.round(frame.height) } : null;
}

/** Append a new blank page; returns its frame id. */
export function addPage(
  api: ExcalidrawImperativeAPI,
  pageSize: PageSize = DEFAULT_PAGE_SIZE,
): string {
  const id = createId();
  const count = getFrames(api).length;
  const skeleton: Parameters<typeof convertToExcalidrawElements>[0] = [
    {
      type: 'frame',
      id,
      name: `Página ${count + 1}`,
      x: nextPageX(api),
      y: 0,
      width: pageSize.width,
      height: pageSize.height,
      children: [],
    },
  ];
  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false });
  api.updateScene({
    elements: [...api.getSceneElements(), ...created] as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return id;
}

/** Center + zoom the viewport onto a page. */
export function goToPage(api: ExcalidrawImperativeAPI, pageId: string): void {
  const frame = api.getSceneElements().find((e) => e.id === pageId);
  if (!frame) return;
  api.scrollToContent(frame, { fitToContent: true, animate: true, duration: 300 });
}

/** Rename a page (its frame). */
export function renamePage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  name: string,
): void {
  const next = api
    .getSceneElements()
    .map((e) => (e.id === pageId && e.type === 'frame' ? { ...e, name } : e));
  api.updateScene({
    elements: next as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

/**
 * Delete a page and everything inside it. Refuses to delete the last remaining
 * page so the editor always has at least one artboard.
 */
export function deletePage(api: ExcalidrawImperativeAPI, pageId: string): void {
  const elements = api.getSceneElements();
  if (getFrames(api).length <= 1) return;
  const remaining = elements.filter((e) => e.id !== pageId && e.frameId !== pageId);
  api.updateScene({
    elements: remaining as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

/**
 * Re-pack pages left → right with the standard gap, preserving order and each
 * page's own y. Members travel with their frame. Run after any operation that
 * changes a frame's width (resize) so pages never overlap.
 */
export function relayoutPages(api: ExcalidrawImperativeAPI): void {
  const elements = api.getSceneElements();
  const frames = getFrames(api);
  if (frames.length < 2) return;

  const shiftByFrame = new Map<string, number>();
  let cursor = frames[0].x;
  for (const frame of frames) {
    const dx = cursor - frame.x;
    if (Math.abs(dx) > 0.01) shiftByFrame.set(frame.id, dx);
    cursor += frame.width + PAGE_GAP;
  }
  if (shiftByFrame.size === 0) return;

  const next = elements.map((e) => {
    const dx =
      e.type === 'frame'
        ? shiftByFrame.get(e.id)
        : e.frameId
          ? shiftByFrame.get(e.frameId)
          : undefined;
    return dx ? { ...e, x: e.x + dx } : e;
  });
  api.updateScene({
    elements: next as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
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
  const next = api.getSceneElements().map((e) =>
    e.id === pageId || e.frameId === pageId ? { ...e, locked } : e,
  );
  api.updateScene({
    elements: next as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

/**
 * Move a page one slot left (-1) or right (+1) in the strip — the canvas2
 * analogue of the Canva clone's movePageUp/Down. Implemented by nudging the
 * frame's sort key past its neighbour and re-packing, so members travel along.
 */
export function movePage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  direction: -1 | 1,
): void {
  const frames = getFrames(api);
  const idx = frames.findIndex((f) => f.id === pageId);
  const neighbour = frames[idx + direction];
  if (idx < 0 || !neighbour) return;

  const moved = frames[idx];
  const targetX = direction === 1 ? neighbour.x + 1 : neighbour.x - 1;
  const dx = targetX - moved.x;
  const next = api.getSceneElements().map((e) => {
    if (e.id === pageId || e.frameId === pageId) return { ...e, x: e.x + dx };
    return e;
  });
  api.updateScene({
    elements: next as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  relayoutPages(api);
}

/**
 * Change a page's size — the canvas2 analogue of the Canva clone's resize.
 *
 * With `scaleContent` (default), members keep their RELATIVE layout: each
 * element's center is remapped proportionally into the new bounds and its size
 * (and font size) scales uniformly by min(sx, sy) — proportional reflow without
 * distorting images or text. With `scaleContent: false` content stays anchored
 * to the page's top-left corner (overflow just clips at the frame edge).
 * Pages to the right are re-packed so nothing overlaps.
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
    (e): e is Extract<SceneElement, { type: 'frame' }> =>
      e.id === pageId && e.type === 'frame',
  );
  if (!frame || size.width <= 0 || size.height <= 0) return;

  const sx = size.width / frame.width;
  const sy = size.height / frame.height;
  const k = Math.min(sx, sy);

  const next = elements.map((e) => {
    if (e.id === pageId && e.type === 'frame') {
      return { ...e, width: size.width, height: size.height };
    }
    if (!scaleContent || e.frameId !== pageId) return e;

    const cx = frame.x + (e.x + e.width / 2 - frame.x) * sx;
    const cy = frame.y + (e.y + e.height / 2 - frame.y) * sy;
    const width = Math.max(1, e.width * k);
    const height = Math.max(1, e.height * k);
    const scaled: Record<string, unknown> = {
      ...e,
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
    };
    if (e.type === 'text') {
      const text = e as SceneElement & { fontSize?: number };
      if (typeof text.fontSize === 'number') {
        scaled.fontSize = Math.max(4, text.fontSize * k);
      }
    }
    return scaled as SceneElement;
  });

  api.updateScene({
    elements: next as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  relayoutPages(api);
}

/**
 * Duplicate a page and its contents to a new artboard on the right.
 *
 * Clones the frame + its member elements with fresh ids, shifting them and
 * remapping intra-page references (frameId, container/binding ids, groupIds).
 * Cross-page bindings are an accepted v1 limitation.
 */
export function duplicatePage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
): string | null {
  const elements = api.getSceneElements();
  const source = elements.find(
    (e): e is Extract<SceneElement, { type: 'frame' }> =>
      e.id === pageId && e.type === 'frame',
  );
  if (!source) return null;

  const members = elements.filter((e) => e.frameId === pageId);
  const group = [source, ...members];
  const dx = nextPageX(api) - source.x;

  const idMap = new Map<string, string>();
  for (const e of group) idMap.set(e.id, createId());
  const groupIdMap = new Map<string, string>();

  const clones = group.map((e) => {
    // Elements are plain serializable objects — deep clone, then rewrite ids.
    const clone: Record<string, unknown> = JSON.parse(JSON.stringify(e));
    clone.id = idMap.get(e.id);
    clone.x = (clone.x as number) + dx;
    clone.versionNonce = Math.floor(Math.random() * 2 ** 31);

    if (typeof clone.frameId === 'string' && idMap.has(clone.frameId)) {
      clone.frameId = idMap.get(clone.frameId);
    }
    if (typeof clone.containerId === 'string' && idMap.has(clone.containerId)) {
      clone.containerId = idMap.get(clone.containerId);
    }
    if (Array.isArray(clone.boundElements)) {
      clone.boundElements = (clone.boundElements as Array<{ id: string }>).map((b) =>
        idMap.has(b.id) ? { ...b, id: idMap.get(b.id)! } : b,
      );
    }
    for (const key of ['startBinding', 'endBinding'] as const) {
      const binding = clone[key] as { elementId?: string } | null | undefined;
      if (binding?.elementId && idMap.has(binding.elementId)) {
        clone[key] = { ...binding, elementId: idMap.get(binding.elementId) };
      }
    }
    if (Array.isArray(clone.groupIds)) {
      clone.groupIds = (clone.groupIds as string[]).map((g) => {
        if (!groupIdMap.has(g)) groupIdMap.set(g, createId());
        return groupIdMap.get(g)!;
      });
    }
    if (clone.type === 'frame') {
      clone.name = `${source.name ?? 'Página'} (copia)`;
    }
    return clone;
  });

  api.updateScene({
    elements: [...elements, ...clones] as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return idMap.get(pageId) ?? null;
}
