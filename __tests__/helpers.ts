// Shared test doubles. The adapter (src/excal.ts) is mocked per test file via
// vi.mock — the real @excalidraw/excalidraw touches `window` at import time and
// cannot load under node, which is exactly why the adapter exists.
import { vi } from 'vitest';

export const excalMock = {
  CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY', NEVER: 'NEVER' },
  // Skeleton passthrough: gives converted elements the same observable fields
  // our modules rely on (id, geometry, type, frameId defaults).
  convertToExcalidrawElements: (skeletons: any[], _opts?: unknown) =>
    skeletons.map((s, i) => ({
      locked: false,
      frameId: null,
      opacity: 100,
      id: s.id ?? `gen_${i}_${Math.random().toString(36).slice(2, 8)}`,
      width: s.width ?? 100,
      height: s.height ?? 24,
      ...s,
    })),
  Excalidraw: () => null,
  exportToBlob: vi.fn(),
  exportToCanvas: vi.fn(),
  exportToSvg: vi.fn(),
  serializeAsJSON: vi.fn(),
};

export interface FakeApi {
  api: any;
  get: () => any[];
  setSelected: (ids: string[]) => void;
}

export function fakeApi(initial: any[]): FakeApi {
  let elements = initial;
  let appState: Record<string, any> = { selectedElementIds: {}, viewBackgroundColor: '#ffffff' };
  const api = {
    getSceneElements: () => elements,
    getAppState: () => appState,
    updateScene: (payload: { elements?: any[]; appState?: Record<string, any> }) => {
      if (payload.elements) elements = payload.elements;
      if (payload.appState) appState = { ...appState, ...payload.appState };
    },
    addFiles: () => {},
    onChange: () => () => {},
    scrollToContent: () => {},
  };
  return {
    api,
    get: () => elements,
    setSelected: (ids: string[]) => {
      appState.selectedElementIds = Object.fromEntries(ids.map((id) => [id, true]));
    },
  };
}

export function frame(id: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) {
  return { id, type: 'frame', x, y, width, height, frameId: null, locked: false, name: extra.name ?? id, ...extra };
}

export function member(id: string, frameId: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) {
  return { id, type: 'rectangle', x, y, width, height, frameId, locked: false, opacity: 100, ...extra };
}
