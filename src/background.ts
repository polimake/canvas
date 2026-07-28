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

function isPageBackground(el: SceneElement): boolean {
  return (el.customData as { c2?: string } | undefined)?.c2 === BG_MARKER;
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

  const skeleton = [
    {
      type: 'rectangle',
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      backgroundColor: color,
      fillStyle: 'solid',
      strokeColor: 'transparent',
    },
  ] as Parameters<typeof convertToExcalidrawElements>[0];

  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) => ({
    ...el,
    frameId: pageId,
    locked: true,
    customData: { c2: BG_MARKER },
  }));
  const id = created[0]?.id ?? null;

  const appended = [...withoutOld, ...created] as readonly SceneElement[];
  const reordered = id ? reorderMembersInArray(appended, pageId, [id]) : (appended as SceneElements);
  api.updateScene({
    elements: reordered as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return id;
}
