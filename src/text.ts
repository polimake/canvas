import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
  type ExcalidrawImperativeAPI,
  type FrameElement,
  type SceneElements,
} from './excal';

/**
 * Text presets — the canvas2 analogue of the Canva clone's sidebar "Agregar un
 * título / subtítulo / cuerpo". Pure overlay: inserts a normal Excalidraw text
 * element (public skeleton API), so nothing here depends on editor internals.
 */

export type TextPresetKey = 'heading' | 'subheading' | 'body';

export interface TextPreset {
  key: TextPresetKey;
  label: string;
  text: string;
  fontSize: number;
}

export const TEXT_PRESETS: TextPreset[] = [
  { key: 'heading', label: 'Título', text: 'Título', fontSize: 64 },
  { key: 'subheading', label: 'Subtítulo', text: 'Subtítulo', fontSize: 40 },
  { key: 'body', label: 'Cuerpo de texto', text: 'Escribe algo…', fontSize: 24 },
];

function frames(api: ExcalidrawImperativeAPI): FrameElement[] {
  return api
    .getSceneElements()
    .filter((e): e is FrameElement => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
}

/**
 * Insert a preset text element onto a page (defaults to the first page),
 * roughly centered on its upper third, and select it so the user can retype
 * immediately. Returns the new element id, or null without a target page.
 */
export function insertTextPreset(
  api: ExcalidrawImperativeAPI,
  preset: TextPresetKey,
  opts?: { pageId?: string },
): string | null {
  const def = TEXT_PRESETS.find((p) => p.key === preset) ?? TEXT_PRESETS[0];
  const pages = frames(api);
  const target = (opts?.pageId && pages.find((f) => f.id === opts.pageId)) || pages[0] || null;

  // Without pages, drop it at the origin of the infinite canvas.
  const anchorX = target ? target.x + target.width / 2 : 0;
  const anchorY = target ? target.y + target.height / 3 : 0;

  const skeleton = [
    {
      type: 'text',
      text: def.text,
      fontSize: def.fontSize,
      // 2 = Excalidraw's built-in "normal" (non hand-drawn) family.
      fontFamily: 2,
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

  api.updateScene({
    elements: [...api.getSceneElements(), ...created] as SceneElements,
    appState: { selectedElementIds: { [id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return id;
}
