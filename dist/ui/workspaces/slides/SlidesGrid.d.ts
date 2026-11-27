import type { DeckSlide } from './useDeck';
import type { Canvas2Labels } from '../../shared/labels';
export interface SlidesGridProps {
    slides: DeckSlide[];
    activeId: string | null;
    thumbs: Record<string, string>;
    labels: Canvas2Labels;
    /** Abre la diapositiva y vuelve a la vista de una. */
    onOpen: (id: string) => void;
    onSelect: (id: string) => void;
    onContextMenu: (id: string, at: {
        x: number;
        y: number;
    }) => void;
    onBack: () => void;
}
/** Vista de cuadrícula (Ver › Vista de cuadrícula): todas las diapositivas de un vistazo. */
export declare function SlidesGrid({ slides, activeId, thumbs, labels, onOpen, onSelect, onContextMenu, onBack }: SlidesGridProps): import("react").JSX.Element;
//# sourceMappingURL=SlidesGrid.d.ts.map