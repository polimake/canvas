import { exportToBlob, type ExcalidrawImperativeAPI } from './excal';
import { type StoredScene } from './serialize';
import { type SvgFontFace } from './svgFonts';
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
/** Export the scene (or one page) to a PNG blob. */
export declare function exportScenePng(api: ExcalidrawImperativeAPI, opts?: ExportOptions): Promise<Blob>;
/** Export the scene (or one page) to an SVG element. */
export declare function exportSceneSvg(api: ExcalidrawImperativeAPI, opts?: ExportOptions & {
    /**
     * Tipografías propias a embeber. Excalidraw mete en el SVG las fuentes que
     * tiene REGISTRADAS, no las que sustituimos por `@font-face`, así que sin
     * esto el SVG sale con la tipografía de serie. Ver svgFonts.ts.
     */
    fontFaces?: readonly SvgFontFace[];
    /** Con esto las fuentes se incrustan como data URI y el SVG queda autocontenido. */
    fontFetcher?: (url: string) => Promise<Blob>;
}): Promise<SVGSVGElement>;
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
export declare function exportStoredSceneSvg(scene: StoredScene, opts?: {
    pageIndex?: number;
    background?: boolean;
    darkMode?: boolean;
}): Promise<SVGSVGElement>;
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
export declare function exportStoredScenePng(scene: StoredScene, opts?: {
    pageIndex?: number;
    background?: boolean;
    darkMode?: boolean;
    /** Acota el lado mayor. Para miniaturas: una story a escala 1 son 1080×1920. */
    maxWidthOrHeight?: number;
    /** Sustituye el mapa de ficheros de la escena (imágenes ya inlineadas). */
    files?: Parameters<typeof exportToBlob>[0]['files'];
}): Promise<Blob>;
/** How many pages a stored scene has, without restoring or rendering it. */
export declare function storedScenePageCount(scene: StoredScene): number;
/**
 * Capture a small PNG thumbnail (defaults to the first page, ≤512px) — for
 * content cards / template grids, mirroring polimake's `ThumbnailFn`.
 */
export declare function captureThumbnail(api: ExcalidrawImperativeAPI, opts?: {
    pageId?: string;
    maxSize?: number;
}): Promise<Blob>;
/** Trigger a browser download for a blob (host-side convenience). */
export declare function downloadBlob(blob: Blob, filename: string): void;
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
export declare function exportScenePdf(api: ExcalidrawImperativeAPI, opts?: {
    background?: boolean;
    scale?: number;
    files?: ExportOptions['files'];
}): Promise<Blob>;
//# sourceMappingURL=export.d.ts.map