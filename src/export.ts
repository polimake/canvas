import {
  exportToBlob,
  exportToCanvas,
  exportToSvg,
  type ExcalidrawImperativeAPI,
  type FrameElement,
} from './excal';
import {
  appendFontFacesToSvg,
  buildFontFaceCss,
  inlineFontFaces,
  type SvgFontFace,
} from './svgFonts';

/**
 * Image / document export plus thumbnail capture. PNG and SVG come natively
 * from Excalidraw (no html-to-image rasterizing); per-page export passes the
 * frame as `exportingFrame`, so output is clipped to that artboard.
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
  /**
   * Mapa de ficheros a usar EN LUGAR del de la escena viva.
   *
   * Existe para exportar imágenes que en la escena son URLs remotas: cargadas
   * por Excalidraw sin `crossOrigin`, contaminan el canvas y `toBlob()` muere
   * con SecurityError. `buildHydratedFiles()` (exportHydrate.ts) devuelve el
   * mismo mapa con los bytes inlineados, y se pasa por aquí.
   *
   * Se sustituye en la llamada al exportador —que es puro y recibe los ficheros
   * explícitamente— en vez de mutar la escena: `api.addFiles()` IGNORA los ids
   * que ya existen (`addMissingFiles` hace `continue`), así que por esa vía no
   * se puede reemplazar nada.
   */
  files?: Parameters<typeof exportToBlob>[0]['files'];
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
    files: opts?.files ?? api.getFiles(),
    exportingFrame: findFrame(api, opts?.pageId),
    ...(opts?.maxWidthOrHeight
      ? { maxWidthOrHeight: opts.maxWidthOrHeight }
      : { getDimensions: dimensions(opts) }),
    mimeType: 'image/png',
  });
}

/** Export the scene (or one page) to an SVG element. */
export async function exportSceneSvg(
  api: ExcalidrawImperativeAPI,
  opts?: ExportOptions & {
    /**
     * Tipografías propias a embeber. Excalidraw mete en el SVG las fuentes que
     * tiene REGISTRADAS, no las que sustituimos por `@font-face`, así que sin
     * esto el SVG sale con la tipografía de serie. Ver svgFonts.ts.
     */
    fontFaces?: readonly SvgFontFace[];
    /** Con esto las fuentes se incrustan como data URI y el SVG queda autocontenido. */
    fontFetcher?: (url: string) => Promise<Blob>;
  },
): Promise<SVGSVGElement> {
  const svg = await exportToSvg({
    elements: api.getSceneElements(),
    appState: exportAppState(api, opts),
    files: opts?.files ?? api.getFiles(),
    exportingFrame: findFrame(api, opts?.pageId),
  });

  const faces = opts?.fontFaces ?? [];
  if (!faces.length) return svg;

  const resueltas = opts?.fontFetcher
    ? (await inlineFontFaces(faces, opts.fontFetcher)).faces
    : faces;
  return appendFontFacesToSvg(svg, buildFontFaceCss(resueltas));
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
 *
 * jspdf is imported lazily (it's ~340KB min and PDF export is rare — Next
 * splits it out of the editor chunk), and each page is embedded as JPEG:
 * jsPDF passes JPEG bytes through (DCTDecode) instead of re-deflating PNG,
 * which keeps memory bounded on photo-heavy multi-page decks. Opacity is
 * guaranteed by the page paper + `exportBackground: true`.
 */
export async function exportScenePdf(
  api: ExcalidrawImperativeAPI,
  opts?: { background?: boolean; scale?: number; files?: ExportOptions['files'] },
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const elements = api.getSceneElements();
  // Igual que los otros exportadores: el mapa hidratado del host manda sobre el
  // de la escena, que con imágenes remotas contamina el canvas.
  const files = opts?.files ?? api.getFiles();
  const appState = exportAppState(api, opts);
  const targets: (FrameElement | null)[] = frames(api).length ? frames(api) : [null];

  let doc: InstanceType<typeof jsPDF> | null = null;
  const failures: string[] = [];
  for (const frame of targets) {
    try {
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
      doc.addImage(canvas, 'JPEG', 0, 0, w, h);
    } catch (err) {
      // One giant/broken page must not sink the whole document.
      failures.push(frame?.name ?? 'page');
      console.error('[canvas2] PDF page export failed', frame?.name, err);
    }
  }

  if (!doc) {
    throw new Error(
      failures.length ? `No se pudo exportar ninguna página (${failures.join(', ')})` : 'Nada que exportar',
    );
  }
  return doc.output('blob');
}
