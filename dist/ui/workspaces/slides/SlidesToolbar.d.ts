import type { Canvas2Labels } from '../../shared/labels';
export type SlidesTool = 'selection' | 'text' | 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow';
/** Paneles que se abren desde la barra (a la derecha, en la tira de paneles). */
export type ToolbarPanel = 'design' | 'components' | 'brand' | 'transition';
export interface SlidesToolbarProps {
    labels: Canvas2Labels;
    activeTool: string;
    /**
     * Excalidraw enseña sus opciones de formato (con selección o con una
     * herramienta de dibujo): ocupan el hueco derecho de la barra.
     */
    formatting: boolean;
    zoom: number;
    openPanel: string | null;
    /** Qué paneles existen (los da el host): sin el panel, sin botón. */
    available: Partial<Record<ToolbarPanel | 'library' | 'search' | 'comment', boolean>>;
    menusHidden: boolean;
    viewMode?: boolean;
    onSearch: () => void;
    onNewSlide: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onZoomFit: () => void;
    onZoomTo: (zoom: number) => void;
    onZoomStep: (dir: 1 | -1) => void;
    onTool: (tool: SlidesTool) => void;
    onImage: () => void;
    onComment?: () => void;
    onPanel: (panel: ToolbarPanel) => void;
    onToggleMenus: () => void;
    /**
     * Ancho de la parte fija (de la lupa al comentario). Las opciones de formato
     * de Excalidraw se colocan justo detrás (slides.css, `--slides-props-left`).
     */
    onFixedWidth: (px: number) => void;
}
/**
 * La barra de herramientas del espacio Presentación: la píldora de Slides.
 *
 * Izquierda fija (buscar, nueva, deshacer, zoom, herramientas); a la derecha,
 * sin selección, Fondo · Componentes · Tema · Transición, y con selección, las
 * opciones de formato NATIVAS de Excalidraw, que el CSS coloca en ese hueco: son
 * las que saben qué propiedades tiene cada elemento y cómo deshacerlas.
 */
export declare function SlidesToolbar(props: SlidesToolbarProps): import("react").JSX.Element;
//# sourceMappingURL=SlidesToolbar.d.ts.map