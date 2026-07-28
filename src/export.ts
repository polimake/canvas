import { jsPDF } from 'jspdf';
import {
  exportToBlob,
  exportToCanvas,
  exportToSvg,
  type ExcalidrawImperativeAPI,
  type FrameElement,
} from './excal';

/**
 * Image / document export — the canvas2 analogue of polimake-canvas's
 * `useExportCommands` (PNG via html-to-image, PDF via jspdf) and thumbnail
 * capture. Here PNG/SVG come natively from Excalidraw; per-page export uses the
 * frame as `exportingFrame` so output is clipped to that artboard.
 */

export interface ExportOptions {
  /** Export only this page (frame). Omit to export the whole scene. */
  pageId?: string;
  /** Paint the background. Defaults to true. */
  background?: boolean;
  /** Pixel scale multiplier. Defaults to 1 — a 1080×1920 page exports exactly
   *  1080×1920, which is what social publishing wants. Ignored when
   *  `maxWidthOrHeight` is set. */
  scale?: number;
  /** Clamp the largest dimension (used for thumbnails). */
  maxWidthOrHeight?: number;
  /** Render with the dark theme. Defaults to false. */
  darkMode?: boolean;
}

/** Scale hook for Excalidraw's exporters (appState.exportScale is inert). */
function dimensions(opts?: { scale?: number }) {
  const scale = opts?.scale ?? 1;
  return (width: number, height: number) => ({
    width: width * scale,
    height: height * scale,
    scale,
  });
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
    ...(opts?.maxWidthOrHeight
      ? { maxWidthOrHeight: opts.maxWidthOrHeight }
      : { getDimensions: dimensions(opts) }),
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

/** Trigger a browser download for a blob (host-side convenience). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has consumed the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
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
      getDimensions: dimensions(opts),
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
