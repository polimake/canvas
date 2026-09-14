import {
  exportToBlob,
  exportToCanvas,
  exportToSvg,
  type ExcalidrawImperativeAPI,
  type FrameElement,
  type SceneElement,
} from './excal';
import { restoreScene, type StoredScene } from './serialize';
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
  const svg = await sinRuidoDeFuentes<SVGSVGElement>(() =>
    exportToSvg({
      elements: api.getSceneElements(),
      appState: exportAppState(api, opts),
      files: opts?.files ?? api.getFiles(),
      exportingFrame: findFrame(api, opts?.pageId),
    }),
  );

  const faces = opts?.fontFaces ?? [];
  if (!faces.length) return svg;

  const resueltas = opts?.fontFetcher
    ? (await inlineFontFaces(faces, opts.fontFetcher)).faces
    : faces;
  return appendFontFacesToSvg(svg, buildFontFaceCss(resueltas));
}

/**
 * Al exportar, Excalidraw intenta embeber los `@font-face` de las fuentes que
 * tiene en su registro privado (`Fonts.registered`) — donde las familias
 * propias no pueden estar (ver fonts.ts: solo escribimos en `FONT_FAMILY`).
 * Por cada familia nuestra suelta un `console.error` "Couldn't find registered
 * fonts for font-family «id»" que para nosotros es ruido esperado: el SVG se
 * inyecta inline y resuelve los `@font-face` de la página (o se embeben aparte
 * vía `fontFaces`, ver svgFonts.ts). Se silencia SOLO ese mensaje y solo
 * mientras dura la exportación, con contador porque la rejilla de la galería
 * lanza varias exportaciones solapadas.
 */
let exportacionesSilenciadas = 0;
let consoleErrorReal: typeof console.error | null = null;
async function sinRuidoDeFuentes<T>(fn: () => Promise<T>): Promise<T> {
  if (exportacionesSilenciadas === 0) {
    consoleErrorReal = console.error;
    console.error = (...args: unknown[]) => {
      if (
        typeof args[0] === 'string' &&
        args[0].startsWith("Couldn't find registered fonts for font-family")
      ) {
        return;
      }
      consoleErrorReal?.(...args);
    };
  }
  exportacionesSilenciadas += 1;
  try {
    return await fn();
  } finally {
    exportacionesSilenciadas -= 1;
    if (exportacionesSilenciadas === 0 && consoleErrorReal) {
      console.error = consoleErrorReal;
      consoleErrorReal = null;
    }
  }
}

/**
 * Render a STORED scene to SVG without mounting an editor.
 *
 * The api-based exporters above all need a live `ExcalidrawImperativeAPI`, so
 * previewing N saved designs at once (a gallery grid, a template picker) would
 * mean N mounted editors. This takes the JSON straight from storage instead.
 *
 * Goes through `restoreScene` (serialize.ts) for the same reason the editor
 * does: a stored file may lack fields the renderer needs (fractional `index`,
 * `lineHeight`) or carry text boxes narrower than the real glyphs, and
 * `exportToSvg` draws exactly what it is handed. Sharing that one entry point
 * is also what keeps a preview identical to what opening the file shows.
 *
 * With `pageIndex` only that page (frame) is drawn, clipped to its bounds;
 * pages are counted left→right, like everywhere else in this package.
 */
export async function exportStoredSceneSvg(
  scene: StoredScene,
  opts?: { pageIndex?: number; background?: boolean; darkMode?: boolean },
): Promise<SVGSVGElement> {
  const restored = restoreScene(scene);
  const elements = (restored.elements ?? []) as readonly SceneElement[];

  const pages = elements
    .filter((e): e is FrameElement => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);

  const viewBackgroundColor = (scene.appState as { viewBackgroundColor?: string } | undefined)
    ?.viewBackgroundColor;

  return sinRuidoDeFuentes<SVGSVGElement>(() =>
    exportToSvg({
      elements: elements as never,
      appState: {
        exportBackground: opts?.background ?? true,
        exportWithDarkMode: opts?.darkMode ?? false,
        viewBackgroundColor,
      },
      files: (restored.files ?? {}) as never,
      exportingFrame: opts?.pageIndex === undefined ? null : (pages[opts.pageIndex] ?? null),
    }),
  );
}

/**
 * Render a STORED scene to a PNG blob without mounting an editor.
 *
 * El hermano de `exportStoredSceneSvg`, y existe por el mismo motivo: poder
 * dibujar una escena guardada sin montar un editor por cada una. Lo que cambia
 * es a qué se dibuja, y eso trae una condición que el SVG no tiene.
 *
 * EL CANVAS SE CONTAMINA
 *
 * El PNG sale de un `<canvas>`, así que toda imagen de la escena tiene que ser
 * cargable SIN contaminarlo o `toBlob()` muere con `SecurityError`. Excalidraw
 * carga las imágenes sin `crossOrigin` (ver exportHydrate.ts), de modo que
 * cualquier URL de otro origen contamina aunque el servidor mande CORS. Quien
 * llame tiene que entregar la escena con las imágenes ya en un origen propio
 * —o pasarlas por `files`—; aquí no se puede arreglar, porque para entonces el
 * canvas ya está sucio.
 *
 * Las tipografías, en cambio, salen gratis: el canvas resuelve las familias
 * contra las del documento, así que basta con haberlas cargado antes (lo que
 * hace `ensureDesignFonts`). Es el SVG el que necesitaba embeberlas.
 */
export async function exportStoredScenePng(
  scene: StoredScene,
  opts?: {
    pageIndex?: number;
    background?: boolean;
    darkMode?: boolean;
    /** Acota el lado mayor. Para miniaturas: una story a escala 1 son 1080×1920. */
    maxWidthOrHeight?: number;
    /** Sustituye el mapa de ficheros de la escena (imágenes ya inlineadas). */
    files?: Parameters<typeof exportToBlob>[0]['files'];
  },
): Promise<Blob> {
  const restored = restoreScene(scene);
  const elements = (restored.elements ?? []) as readonly SceneElement[];

  const pages = elements
    .filter((e): e is FrameElement => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);

  const viewBackgroundColor = (scene.appState as { viewBackgroundColor?: string } | undefined)
    ?.viewBackgroundColor;

  return sinRuidoDeFuentes<Blob>(() =>
    exportToBlob({
      elements: elements as never,
      appState: {
        exportBackground: opts?.background ?? true,
        exportWithDarkMode: opts?.darkMode ?? false,
        viewBackgroundColor,
      },
      files: (opts?.files ?? restored.files ?? {}) as never,
      exportingFrame: opts?.pageIndex === undefined ? null : (pages[opts.pageIndex] ?? null),
      ...(opts?.maxWidthOrHeight
        ? { maxWidthOrHeight: opts.maxWidthOrHeight }
        : { getDimensions: dimensions({ scale: 1 }) }),
      mimeType: 'image/png',
    }),
  );
}

/** How many pages a stored scene has, without restoring or rendering it. */
export function storedScenePageCount(scene: StoredScene): number {
  if (!Array.isArray(scene.elements)) return 0;
  return scene.elements.filter(
    (e) => (e as { type?: string; isDeleted?: boolean } | null)?.type === 'frame'
      && !(e as { isDeleted?: boolean }).isDeleted,
  ).length;
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
