import { type ExcalidrawImperativeAPI, type SceneElement, type SceneElements } from './excal';
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
/**
 * Immutable element patch that Excalidraw's history can actually see.
 * `newElementWith` returns the SAME reference when every updated value is
 * `===`-equal, which keeps no-op maps cheap.
 */
export declare function patchElement<T extends SceneElement>(element: T, updates: Partial<T>): T;
/**
 * THE one place a plain element array becomes Excalidraw's `elements` payload
 * type. Everywhere else works in `readonly SceneElement[]` — the decoupling
 * guard fails the suite if `as SceneElements` casts appear outside this file.
 */
export declare function asSceneElements(elements: readonly SceneElement[]): SceneElements;
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
export declare function detachMoved(current: readonly SceneElement[], next: readonly SceneElement[]): readonly SceneElement[];
/**
 * Lo borrado se queda en la escena, en su sitio.
 *
 * Las operaciones del lienzo arman la escena nueva desde `getSceneElements()`,
 * que solo trae lo vivo. Sin lo borrado en la lista, `updateScene` lo quita de
 * verdad, y al deshacer ese borrado Excalidraw lo saca de su copia y lo
 * recoloca por índice: con dos que vuelven a la vez, el primero toma un índice
 * nuevo y el segundo cae al otro lado (nightly del 14/11/2026,
 * `lienzo/parte-8-deshacer`, cadena 5: «Ctrl+Z nº 4 no deja el paso 8 — mismos
 * elementos en otro orden», tras duplicar una página y borrar dos textos).
 *
 * Cada borrado que falta vuelve detrás del que tenía delante en la escena; si
 * no tenía nada delante, al principio. Es el mismo objeto: no cambia de
 * versión ni de índice.
 */
export declare function keepDeleted(current: readonly SceneElement[], next: readonly SceneElement[]): readonly SceneElement[];
/** Commit an elements array (optionally with appState) to the scene. */
export declare function commitElements(api: ExcalidrawImperativeAPI, elements: readonly SceneElement[], capture?: CaptureMode, appState?: Record<string, unknown>): void;
//# sourceMappingURL=mutate.d.ts.map