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
/** Commit an elements array (optionally with appState) to the scene. */
export declare function commitElements(api: ExcalidrawImperativeAPI, elements: readonly SceneElement[], capture?: CaptureMode, appState?: Record<string, unknown>): void;
//# sourceMappingURL=mutate.d.ts.map