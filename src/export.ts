import { exportToBlob, exportToCanvas, exportToSvg } from '@excalidraw/excalidraw';
import { jsPDF } from 'jspdf';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

/**
 * Image / document export — the canvas2 analogue of polimake-canvas's
 * `useExportCommands` (PNG via html-to-image, PDF via jspdf) and thumbnail
 * capture. Here PNG/SVG come natively from Excalidraw; per-page export uses the
 * frame as `exportingFrame` so output is clipped to that artboard.
 */

type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElements']>[number];
type FrameElement = Extract<SceneElement, { type: 'frame' }>;

export interface ExportOptions {
  /** Export only this page (frame). Omit to export the whole scene. */
  pageId?: string;
  /** Paint the background. Defaults to true. */
  background?: boolean;
  /** Pixel scale multiplier. Defaults to 2. */
  scale?: number;
  /** Clamp the largest dimension (used for thumbnails). */
  maxWidthOrHeight?: number;
  /** Render with the dark theme. Defaults to false. */
  darkMode?: boolean;
}

function frames(api: ExcalidrawImperativeAPI): FrameElement[] {
  return api
    .getSceneElements()
    .filter((e): e is FrameElement => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
}

function findFrame(api: ExcalidrawImperativeAPI, pageId?: string): FrameElement | null {
  if (!pageId) return null;
  return frames(api).find((f) => f.id === pageId) ?? null;
}

function exportAppState(api: ExcalidrawImperativeAPI, opts?: ExportOptions) {
  return {
    exportBackground: opts?.background ?? true,
    exportScale: opts?.scale ?? 2,
    exportWithDarkMode: opts?.darkMode ?? false,
    viewBackgroundColor: api.getAppState().viewBackgroundColor,
  };
}

/** Export the scene (or one page) to a PNG blob. */
export function exportScenePng(
  api: ExcalidrawImperativeAPI,
  opts?: ExportOptions,
): Promise<Blob> {
  return exportToBlob({
    elements: api.getSceneElements(),
    appState: exportAppState(api, opts),
    files: api.getFiles(),
    exportingFrame: findFrame(api, opts?.pageId),
    maxWidthOrHeight: opts?.maxWidthOrHeight,
    mimeType: 'image/png',
  });
}

/** Export the scene (or one page) to an SVG element. */
export function exportSceneSvg(
  api: ExcalidrawImperativeAPI,
  opts?: ExportOptions,
): Promise<SVGSVGElement> {
  return exportToSvg({
    elements: api.getSceneElements(),
    appState: exportAppState(api, opts),
    files: api.getFiles(),
    exportingFrame: findFrame(api, opts?.pageId),
  });
}

/**
 * Capture a small PNG thumbnail (defaults to the first page, ≤512px) — for
 * content cards / template grids, mirroring polimake's `ThumbnailFn`.
 */
export function captureThumbnail(
  api: ExcalidrawImperativeAPI,
  opts?: { pageId?: string; maxSize?: number },
): Promise<Blob> {
  const pageId = opts?.pageId ?? frames(api)[0]?.id;
  return exportScenePng(api, {
    pageId,
    scale: 1,
    maxWidthOrHeight: opts?.maxSize ?? 512,
    background: true,
  });
}

/**
 * Export every page to a multi-page PDF (one artboard per PDF page). Falls back
 * to a single page when there are no frames. Mirrors polimake's PDF export.
 */
export async function exportScenePdf(
  api: ExcalidrawImperativeAPI,
  opts?: { background?: boolean; scale?: number },
): Promise<Blob> {
  const elements = api.getSceneElements();
  const files = api.getFiles();
  const appState = exportAppState(api, opts);
  const targets: (FrameElement | null)[] = frames(api).length ? frames(api) : [null];

  let doc: jsPDF | null = null;
  for (const frame of targets) {
    const canvas = await exportToCanvas({
      elements,
      appState,
      files,
      exportingFrame: frame,
    });
    const w = canvas.width;
    const h = canvas.height;
    const orientation = w >= h ? 'landscape' : 'portrait';
    if (!doc) {
      doc = new jsPDF({ orientation, unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
    } else {
      doc.addPage([w, h], orientation);
    }
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
  }

  return (doc ?? new jsPDF()).output('blob');
}
