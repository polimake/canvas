// Shared test doubles. The adapter (src/excal.ts) is mocked per test file via
// vi.mock — the real @excalidraw/excalidraw touches `window` at import time and
// cannot load under node, which is exactly why the adapter exists.
import { vi } from 'vitest';

export const excalMock = {
  CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY', EVENTUALLY: 'EVENTUALLY', NEVER: 'NEVER' },
  // Skeleton passthrough: gives converted elements the same observable fields
  // our modules rely on (id, geometry, type, frameId defaults).
  convertToExcalidrawElements: (skeletons: any[], _opts?: unknown) =>
    skeletons.map((s, i) => ({
      locked: false,
      frameId: null,
      opacity: 100,
      version: 0,
      id: s.id ?? `gen_${i}_${Math.random().toString(36).slice(2, 8)}`,
      width: s.width ?? 100,
      height: s.height ?? 24,
      ...s,
    })),
  // Mirror of Excalidraw's immutable patch: same-reference on no-op, version
  // bump + fresh nonce on change (what the history store diffs by).
  newElementWith: (el: any, updates: Record<string, unknown>) => {
    let changed = false;
    for (const key of Object.keys(updates)) {
      if (el[key] !== updates[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return el;
    return {
      ...el,
      ...updates,
      version: (el.version ?? 0) + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: 1,
    };
  },
  getNonDeletedElements: (els: any[]) => els.filter((e) => !e.isDeleted),
  getVisibleSceneBounds: () => [0, 0, 1000, 1000] as const,
  Excalidraw: () => null,
  exportToBlob: vi.fn(),
  exportToCanvas: vi.fn(),
  exportToSvg: vi.fn(),
  serializeAsJSON: vi.fn(),
};

export interface Commit {
  elements?: any[];
  appState?: Record<string, any>;
  captureUpdate?: string;
}

export interface FakeApi {
  api: any;
  get: () => any[];
  /** Every updateScene payload, in order — for single-undo-entry assertions. */
  commits: Commit[];
  setSelected: (ids: string[]) => void;
}

export function fakeApi(initial: any[]): FakeApi {
  let elements = initial;
  let appState: Record<string, any> = { selectedElementIds: {}, viewBackgroundColor: '#ffffff' };
  const commits: Commit[] = [];
  const api = {
    getSceneElements: () => elements,
    getAppState: () => appState,
    updateScene: (payload: Commit) => {
      commits.push(payload);
      if (payload.elements) elements = payload.elements;
      if (payload.appState) appState = { ...appState, ...payload.appState };
    },
    addFiles: () => {},
    onChange: () => () => {},
    onScrollChange: () => () => {},
    scrollToContent: () => {},
  };
  return {
    api,
    get: () => elements,
    commits,
    setSelected: (ids: string[]) => {
      appState.selectedElementIds = Object.fromEntries(ids.map((id) => [id, true]));
    },
  };
}

export function frame(id: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) {
  return { id, type: 'frame', x, y, width, height, frameId: null, locked: false, version: 0, name: extra.name ?? id, ...extra };
}

export function member(id: string, frameId: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) {
  return { id, type: 'rectangle', x, y, width, height, frameId, locked: false, opacity: 100, version: 0, ...extra };
}
