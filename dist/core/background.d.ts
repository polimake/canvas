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
 * Garantiza el suelo de cada página: que TENGA papel y que el papel esté ABAJO.
 *
 * Nació como migración de una sola pasada para escenas anteriores al papel, y
 * por eso volvía al primer `return` en cuanto todas las páginas tenían uno. El
 * efecto era que el papel se colocaba bien el día que se creaba y nunca más se
 * revisaba: bastaba que algo lo levantara UNA vez (un deshacer, un reordenado
 * con la lista incompleta) para que la página se quedara tapada por su propio
 * fondo para siempre, porque nadie volvía a bajarlo.
 *
 * Ahora corre en cada pasada del normalizador y hace las dos mitades —crear el
 * que falte y hundir el que se haya levantado— en un SOLO commit invisible al
 * historial (`capture: 'never'`): es la forma canónica de la escena, no una
 * edición del usuario, y el primer Ctrl+Z tras abrir no debe borrar un papel.
 * Si no hay nada que corregir no commitea nada, que es lo que la hace apta para
 * un `onChange`.
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