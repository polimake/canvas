import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
/**
 * Reorder a page's member elements within a caller-owned elements array.
 * `orderedMemberIdsBottomFirst` lists the members from lowest stack position
 * (back) to highest (front). Unknown ids are ignored; any member omitted from
 * the list is appended in its existing order so nothing is dropped. Returns the
 * new global array for `updateScene` (does NOT apply it).
 *
 * El papel de la página se hunde al fondo SIEMPRE, lo nombre o no el llamante,
 * y lo nombre donde lo nombre (ver `floorFirst`).
 */
export declare function reorderMembersInArray(els: readonly SceneElement[], pageId: string, orderedMemberIdsBottomFirst: string[]): readonly SceneElement[];
/** Same as {@link reorderMembersInArray} but reads the live scene from the api. */
export declare function reorderPageMembers(api: ExcalidrawImperativeAPI, pageId: string, orderedMemberIdsBottomFirst: string[]): readonly SceneElement[];
/**
 * Move one member to the back of its page — al fondo del CONTENIDO, que es
 * justo encima del papel: por debajo de él no hay "fondo", hay invisibilidad.
 */
export declare function sendMemberToBack(api: ExcalidrawImperativeAPI, elementId: string, pageId: string): readonly SceneElement[];
//# sourceMappingURL=zorder.d.ts.map