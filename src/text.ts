import {
  convertToExcalidrawElements,
  type ExcalidrawImperativeAPI,
  type FrameElement,
  type SceneElement,
} from './excal';
import { commitElements } from './mutate';
import { getPageBackground } from './background';

/**
 * Text presets — the canvas2 analogue of the Canva clone's sidebar "Agregar un
 * título / subtítulo / cuerpo". Pure overlay: inserts a normal Excalidraw text
 * element (public skeleton API), so nothing here depends on editor internals.
 *
 * Presets are page-aware: each anchors at its own vertical position (no
 * overlapping stack when inserting Título then Subtítulo), font size scales
 * with the page width (64px on a 1080-wide page), and the text color is chosen
 * by the page background's luminance so presets are never invisible on dark
 * papers.
 */

export type TextPresetKey = 'heading' | 'subheading' | 'body';

export interface TextPreset {
  key: TextPresetKey;
  label: string;
  text: string;
  /** Font size on a 1080px-wide page; scales linearly with page width. */
  fontSize: number;
  /** Vertical anchor as a fraction of the page height. */
  anchorY: number;
}

export const TEXT_PRESETS: TextPreset[] = [
  { key: 'heading', label: 'Título', text: 'Título', fontSize: 64, anchorY: 0.24 },
  { key: 'subheading', label: 'Subtítulo', text: 'Subtítulo', fontSize: 40, anchorY: 0.38 },
  { key: 'body', label: 'Cuerpo de texto', text: 'Escribe algo…', fontSize: 24, anchorY: 0.52 },
];

function frames(api: ExcalidrawImperativeAPI): FrameElement[] {
  return api
    .getSceneElements()
    .filter((e): e is FrameElement => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
}

/** Relative luminance (0..1) of a #rrggbb color; null/invalid → treated light. */
function luminance(hex: string | null): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!match) return 1;
  const n = parseInt(match[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Dark text on light backgrounds, white text on dark ones. */
export function contrastTextColor(background: string | null): string {
  return luminance(background) > 0.5 ? '#1e1e1e' : '#ffffff';
}

/**
 * Insert a preset text element onto a page (defaults to the first page), at
 * the preset's own anchor, sized for the page, colored against the page
 * background, and selected so the user can retype immediately.
 * Returns the new element id, or null without a target page.
 */
export function insertTextPreset(
  api: ExcalidrawImperativeAPI,
  preset: TextPresetKey,
  opts?: { pageId?: string },
): string | null {
  const def = TEXT_PRESETS.find((p) => p.key === preset) ?? TEXT_PRESETS[0];
  const pages = frames(api);
  const target = (opts?.pageId && pages.find((f) => f.id === opts.pageId)) || pages[0] || null;

  const scale = target ? target.width / 1080 : 1;
  const fontSize = Math.max(8, def.fontSize * scale);
  const anchorX = target ? target.x + target.width / 2 : 0;
  const anchorY = target ? target.y + target.height * def.anchorY : 0;
  const strokeColor = contrastTextColor(
    target ? getPageBackground(api, target.id) ?? '#ffffff' : '#ffffff',
  );

  const skeleton = [
    {
      type: 'text',
      text: def.text,
      fontSize,
      // 2 = Excalidraw's built-in "normal" (non hand-drawn) family.
      fontFamily: 2,
      strokeColor,
      x: anchorX,
      y: anchorY,
    },
  ] as Parameters<typeof convertToExcalidrawElements>[0];

  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) => ({
    ...el,
    // Center on the anchor now that the converter measured the text box.
    x: anchorX - el.width / 2,
    y: anchorY - el.height / 2,
    ...(target ? { frameId: target.id } : {}),
  }));
  const id = created[0]?.id;
  if (!id) return null;

  commitElements(
    api,
    [...api.getSceneElements(), ...(created as unknown as readonly SceneElement[])],
    'undoable',
    { selectedElementIds: { [id]: true } },
  );
  return id;
}
