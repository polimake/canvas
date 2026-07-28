import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
  type ExcalidrawImperativeAPI,
  type FrameElement,
  type SceneElement,
  type SceneElements,
} from './excal';
import { reorderMembersInArray } from './zorder';

/**
 * Per-page background color — Canva-clone parity. Excalidraw frames have no
 * fill of their own, so the background is a locked, full-bleed rectangle sent
 * to the back of the page. It is tagged through the PUBLIC `customData` field
 * (round-tripped verbatim by Excalidraw), so re-applying a color replaces the
 * existing background instead of stacking rectangles.
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
 * frame without a background rect gets a white one (otherwise, with the native
 * frame outline disabled, a legacy page would be invisible).
 */
export function ensurePagePapers(api: ExcalidrawImperativeAPI): void {
  const elements = api.getSceneElements();
  const frames = elements.filter((e): e is FrameElement => e.type === 'frame');
  const withPaper = new Set(
    elements.filter((e) => e.frameId && isPageBackground(e)).map((e) => e.frameId as string),
  );
  for (const frame of frames) {
    if (!withPaper.has(frame.id)) setPageBackgroundColor(api, frame.id, '#ffffff');
  }
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
 * Returns the background element id, or null when removing.
 */
export function setPageBackgroundColor(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  color: string | null,
): string | null {
  const elements = api.getSceneElements();
  const frame = elements.find(
    (e): e is FrameElement => e.id === pageId && e.type === 'frame',
  );
  if (!frame) return null;

  const withoutOld = elements.filter((e) => !(e.frameId === pageId && isPageBackground(e)));

  if (!color) {
    api.updateScene({
      elements: withoutOld as SceneElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    return null;
  }

  const created = buildPageBackground(pageId, frame, color);
  const id = created[0]?.id ?? null;

  const appended = [...withoutOld, ...created] as readonly SceneElement[];
  const reordered = id ? reorderMembersInArray(appended, pageId, [id]) : (appended as SceneElements);
  api.updateScene({
    elements: reordered as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return id;
}
