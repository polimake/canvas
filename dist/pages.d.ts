import { type ExcalidrawImperativeAPI, type SceneElement, type SceneElements } from './excal';
import { type CaptureMode } from './mutate';
/**
 * "Pages" / artboards on top of Excalidraw's infinite canvas.
 *
 * A design is a fixed-size, multi-page document; Excalidraw is an infinite
 * plane. We emulate pages with native Excalidraw **frames** laid out left to
 * right: each frame is a fixed-size artboard, content placed inside it belongs
 * to that page, and a frame clips + exports to its own bounds. This is a *soft*
 * boundary — the canvas stays pannable.
 *
 * Every compound operation here commits EXACTLY ONE scene update (one undo
 * entry) via mutate.ts — building the final array with pure helpers
 * (packPagesInArray / renumberPagesInArray) instead of chaining updates.
 */
export interface PageSize {
    width: number;
    height: number;
}
export interface PageInfo {
    id: string;
    name: string;
    index: number;
    width: number;
    height: number;
    locked: boolean;
    /** Posición del marco en coordenadas de ESCENA (no de pantalla). La usa la
     *  barra de acciones flotante para anclarse junto al nombre de la página. */
    x: number;
    y: number;
}
/** Social-first default (IG feed 4:5) — new documents are made to publish. */
export declare const DEFAULT_PAGE_SIZE: PageSize;
/** Named artboard sizes offered by the size menu (social-first, like Canva). */
export interface PageSizePreset extends PageSize {
    key: string;
    label: string;
}
export declare const PAGE_SIZE_PRESETS: PageSizePreset[];
/**
 * PURE: re-pack pages flush left → right, preserving `order` (default: current
 * document order) and anchoring the strip at the current leftmost x and at the
 * y de la PRIMERA página. Members travel with their frame. De paso graba en cada
 * marco su posición (ver `PAGE_MARKER`), que es lo que hace que el orden
 * sobreviva a un arrastre. Returns the SAME array reference when nothing moves.
 *
 * La `y` se alinea igual que la `x` porque si no la fila se desmigaja sin vuelta
 * atrás: nada la reponía, así que una página arrastrada hacia abajo se quedaba
 * ahí para siempre y `addPage` colocaba además la nueva en `y = 0` aunque la
 * fila entera viviera en otra altura.
 */
export declare function packPagesInArray(elements: readonly SceneElement[], orderedFrameIds?: string[]): readonly SceneElement[];
/**
 * PURE: da nombre de página a los marcos que han entrado por su cuenta.
 *
 * La herramienta de marco de Excalidraw sigue accesible (la tecla `F` no se
 * puede desactivar), y todo marco de la escena ES una página para este modelo:
 * salía en la tira, se exportaba y se llevaba su hueco en la fila, pero con el
 * nombre por defecto de Excalidraw, que `renumberPagesInArray` no reconoce y por
 * tanto nunca renumeraba.
 *
 * Solo actúa cuando el documento YA está marcado y aparece un marco sin marcar:
 * si no lo está NINGUNO estamos ante una escena antigua recién abierta, y
 * renombrarla en bloque borraría los nombres que haya puesto el usuario.
 */
export declare function adoptStrayFramesInArray(elements: readonly SceneElement[]): readonly SceneElement[];
/**
 * PURE: give default-named pages ("Página N") their positional number, in
 * `orderedFrameIds` order. Custom names (incl. "(copia)") are left alone.
 *
 * Returns the SAME array reference when no page needs renaming — igual que
 * `packPagesInArray`. Sin eso, `.map` devolvía siempre un array nuevo y quien
 * encadena las dos primitivas no podía distinguir "no ha cambiado nada" de "ha
 * cambiado algo", y acababa escribiendo en la escena una entrada de deshacer
 * vacía.
 */
export declare function renumberPagesInArray(elements: readonly SceneElement[], orderedFrameIds: string[]): readonly SceneElement[];
/**
 * Build a blank scene containing a single page frame. Feed the result to
 * `Canvas2Editor`'s `initialScene`.
 */
export declare function createBlankScene(pageSize?: PageSize): {
    elements: SceneElements;
};
/** Snapshot of the current pages, ordered left → right. */
export declare function listPages(api: ExcalidrawImperativeAPI): PageInfo[];
/** Current size of one page (frame), or null if it doesn't exist. */
export declare function getPageSize(api: ExcalidrawImperativeAPI, pageId: string): PageSize | null;
/**
 * Add a blank page. With `afterPageId` the page is inserted right after that
 * page and with `beforePageId` right before it (pages to the right shift over);
 * with neither, it is appended at the end. One undo entry; returns the new
 * frame id.
 *
 * `beforePageId` existe para el insertador de la tira, que ofrece una juntura
 * ANTES de cada página —incluida la primera—. Sin él, insertar en cabeza había
 * que hacerlo en dos pasos (crear al final + mover), o sea dos entradas de
 * deshacer para un solo gesto.
 */
export declare function addPage(api: ExcalidrawImperativeAPI, pageSize?: PageSize, opts?: {
    afterPageId?: string;
    beforePageId?: string;
    capture?: CaptureMode;
}): string;
export declare function goToPage(api: ExcalidrawImperativeAPI, pageId: string, opts?: {
    coverage?: number;
}): void;
/** Rename a page (its frame). */
export declare function renamePage(api: ExcalidrawImperativeAPI, pageId: string, name: string): void;
/**
 * Delete a page and everything inside it, re-packing and renumbering the
 * survivors in the same (single) undo entry. Refuses to delete the last page.
 */
/**
 * Encuadra TODAS las páginas a la vez.
 *
 * El editor legacy apilaba las páginas en vertical y verlas todas era el estado
 * por defecto; aquí van en fila y `goToPage` encuadra solo una, así que sin esto
 * la única forma de ver el conjunto era alejar el zoom a mano. `scrollToContent`
 * sin elemento concreto ajusta a la escena entera.
 */
export declare function fitAllPages(api: ExcalidrawImperativeAPI, opts?: {
    coverage?: number;
}): void;
/**
 * Borra una página y todo lo que contiene.
 *
 * Devuelve `false` sin tocar nada cuando es la última: un diseño sin ninguna
 * página no es representable (ni se exporta, ni tiene miniatura, ni sabe a qué
 * tamaño volver). Quien llama DEBE decir por qué no ha pasado nada — que el
 * botón se quedara mudo era la razón de que pareciera roto.
 */
export declare function deletePage(api: ExcalidrawImperativeAPI, pageId: string): boolean;
/**
 * Deja la escena en su forma canónica: adopta los marcos que hayan entrado por
 * fuera, reempaqueta la fila (x, y y marca de orden) y renumera. Un solo commit,
 * y NINGUNO cuando ya estaba bien —de ahí que las tres primitivas devuelvan la
 * misma referencia si no tocan nada—, que es lo que permite llamarla desde cada
 * cambio de escena sin llenar el historial de entradas vacías.
 *
 * `capture` por defecto es undoable; las migraciones de carga y la normalización
 * continua pasan 'never'.
 */
export declare function relayoutPages(api: ExcalidrawImperativeAPI, capture?: CaptureMode): void;
/** Whether a page (its frame) is locked. */
export declare function isPageLocked(api: ExcalidrawImperativeAPI, pageId: string): boolean;
/**
 * Lock or unlock a page — the canvas2 analogue of the clone's lockPage: the
 * frame AND every member element get the flag, so nothing on the page can be
 * moved/edited until unlocked.
 */
export declare function setPageLocked(api: ExcalidrawImperativeAPI, pageId: string, locked: boolean): void;
/**
 * Move a page one slot left (-1) or right (+1) in the strip — one undo entry.
 */
/**
 * Lleva una página a una posición concreta (arrastrar y soltar en la tira).
 *
 * `movePage` solo intercambia con la vecina, que sirve para los botones ◀ ▶
 * pero no para soltar una página cinco puestos más allá. Se apoya en las mismas
 * dos primitivas —reempaquetar y renumerar— así que el resultado es idéntico al
 * de mover de una en una, sin duplicar la lógica de layout.
 */
export declare function movePageTo(api: ExcalidrawImperativeAPI, pageId: string, targetIndex: number): void;
export declare function movePage(api: ExcalidrawImperativeAPI, pageId: string, direction: -1 | 1): void;
/**
 * Change a page's size — the canvas2 analogue of the Canva clone's resize.
 *
 * With `scaleContent` (default), members keep their RELATIVE layout: each
 * element's center is remapped proportionally into the new bounds and its size
 * (and font size) scales uniformly by min(sx, sy) — proportional reflow without
 * distorting images or text. With `scaleContent: false` content stays anchored
 * to the page's top-left corner (overflow just clips at the frame edge).
 * Pages to the right are re-packed in the SAME single undo entry.
 */
export declare function resizePage(api: ExcalidrawImperativeAPI, pageId: string, size: PageSize, opts?: {
    scaleContent?: boolean;
}): void;
/**
 * Duplicate a page and its contents, inserting the copy right AFTER the
 * source (pages to the right shift over) — one undo entry.
 *
 * Clones the frame + its member elements with fresh ids, remapping intra-page
 * references (frameId, container/binding ids, groupIds). Cross-page bindings
 * are an accepted v1 limitation.
 */
export declare function duplicatePage(api: ExcalidrawImperativeAPI, pageId: string): string | null;
//# sourceMappingURL=pages.d.ts.map