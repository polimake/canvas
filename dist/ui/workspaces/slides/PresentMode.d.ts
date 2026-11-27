import type { ExcalidrawImperativeAPI } from '../../../core/excal';
import type { DeckSlide } from './useDeck';
import type { Canvas2Labels } from '../../shared/labels';
export interface PresentModeProps {
    api: ExcalidrawImperativeAPI;
    slides: DeckSlide[];
    /** Por dónde empieza (la activa, o la primera con «desde el principio»). */
    startId: string | null;
    labels: Canvas2Labels;
    /** Al salir, la diapositiva en la que se estaba: el editor vuelve a ella. */
    onExit: (lastId: string | null) => void;
    /** Abrir directamente con la vista del orador. */
    presenter?: boolean;
}
/**
 * Presentar a pantalla completa, como en Slides.
 *
 * Cada diapositiva se pinta con `exportSceneSvg` y el SVG va INLINE (no como
 * `<img>`): así usa las fuentes de la marca que la página ya tiene cargadas y
 * las imágenes por su URL, sin hidratarlas. Se pintan bajo demanda (la actual
 * y la siguiente) y se guardan para no repetir. Las que se saltan no salen.
 */
export declare function PresentMode({ api, slides, startId, labels, onExit, presenter: presenterAtStart }: PresentModeProps): import("react").ReactPortal;
//# sourceMappingURL=PresentMode.d.ts.map