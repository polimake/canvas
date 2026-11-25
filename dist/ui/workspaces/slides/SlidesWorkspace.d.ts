import { type RefObject } from 'react';
import { type ExcalidrawImperativeAPI } from '../../../core/excal';
import { type PageSize } from '../../../core/pages';
import { type FilesMap } from '../../hooks/pageThumbnails';
import { type ExportContext } from '../../shared/exportActions';
import type { Canvas2Labels } from '../../shared/labels';
import type { CanvasWorkspace, WorkspacePanel } from '../types';
import './slides.css';
/** Lo que el host puede añadir al espacio (todo opcional). */
export interface SlidesHostOptions {
    /** Nombre de la presentación, en la fila de menús. */
    title?: string;
    /** Botón «Detalles» de la tira derecha: el host enseña los datos de la pieza. */
    onDetails?: () => void;
    detailsOpen?: boolean;
    /** «Importar tema» en el panel Tema. */
    onImportTheme?: () => void;
    /** Botón de comentar de la barra. */
    onComment?: () => void;
    /** Archivo › Importar diapositivas: el host lee el fichero, sube sus imágenes y lo convierte. */
    importSlides?: SlidesImport;
}
/**
 * Importar diapositivas a la presentación abierta. El host hace lo que solo él
 * puede (subir las imágenes a su almacén, resolver las fuentes) y devuelve las
 * páginas ya convertidas (`documentToScene`); el espacio las añade detrás de la
 * activa en una sola entrada de deshacer (`insertPagesIntoScene`).
 */
export interface SlidesImport {
    /** Lo que admite el selector de ficheros (`.pptx,.pdf`). */
    accept: string;
    load: (file: File) => Promise<{
        elements: readonly unknown[];
        files?: Record<string, unknown>;
    } | null>;
}
export interface SlidesWorkspaceProps {
    api: ExcalidrawImperativeAPI;
    /** El envoltorio `[data-canvas2]`: dentro está Excalidraw. */
    rootRef: RefObject<HTMLDivElement | null>;
    activePageId: string | null;
    onActiveChange: (id: string) => void;
    /** Los paneles de siempre (Canvas2.tsx): aquí se abren a la derecha. */
    panels: WorkspacePanel[];
    labels: Canvas2Labels;
    /** Tamaño de una página nueva si aún no hay ninguna (las demás heredan el de la activa). */
    pageSize?: PageSize;
    thumbnailFiles?: FilesMap;
    hydrateFiles?: ExportContext['hydrateFiles'];
    fontFaces?: ExportContext['fontFaces'];
    viewMode?: boolean;
    workspace: CanvasWorkspace;
    onWorkspaceChange?: (workspace: CanvasWorkspace) => void;
    workspaces: readonly CanvasWorkspace[];
    onSaveComponent?: () => void;
    host?: SlidesHostOptions;
    /** Idioma de los textos al exportar a PowerPoint (`es-ES`). */
    lang?: string;
    /** El panel abierto del editor (`Canvas2`), el mismo en todos los espacios. */
    openPanel?: string | null;
    onOpenPanelChange?: (id: string | null) => void;
}
/**
 * El espacio «Presentación»: el lienzo de siempre con la distribución de Slides.
 *
 * Todo el cromo va ENCIMA de Excalidraw, en capas, en vez de encogerlo: su caja
 * recorta lo que sale de ella, y las opciones de formato de la selección (que
 * son suyas) tienen que caer dentro de nuestra barra. Por eso el encuadre de la
 * diapositiva se calcula para el hueco que dejan las capas (`slideView.ts`) y
 * las vecinas se tapan con el color de la mesa.
 *
 * No hay datos nuevos salvo las notas, saltar y la transición (`slideMeta.ts`):
 * cada diapositiva es una página, y todas las órdenes son las de `core`.
 */
export declare function SlidesWorkspace(props: SlidesWorkspaceProps): import("react").JSX.Element;
//# sourceMappingURL=SlidesWorkspace.d.ts.map