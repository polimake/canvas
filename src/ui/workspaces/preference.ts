import type { CanvasWorkspace } from './types';

// A new default must not inherit the old automatically persisted "design".
export const WORKSPACE_STORAGE_KEY = 'pm-canvas-workspace-v2';

export function readWorkspace(fallback: CanvasWorkspace = 'excalidraw'): CanvasWorkspace {
  try {
    const saved = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (saved === 'excalidraw' || saved === 'design' || saved === 'advanced') return saved;
  } catch { /* Storage can be unavailable in an embedded editor. */ }
  return fallback;
}

export function saveWorkspace(workspace: CanvasWorkspace): void {
  try { localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace); }
  catch { /* The choice still works for the current session. */ }
}
