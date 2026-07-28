/**
 * THE ONLY module allowed to import from `@excalidraw/excalidraw`.
 *
 * Everything else in this package imports Excalidraw values/types from here,
 * so an Excalidraw upgrade (breaking or not) is absorbed in exactly one file:
 * bump the dependency, fix this adapter until `pnpm typecheck` is green, done.
 * A unit test (`__tests__/decoupling.test.ts`) fails the build if any other
 * source file imports `@excalidraw/*` directly.
 *
 * It also gives the rest of the package canonical scene-element type aliases
 * (derived from the imperative API, not from deep type paths) and lets node
 * tests mock the entire Excalidraw surface by mocking this one module.
 */

// Editor stylesheet (side effect) — lives here so the import rule stays "only
// this file mentions @excalidraw/*".
import '@excalidraw/excalidraw/index.css';

// ─── Values ───────────────────────────────────────────────────────────────────
export {
  Excalidraw,
  CaptureUpdateAction,
  convertToExcalidrawElements,
  exportToBlob,
  exportToCanvas,
  exportToSvg,
  serializeAsJSON,
} from '@excalidraw/excalidraw';

// ─── Types (public entry) ─────────────────────────────────────────────────────
export type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { convertToExcalidrawElements as ConvertFn } from '@excalidraw/excalidraw';

// ─── Canonical derived aliases (single source for the whole package) ──────────
/** One element as returned by the live scene. */
export type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElements']>[number];
/** The elements array accepted by `updateScene`. */
export type SceneElements = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['elements'];
/** A frame element (our "page"). */
export type FrameElement = Extract<SceneElement, { type: 'frame' }>;
/** The skeleton array accepted by `convertToExcalidrawElements`. */
export type ElementSkeletons = Parameters<typeof ConvertFn>[0];
