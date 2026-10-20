import {
  CaptureUpdateAction,
  newElementWith,
  type ExcalidrawImperativeAPI,
  type SceneElement,
  type SceneElements,
} from './excal';

/**
 * THE single write funnel for scene elements.
 *
 * Excalidraw's undo store diffs elements by `id + versionNonce`. A plain
 * spread-patch (`{ ...el, x: 1 }`) keeps the old nonce, so the store sees no
 * change and records NO history entry — the operation becomes silently
 * non-undoable, and any future reconciliation (autosave merge, AI edits)
 * resolves against a stale version. Every element write in this package must
 * therefore go through {@link patchElement} (which delegates to Excalidraw's
 * own `newElementWith` — version+1, fresh nonce, updated timestamp) and land
 * via {@link commitElements}. A structural test (decoupling.test.ts) fails the
 * suite if `as SceneElements` casts or spread-patches reappear elsewhere.
 */

/** How a commit interacts with undo history. */
export type CaptureMode = 'undoable' | 'transient' | 'never';

const CAPTURE: Record<CaptureMode, (typeof CaptureUpdateAction)[keyof typeof CaptureUpdateAction]> = {
  // One undo entry, immediately.
  undoable: CaptureUpdateAction.IMMEDIATELY,
  // Folded into the NEXT undoable capture (live previews, e.g. color drag).
  transient: CaptureUpdateAction.EVENTUALLY,
  // Invisible to history (load-time migrations) — does not advance the
  // snapshot, so it can never be "undone into".
  never: CaptureUpdateAction.NEVER,
};

/**
 * Immutable element patch that Excalidraw's history can actually see.
 * `newElementWith` returns the SAME reference when every updated value is
 * `===`-equal, which keeps no-op maps cheap.
 */
export function patchElement<T extends SceneElement>(element: T, updates: Partial<T>): T {
  return newElementWith(element, updates as Parameters<typeof newElementWith>[1]) as T;
}

type UpdateScenePayload = Parameters<ExcalidrawImperativeAPI['updateScene']>[0];

/**
 * THE one place a plain element array becomes Excalidraw's `elements` payload
 * type. Everywhere else works in `readonly SceneElement[]` — the decoupling
 * guard fails the suite if `as SceneElements` casts appear outside this file.
 */
export function asSceneElements(elements: readonly SceneElement[]): SceneElements {
  return elements as SceneElements;
}

/**
 * Lo que cambia de sitio en el array, como copia y no como el objeto de la
 * escena.
 *
 * `updateScene` reparte índices fraccionarios nuevos a lo que ha cambiado de
 * sitio (`syncInvalidIndices`) MUTANDO el objeto: versión +1 en el sitio. Si
 * ese objeto es el mismo que tiene la escena, la escena "sube" de versión sin
 * pasar por el `store`, y el `store` de Excalidraw entiende que es un cambio
 * del usuario a medias (`filterUncomittedElements`): no lo graba en este
 * commit. El nuevo orden se colaba entonces en la SIGUIENTE entrada del
 * historial —la de un clic cualquiera— como un paso que solo cambia índices:
 * un Ctrl+Z que no hacía nada a la vista (banco del lienzo: «Ctrl+Z necesita 2
 * pulsaciones») y, en un commit que sí se graba (traer al frente), un deshacer
 * que no devolvía el orden.
 *
 * Con una copia, la mutación cae en la copia: la escena conserva su versión y
 * el `store` ve el cambio entero, y lo graba —o lo da por bueno, con
 * `'never'`— en el commit que toca.
 */
export function detachMoved(
  current: readonly SceneElement[],
  next: readonly SceneElement[],
): readonly SceneElement[] {
  // El tramo que cambia de orden: lo que está en las dos listas, comparado en
  // el orden de cada una. Fuera del tramo el orden (y por tanto el índice) es
  // el de antes y Excalidraw no lo toca; dentro, puede tocar cualquiera.
  const inNext = new Set(next.map((el) => el.id));
  const inCurrent = new Set(current.map((el) => el.id));
  const before = current.filter((el) => inNext.has(el.id)).map((el) => el.id);
  const after = next.filter((el) => inCurrent.has(el.id)).map((el) => el.id);
  let lo = 0;
  while (lo < after.length && after[lo] === before[lo]) lo++;
  let hi = after.length - 1;
  while (hi > lo && after[hi] === before[hi]) hi--;
  const moved = new Set(lo < after.length ? after.slice(lo, hi + 1) : []);
  const live = new Set(current);
  let out: SceneElement[] | null = null;
  for (let i = 0; i < next.length; i++) {
    const el = next[i];
    if (!live.has(el)) continue;
    if (!moved.has(el.id)) continue;
    out ??= next.slice();
    out[i] = { ...el } as SceneElement;
  }
  return out ?? next;
}

/** Commit an elements array (optionally with appState) to the scene. */
export function commitElements(
  api: ExcalidrawImperativeAPI,
  elements: readonly SceneElement[],
  capture: CaptureMode = 'undoable',
  appState?: Record<string, unknown>,
): void {
  api.updateScene({
    elements: asSceneElements(detachMoved(api.getSceneElementsIncludingDeleted?.() ?? api.getSceneElements(), elements)),
    ...(appState ? { appState: appState as UpdateScenePayload['appState'] } : {}),
    captureUpdate: CAPTURE[capture],
  });
}
