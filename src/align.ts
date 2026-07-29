import { type ExcalidrawImperativeAPI, type FrameElement, type SceneElement } from './excal';
import { commitElements, patchElement } from './mutate';

/**
 * Align elements to their PAGE — the canvas2 analogue of the Canva clone's
 * single-selection alignment (Excalidraw's native align only works between 2+
 * selected elements; aligning to the artboard is our overlay's job).
 */

export type PageAlignment = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

export const PAGE_ALIGNMENTS: Array<{ key: PageAlignment; label: string; glyph: string }> = [
  { key: 'left', label: 'Alinear a la izquierda', glyph: '⇤' },
  { key: 'centerX', label: 'Centrar horizontalmente', glyph: '⇹' },
  { key: 'right', label: 'Alinear a la derecha', glyph: '⇥' },
  { key: 'top', label: 'Alinear arriba', glyph: '⤒' },
  { key: 'centerY', label: 'Centrar verticalmente', glyph: '⇳' },
  { key: 'bottom', label: 'Alinear abajo', glyph: '⤓' },
];

function alignedPosition(
  frame: FrameElement,
  el: { x: number; y: number; width: number; height: number },
  alignment: PageAlignment,
): { x: number; y: number } {
  switch (alignment) {
    case 'left':
      return { x: frame.x, y: el.y };
    case 'centerX':
      return { x: frame.x + (frame.width - el.width) / 2, y: el.y };
    case 'right':
      return { x: frame.x + frame.width - el.width, y: el.y };
    case 'top':
      return { x: el.x, y: frame.y };
    case 'centerY':
      return { x: el.x, y: frame.y + (frame.height - el.height) / 2 };
    case 'bottom':
      return { x: el.x, y: frame.y + frame.height - el.height };
  }
}

/**
 * Align the given elements (default: the current selection) to the page.
 * Only the page's own members move; locked elements are left alone.
 * Returns how many elements moved.
 */
export function alignToPage(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  alignment: PageAlignment,
  elementIds?: string[],
): number {
  const elements = api.getSceneElements();
  const frame = elements.find(
    (e): e is FrameElement => e.id === pageId && e.type === 'frame',
  );
  if (!frame) return 0;

  const selected = api.getAppState().selectedElementIds;
  const targets = new Set(
    elementIds ?? Object.keys(selected).filter((id) => selected[id]),
  );
  if (targets.size === 0) return 0;

  let moved = 0;
  const next = elements.map((e) => {
    if (!targets.has(e.id) || e.frameId !== pageId || e.locked) return e;
    moved += 1;
    return patchElement(e, alignedPosition(frame, e, alignment) as Partial<SceneElement>);
  });
  if (moved === 0) return 0;

  commitElements(api, next);
  return moved;
}
