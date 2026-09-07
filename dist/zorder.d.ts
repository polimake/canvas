import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
/**
 * Z-order primitives, shared by the LayersPanel (drag reorder) and image ops
 * (send-to-back).
 *
 * Excalidraw stores z-order as a fractional `index` per element, but
 * `updateScene({elements})` runs `syncInvalidIndices` internally, which
 * re-derives those indices from the ARRAY ORDER of the elements you pass. So we
 * never touch `index` directly — we reorder the elements array and hand it to
 * `updateScene`. Later in the array == higher in the stack.
 *
 * Reordering operates on the GLOBAL array (indices are global), but only ever
 * rewrites the slots occupied by one page's members, leaving every other page /
 * frame untouched.
 */
/**
 * Reorder a page's member elements within a caller-owned elements array.
 * `orderedMemberIdsBottomFirst` lists the members from lowest stack position
 * (back) to highest (front). Unknown ids are ignored; any member omitted from
 * the list is appended in its existing order so nothing is dropped. Returns the
 * new global array for `updateScene` (does NOT apply it).
 */
export declare function reorderMembersInArray(els: readonly SceneElement[], pageId: string, orderedMemberIdsBottomFirst: string[]): readonly SceneElement[];
/** Same as {@link reorderMembersInArray} but reads the live scene from the api. */
export declare function reorderPageMembers(api: ExcalidrawImperativeAPI, pageId: string, orderedMemberIdsBottomFirst: string[]): readonly SceneElement[];
/** Move one member to the back (lowest stack position) of its page. */
export declare function sendMemberToBack(api: ExcalidrawImperativeAPI, elementId: string, pageId: string): readonly SceneElement[];
//# sourceMappingURL=zorder.d.ts.map