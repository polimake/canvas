import {
  convertToExcalidrawElements,
  type ExcalidrawImperativeAPI,
  type FrameElement,
  type SceneElement,
} from './excal';
import { commitElements, patchElement, type CaptureMode } from './mutate';
import { reorderMembersInArray } from './zorder';

/**
 * Per-page background color — Canva-clone parity. Excalidraw frames have no
 * fill of their own, so the background is a locked, full-bleed rectangle sent
 * to the back of the page. It is tagged through the PUBLIC `customData` field
 * (round-tripped verbatim by Excalidraw), so re-applying a color PATCHES the
 * existing background in place (stable element id) instead of rebuilding it.
 */

const BG_MARKER = 'pageBackground';

/** Whether an element is a page's background "paper" sheet. */
export function isPageBackground(el: SceneElement): boolean {
  return (el.customData as { c2?: string } | undefined)?.c2 === BG_MARKER;
}

/**
 * Build the background "paper" element for a page: a locked, full-bleed,
 * SHARP-CORNERED rectangle (roughness 0, no roundness) with a hairline border.
 * Pages read as straight-edged sheets — Excalidraw's own frame outline (which
 * is drawn with rounded corners and no public radius knob) is disabled by the
 * editor (`frameRendering.outline: false`), so this rect IS the page's visual.
 */
export function buildPageBackground(
  pageId: string,
  bounds: { x: number; y: number; width: number; height: number },
  color: string,
): SceneElement[] {
  const skeleton = [
    {
      type: 'rectangle',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      backgroundColor: color,
      fillStyle: 'solid',
      strokeColor: '#d4d4d8',
      strokeWidth: 1,
      roughness: 0,
      roundness: null,
    },
  ] as Parameters<typeof convertToExcalidrawElements>[0];

  return convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) => ({
    ...el,
    frameId: pageId,
    locked: true,
    customData: { c2: BG_MARKER },
  })) as SceneElement[];
}

/**
 * One-time migration for scenes created before pages had paper sheets: every
 * frame without a background rect gets a white one, in a SINGLE commit that is
 * invisible to undo by default (capture 'never') — otherwise the first Ctrl+Z
 * after opening a legacy scene would delete a page's paper.
 */
export function ensurePagePapers(
  api: ExcalidrawImperativeAPI,
  capture: CaptureMode = 'never',
): void {
  const elements = api.getSceneElements();
  const frames = elements.filter((e): e is FrameElement => e.type === 'frame');
  const withPaper = new Set(
    elements.filter((e) => e.frameId && isPageBackground(e)).map((e) => e.frameId as string),
  );
  const missing = frames.filter((f) => !withPaper.has(f.id));
  if (missing.length === 0) return;

  let combined: readonly SceneElement[] = [...elements];
  const inserted: Array<{ pageId: string; paperId: string }> = [];
  for (const frame of missing) {
    const paper = buildPageBackground(frame.id, frame, '#ffffff');
    combined = [...combined, ...paper];
    if (paper[0]) inserted.push({ pageId: frame.id, paperId: paper[0].id });
  }
  for (const { pageId, paperId } of inserted) {
    combined = reorderMembersInArray(combined, pageId, [paperId]);
  }
  commitElements(api, combined, capture);
}

/** Current background color of a page, or null if it has none. */
export function getPageBackground(
  api: ExcalidrawImperativeAPI,
  pageId: string,
): string | null {
  const bg = api
    .getSceneElements()
    .find((e) => e.frameId === pageId && isPageBackground(e));
  return bg ? ((bg as { backgroundColor?: string }).backgroundColor ?? null) : null;
}

/**
 * Set (or replace) a page's background color. Pass `null` to remove it.
 * Re-coloring PATCHES the existing paper in place — same element id, one
 * history-visible change. `capture: 'transient'` is for live previews (the
 * color-input drag); the final pick commits 'undoable'.
 * Returns the background element id, or null when removing.
 */
export function setPageBackgroundColor(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  color: string | null,
  opts: { capture?: CaptureMode } = {},
): string | null {
  const capture = opts.capture ?? 'undoable';
  const elements = api.getSceneElements();
  const frame = elements.find(
    (e): e is FrameElement => e.id === pageId && e.type === 'frame',
  );
  if (!frame) return null;

  const existing = elements.find((e) => e.frameId === pageId && isPageBackground(e));

  if (!color) {
    if (!existing) return null;
    commitElements(api, elements.filter((e) => e !== existing), capture);
    return null;
  }

  if (existing) {
    if ((existing as { backgroundColor?: string }).backgroundColor === color) {
      return existing.id;
    }
    const next = elements.map((e) =>
      e === existing
        ? patchElement(e, { backgroundColor: color } as Partial<SceneElement>)
        : e,
    );
    commitElements(api, next, capture);
    return existing.id;
  }

  const created = buildPageBackground(pageId, frame, color);
  const id = created[0]?.id ?? null;
  const appended: readonly SceneElement[] = [...elements, ...created];
  const reordered = id
    ? reorderMembersInArray(appended, pageId, [id])
    : appended;
  commitElements(api, reordered, capture);
  return id;
}
