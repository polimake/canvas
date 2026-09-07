import { type ExcalidrawImperativeAPI } from './excal';
/**
 * Align elements to their PAGE — the canvas2 analogue of the Canva clone's
 * single-selection alignment (Excalidraw's native align only works between 2+
 * selected elements; aligning to the artboard is our overlay's job).
 */
export type PageAlignment = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export declare const PAGE_ALIGNMENTS: Array<{
    key: PageAlignment;
    label: string;
    glyph: string;
}>;
/**
 * Align the given elements (default: the current selection) to the page.
 * Only the page's own members move; locked elements are left alone.
 * Returns how many elements moved.
 */
export declare function alignToPage(api: ExcalidrawImperativeAPI, pageId: string, alignment: PageAlignment, elementIds?: string[]): number;
//# sourceMappingURL=align.d.ts.map