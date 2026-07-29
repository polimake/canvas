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
export function reorderMembersInArray(
  els: readonly SceneElement[],
  pageId: string,
  orderedMemberIdsBottomFirst: string[],
): readonly SceneElement[] {
  const memberSlots: number[] = [];
  const byId = new Map<string, SceneElement>();
  els.forEach((e, i) => {
    if (e.frameId === pageId) {
      memberSlots.push(i);
      byId.set(e.id, e);
    }
  });
  if (memberSlots.length === 0) return els;

  const ordered: SceneElement[] = [];
  const seen = new Set<string>();
  for (const id of orderedMemberIdsBottomFirst) {
    const e = byId.get(id);
    if (e && !seen.has(id)) {
      ordered.push(e);
      seen.add(id);
    }
  }
  // Append any member not mentioned, preserving its current relative order.
  for (const slot of memberSlots) {
    const e = els[slot];
    if (!seen.has(e.id)) {
      ordered.push(e);
      seen.add(e.id);
    }
  }

  const next = els.slice();
  memberSlots.forEach((slot, k) => {
    next[slot] = ordered[k];
  });
  return next;
}

/** Same as {@link reorderMembersInArray} but reads the live scene from the api. */
export function reorderPageMembers(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  orderedMemberIdsBottomFirst: string[],
): readonly SceneElement[] {
  return reorderMembersInArray(
    api.getSceneElements(),
    pageId,
    orderedMemberIdsBottomFirst,
  );
}

/** Move one member to the back (lowest stack position) of its page. */
export function sendMemberToBack(
  api: ExcalidrawImperativeAPI,
  elementId: string,
  pageId: string,
): readonly SceneElement[] {
  const currentBottomFirst = api
    .getSceneElements()
    .filter((e) => e.frameId === pageId)
    .map((e) => e.id);
  const ordered = [elementId, ...currentBottomFirst.filter((id) => id !== elementId)];
  return reorderPageMembers(api, pageId, ordered);
}
