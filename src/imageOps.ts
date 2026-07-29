import {
  type ExcalidrawImperativeAPI,
  type FrameElement,
  type SceneElement,
} from './excal';
import { commitElements, patchElement } from './mutate';
import { reorderMembersInArray } from './zorder';

/**
 * Image operations that Excalidraw doesn't do natively. Crop / pan / rotate /
 * opacity ARE native (double-click an image to crop), so only the two
 * polimake-style "fill the page" actions live here.
 */

function frameFor(
  els: readonly SceneElement[],
  el: SceneElement,
  pageId?: string,
): FrameElement | null {
  const frames = els.filter((e): e is FrameElement => e.type === 'frame');
  return (
    (pageId ? frames.find((f) => f.id === pageId) : undefined) ??
    frames.find((f) => f.id === el.frameId) ??
    frames[0] ??
    null
  );
}

/**
 * Resize an image to COVER its page (overflow clipped by the frame), assign it
 * to that page, and send it to the back. `lock` also locks it (set-as-background).
 */
function fitToPage(
  api: ExcalidrawImperativeAPI,
  elementId: string,
  pageId: string | undefined,
  lock: boolean,
): void {
  const els = api.getSceneElements();
  const el = els.find((e) => e.id === elementId);
  if (!el) return;
  const frame = frameFor(els, el, pageId);
  if (!frame) return;

  // Cover-fit: the opposite of insertImageDataURL's contain (max vs min).
  const scale = Math.max(frame.width / el.width, frame.height / el.height);
  const width = el.width * scale;
  const height = el.height * scale;
  const x = frame.x + (frame.width - width) / 2;
  const y = frame.y + (frame.height - height) / 2;

  const updated = els.map((e) =>
    e.id === elementId
      ? patchElement(e, {
          x,
          y,
          width,
          height,
          frameId: frame.id,
          ...(lock ? { locked: true } : {}),
        } as Partial<SceneElement>)
      : e,
  ) as readonly SceneElement[];

  // Apply geometry + send-to-back in a single updateScene (one undo step).
  const reordered = reorderMembersInArray(updated, frame.id, [elementId]);
  commitElements(api, reordered);
}

/** Cover-fit the image to its page and send it behind siblings. */
export function extendToPage(
  api: ExcalidrawImperativeAPI,
  elementId: string,
  pageId?: string,
): void {
  fitToPage(api, elementId, pageId, false);
}

/** Like {@link extendToPage}, but also locks the image as a page background. */
export function setAsBackground(
  api: ExcalidrawImperativeAPI,
  elementId: string,
  pageId?: string,
): void {
  fitToPage(api, elementId, pageId, true);
}
