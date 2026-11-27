import type { ExcalidrawImperativeAPI } from '../../core/excal';
import { listPages } from '../../core/pages';
import type { FilesMap } from '../hooks/pageThumbnails';
import type { SvgFontFace } from '../../core/svgFonts';
/**
 * Exportar desde el editor. Lo usan el menú ☰ (CanvasMenu) y Archivo ›
 * Descargar del espacio Presentación: un solo camino, con la misma hidratación
 * de imágenes y las mismas fuentes embebidas.
 */
export type ExportKind = 'png' | 'png-all' | 'svg' | 'pdf' | 'pptx' | 'potx';
export interface ExportContext {
    activePageId?: string | null;
    /**
     * Trae el mapa de ficheros hidratado justo antes de exportar (ver
     * `CanvasMenuProps.hydrateFiles`): con imágenes remotas el canvas queda
     * contaminado y `toBlob` muere con SecurityError.
     */
    hydrateFiles?: (opts?: {
        output?: 'blob' | 'dataurl';
    }) => Promise<FilesMap>;
    /** Tipografías de la marca, para embeberlas en el SVG (svgFonts.ts). */
    fontFaces?: readonly SvgFontFace[];
    /** Nombre de serie del fichero cuando la página no da uno. */
    fallbackName: string;
    /** Los nombres de las páginas sin nombre (labels.pages). */
    pageNames?: Parameters<typeof listPages>[1];
    /** Nombre de la presentación (PowerPoint): título del documento y del fichero. */
    title?: string;
    /** Idioma de los textos en PowerPoint (`es-ES`). */
    lang?: string;
}
/** `fallback` es el nombre de serie, para cuando la página no da uno. */
export declare function safeFilename(name: string | undefined, fallback: string): string;
export declare function runCanvasExport(api: ExcalidrawImperativeAPI, kind: ExportKind, ctx: ExportContext): Promise<void>;
//# sourceMappingURL=exportActions.d.ts.map