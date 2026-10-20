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
 * PURA: devuelve cada papel a los límites exactos de su marco.
 *
 * El papel ES la página a la vista —el marco no pinta nada, ver
 * `buildPageBackground`— y el marco es lo que recorta y lo que se exporta, así
 * que los dos tienen que ocupar el mismo rectángulo. Todo lo que crea o cambia
 * una página lo cumple: el papel nace con los límites del marco, `resizePage`
 * lo estira a los nuevos y mover una página se lleva a sus miembros con ella.
 * Pero nadie lo REPONÍA: hasta el 11/10 `addPage` y la paginación dejaban el
 * papel 10 px por debajo de su marco (el margen que Excalidraw pone a un marco
 * sin hijos), y un diseño guardado así se quedaba así para siempre. Lo mismo un
 * marco estirado a mano en el lienzo, que Excalidraw redimensiona sin tocar a
 * sus miembros.
 *
 * Solo toca papeles, y solo los que tienen marco: uno suelto, o de un marco que
 * ya no existe, se queda como está, y a una página sin papel no se le inventa
 * aquí (eso es cosa de `ensurePagePapers`).
 *
 * Devuelve la MISMA referencia cuando no hay nada que mover —como
 * `packPagesInArray`—, que es lo que permite llamarla en cada pasada del
 * normalizador sin escribir en la escena.
 */
export declare function fitPagePapersInArray(elements: readonly SceneElement[]): readonly SceneElement[];
/**
 * ¿Hay alguna página cuyo papel no es su miembro más bajo? Es la comprobación
 * barata que el lienzo hace en cada `onChange` para no esperar al normalizador
 * con retardo: al soltar un elemento en otra página, Excalidraw le cambia el
 * `frameId` pero no su sitio en el orden, y si estaba por debajo del papel de
 * la nueva página se queda tapado por él hasta que alguien lo hunde.
 */
export declare function hasRaisedPaper(elements: readonly SceneElement[]): boolean;
/**
 * Garantiza el suelo de cada página: que TENGA papel, que el papel esté ABAJO y
 * que ocupe su marco.
 *
 * Nació como migración de una sola pasada para escenas anteriores al papel, y
 * por eso volvía al primer `return` en cuanto todas las páginas tenían uno. El
 * efecto era que el papel se colocaba bien el día que se creaba y nunca más se
 * revisaba: bastaba que algo lo levantara UNA vez (un deshacer, un reordenado
 * con la lista incompleta) para que la página se quedara tapada por su propio
 * fondo para siempre, porque nadie volvía a bajarlo.
 *
 * Ahora corre en cada pasada del normalizador y hace las tres cosas —crear el
 * que falte, hundir el que se haya levantado y devolver a su marco el que esté
 * descolocado (ver `fitPagePapersInArray`)— en un SOLO commit invisible al
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