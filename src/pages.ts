import { convertToExcalidrawElements, CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

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
}

/** Matches polimake-canvas's default ROOT boxSize (pagesSlice). */
export const DEFAULT_PAGE_SIZE: PageSize = { width: 1640, height: 924 };

/** Horizontal gap between consecutive page frames, in scene units. */
const PAGE_GAP = 160;

type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElements']>[number];
type SceneElements = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['elements'];

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
  }));
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
