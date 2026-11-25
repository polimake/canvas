import type { DeckSlide } from './useDeck';
import type { Canvas2Labels } from '../../shared/labels';
export interface FilmstripProps {
    slides: DeckSlide[];
    activeId: string | null;
    /** pageId → URL de su miniatura (usePageThumbnails). */
    thumbs: Record<string, string>;
    labels: Canvas2Labels;
    viewMode?: boolean;
    onSelect: (id: string) => void;
    onContextMenu: (id: string, at: {
        x: number;
        y: number;
    }) => void;
    onMove: (id: string, toIndex: number) => void;
    onNewAfter: (id: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
    onMoveBy: (id: string, where: 'up' | 'down') => void;
    onGrid: () => void;
    onCollapse: () => void;
}
export declare function Filmstrip({ slides, activeId, thumbs, labels, viewMode, onSelect, onContextMenu, onMove, onNewAfter, onDuplicate, onDelete, onMoveBy, onGrid, onCollapse, }: FilmstripProps): import("react").JSX.Element;
//# sourceMappingURL=Filmstrip.d.ts.map