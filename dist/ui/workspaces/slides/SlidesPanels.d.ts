import type { ExcalidrawImperativeAPI } from '../../../core/excal';
import type { WorkspacePanel } from '../types';
import type { Canvas2Labels } from '../../shared/labels';
export interface SlidesPanelsProps {
    api: ExcalidrawImperativeAPI;
    activePageId: string | null;
    panels: WorkspacePanel[];
    openPanel: string | null;
    onOpenPanel: (id: string | null) => void;
    labels: Canvas2Labels;
    /** «Detalles»: el host enseña los datos de la pieza (texto, comentarios). */
    onDetails?: () => void;
    detailsOpen?: boolean;
    /** «Importar tema»: solo si el host sabe hacerlo. */
    onImportTheme?: () => void;
}
/**
 * A la derecha, como en Slides: la tira de iconos y, al pulsar uno, su panel
 * entre la tira y el lienzo. Son los MISMOS paneles que el resto de espacios
 * (Canvas2.tsx los construye una vez); aquí solo cambia dónde se abren. Fondo
 * es el panel de la página (DesignPanel), Tema el de la marca (BrandGallery) y
 * Transición el único propio del espacio.
 */
export declare function SlidesPanels({ api, activePageId, panels, openPanel, onOpenPanel, labels, onDetails, detailsOpen, onImportTheme, }: SlidesPanelsProps): import("react").JSX.Element;
//# sourceMappingURL=SlidesPanels.d.ts.map