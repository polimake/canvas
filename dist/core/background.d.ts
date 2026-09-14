import { type ExcalidrawImperativeAPI, type SceneElement } from './excal';
import { type CaptureMode } from './mutate';
/** Whether an element is a page's background "paper" sheet. */
export declare function isPageBackground(el: SceneElement): boolean;
/**
 * Build the background "paper" element for a page: a locked, full-bleed,
 * SHARP-CORNERED rectangle (roughness 0, no roundness) with a hairline border.
 * Pages read as straight-edged sheets — Excalidraw's own frame outline (which
 * is drawn with rounded corners and no public radius knob) is disabled by the
 * editor (`frameRendering.outline: false`), so this rect IS the page's visual.
 */
export declare function buildPageBackground(pageId: string, bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
}, color: string): SceneElement[];
/**
 * One-time migration for scenes created before pages had paper sheets: every
 * frame without a background rect gets a white one, in a SINGLE commit that is
 * invisible to undo by default (capture 'never') — otherwise the first Ctrl+Z
 * after opening a legacy scene would delete a page's paper.
 */
export declare function ensurePagePapers(api: ExcalidrawImperativeAPI, capture?: CaptureMode): void;
/** Current background color of a page, or null if it has none. */
export declare function getPageBackground(api: ExcalidrawImperativeAPI, pageId: string): string | null;
/**
 * Set (or replace) a page's background color. Pass `null` to remove it.
 * Re-coloring PATCHES the existing paper in place — same element id, one
 * history-visible change. `capture: 'transient'` is for live previews (the
 * color-input drag); the final pick commits 'undoable'.
 * Returns the background element id, or null when removing.
 */
export declare function setPageBackgroundColor(api: ExcalidrawImperativeAPI, pageId: string, color: string | null, opts?: {
    capture?: CaptureMode;
}): string | null;
//# sourceMappingURL=background.d.ts.map