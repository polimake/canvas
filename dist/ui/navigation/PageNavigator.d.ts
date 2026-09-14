import type { ExcalidrawImperativeAPI } from '../../core/excal';
import { type PageSize } from '../../core/pages';
import { type FilesMap } from '../hooks/pageThumbnails';
import { type PartialLabels } from '../shared/labels';
export interface PageNavigatorProps {
    api: ExcalidrawImperativeAPI;
    theme?: 'light' | 'dark';
    /** Read-only mode: la tira sigue navegando; se ocultan renombrar y reordenar. */
    viewMode?: boolean;
    /** Excalidraw está en su distribución de móvil: ver `narrow.ts`. */
    narrow?: boolean;
    /** Controlled active page id. When provided, the strip reflects it instead of
     *  its own local state (so it can stay in sync with the LayersPanel). */
    activeId?: string | null;
    /** Notified when the user switches pages. */
    onActiveChange?: (id: string) => void;
    /**
     * Miniatura por página en los chips (como la tira del editor legacy).
     * Apagado por defecto: rasterizar cuesta, y una escena con imágenes remotas
     * necesita además el mapa hidratado (`thumbnailFiles`) o no producirá nada.
     */
    thumbnails?: boolean;
    /** Mapa de ficheros hidratado para poder rasterizar imágenes remotas. */
    thumbnailFiles?: FilesMap;
    /** Tamaño de respaldo para "Añadir página" cuando no hay ninguna de la que heredar. */
    pageSize?: PageSize;
    /** Textos, inyectados por el host (ver labels.ts). */
    labels?: PartialLabels;
}
/**
 * Tira de páginas, abajo y centrada. Lee las páginas (marcos) en vivo de la
 * escena y sirve para NAVEGAR: cambiar de página, reordenarlas arrastrando y
 * renombrar con doble clic. Todo lo demás vive donde se opera: las acciones de la página en
 * `PageActions`, sobre el lienzo; fondo, tamaño y exportación en `CanvasMenu`.
 */
export declare function PageNavigator({ api, theme, viewMode, narrow, activeId: controlledActiveId, onActiveChange, labels: labelsProp, thumbnails, thumbnailFiles, pageSize, }: PageNavigatorProps): import("react").JSX.Element;
export default PageNavigator;
//# sourceMappingURL=PageNavigator.d.ts.map