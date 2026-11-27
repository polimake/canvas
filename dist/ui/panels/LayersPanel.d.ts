import { type ExcalidrawImperativeAPI, type SceneElement } from '../../core/excal';
import { type Canvas2Labels, type PartialLabels } from '../shared/labels';
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
/** Una fila de la lista: una capa suelta (o dentro de un grupo abierto) o un grupo. */
export type LayerItem = {
    kind: 'element';
    el: SceneElement;
    depth: 0 | 1;
} | {
    kind: 'group';
    id: string;
    members: SceneElement[];
};
/**
 * La lista tal y como se pinta, de arriba abajo. Cada grupo de dos o más capas
 * sale UNA vez, en el sitio de su capa más alta, y sus capas solo debajo de él
 * y si está desplegado. Antes salía cada línea y cada elipse por separado, y
 * una pieza de la IA eran treinta filas de «Línea» y «Elipse» sin forma de
 * saber cuál era cuál.
 */
export declare function layerItems(rows: readonly SceneElement[], open: ReadonlySet<string>): LayerItem[];
/** Un grupo se llama como su primer texto («Bordado»); sin texto, «Grupo». */
export declare function groupName(members: readonly SceneElement[], L: Canvas2Labels['layers']): string;
/**
 * Right-docked layers panel. Lists the active page's elements (top of stack
 * first) with reorder / visibility / lock / delete, plus image
 * "Fondo"/"Extender" actions. Excalidraw
 * has no per-element hidden flag, so visibility is emulated with `opacity: 0`.
 */
export declare function LayersPanel({ api, activePageId, theme, viewMode, embedded, labels: labelsProp, }: LayersPanelProps): import("react").JSX.Element | null;
//# sourceMappingURL=LayersPanel.d.ts.map