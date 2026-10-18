import { type ExcalidrawImperativeAPI } from '../../core/excal';
import { type PartialLabels } from '../shared/labels';
export interface LayersPanelProps {
    api: ExcalidrawImperativeAPI;
    activePageId: string | null;
    theme?: 'light' | 'dark';
    /** Read-only mode: rows become click-to-select only, no mutations. */
    viewMode?: boolean;
    /** Dentro de una pestaña de la barra lateral: sin flotar, sin marco propio. */
    embedded?: boolean;
    /** Textos, inyectados por el host (ver labels.ts). */
    labels?: PartialLabels;
}
/**
 * Right-docked layers panel. Lists the active page's elements (top of stack
 * first) with reorder / visibility / lock / delete, plus image
 * "Fondo"/"Extender" actions. Excalidraw
 * has no per-element hidden flag, so visibility is emulated with `opacity: 0`.
 */
export declare function LayersPanel({ api, activePageId, theme, viewMode, embedded, labels: labelsProp, }: LayersPanelProps): import("react").JSX.Element | null;
//# sourceMappingURL=LayersPanel.d.ts.map