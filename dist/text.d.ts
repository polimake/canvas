import { type ExcalidrawImperativeAPI } from './excal';
/**
 * Text presets — the canvas2 analogue of the Canva clone's sidebar "Agregar un
 * título / subtítulo / cuerpo". Pure overlay: inserts a normal Excalidraw text
 * element (public skeleton API), so nothing here depends on editor internals.
 *
 * Presets are page-aware: each anchors at its own vertical position (no
 * overlapping stack when inserting Título then Subtítulo), font size scales
 * with the page width (64px on a 1080-wide page), and the text color is chosen
 * by the page background's luminance so presets are never invisible on dark
 * papers.
 */
export type TextPresetKey = 'heading' | 'subheading' | 'body';
export interface TextPreset {
    key: TextPresetKey;
    label: string;
    text: string;
    /** Font size on a 1080px-wide page; scales linearly with page width. */
    fontSize: number;
    /** Vertical anchor as a fraction of the page height. */
    anchorY: number;
}
export declare const TEXT_PRESETS: TextPreset[];
/** Dark text on light backgrounds, white text on dark ones. */
export declare function contrastTextColor(background: string | null): string;
/**
 * Insert a preset text element onto a page (defaults to the first page), at
 * the preset's own anchor, sized for the page, colored against the page
 * background, and selected so the user can retype immediately.
 * Returns the new element id, or null without a target page.
 */
export declare function insertTextPreset(api: ExcalidrawImperativeAPI, preset: TextPresetKey, opts?: {
    pageId?: string;
    /**
     * Nombre de la familia de marca para este preset (titular o cuerpo). Ya
     * registrada por `Canvas2Editor`; si no lo estuviera, se cae a la de serie
     * en vez de estampar un id que no resuelve a nada.
     */
    fontFamily?: string | null;
}): string | null;
//# sourceMappingURL=text.d.ts.map