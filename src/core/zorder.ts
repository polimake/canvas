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
 *
 * REGLA DURA DEL MODELO: el papel de la página (`pageBackground`) es el suelo.
 * Va SIEMPRE el primero de sus miembros y el contenido siempre encima. El marco
 * no pinta nada —el editor le apaga el contorno—, así que el único que puede
 * esconder algo es el papel, que es opaco. Aquí se hace cumplir de oficio: ver
 * `floorFirst`.
 */

/**
 * El marcador del papel de página, duplicado a propósito de `background.ts`.
 *
 * Importarlo de allí crearía un ciclo (background.ts ya importa este módulo), y
 * este módulo es la capa de abajo: no debe depender de nadie. Son dos líneas de
 * verdad duplicada que `zorder.paper.test.ts` ata a la función real.
 */
const BG_MARKER = 'pageBackground';

function isPaper(el: SceneElement): boolean {
  return (el.customData as { c2?: string } | undefined)?.c2 === BG_MARKER;
}

/**
 * Pone el papel de la página el PRIMERO de una lista bottom-first, venga o no
 * nombrado por quien llama.
 *
 * El panel de capas no lista el papel (lo filtra `isPageBackground`), así que
 * reordenar "solo las capas visibles" lo dejaba fuera de la lista — y omitir un
 * miembro lo SUBE al frente, dejando la página tapada por su propio fondo. La
 * otra mitad del mismo fallo es nombrarlo sin más: `fitToPage` mandaba una
 * imagen "al fondo" POR DEBAJO del papel opaco, es decir, a la invisibilidad.
 *
 * Que la regla la aplique el reordenador y no cada llamante es justamente el
 * punto: no se puede olvidar.
 */
function floorFirst(
  members: readonly SceneElement[],
  orderedBottomFirst: readonly string[],
): string[] {
  const paperIds = members.filter(isPaper).map((e) => e.id);
  if (paperIds.length === 0) return [...orderedBottomFirst];
  const paper = new Set(paperIds);
  return [...paperIds, ...orderedBottomFirst.filter((id) => !paper.has(id))];
}

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

  const bottomFirst = floorFirst(
    memberSlots.map((slot) => els[slot]),
    orderedMemberIdsBottomFirst,
  );

  const ordered: SceneElement[] = [];
  const seen = new Set<string>();
  for (const id of bottomFirst) {
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

/**
 * Move one member to the back of its page — al fondo del CONTENIDO, que es
 * justo encima del papel: por debajo de él no hay "fondo", hay invisibilidad.
 */
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
