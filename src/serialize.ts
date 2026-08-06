import { serializeAsJSON, type ExcalidrawImperativeAPI } from './excal';
import type { Canvas2Scene } from './Canvas2';

/**
 * Scene ↔ JSON persistence. We store Excalidraw's own canonical JSON (via
 * `serializeAsJSON`) rather than translating into a layer tree of our own, so a
 * saved scene round-trips losslessly.
 */

/** Serialize the current scene to a canonical JSON string for storage. */
export function serializeScene(api: ExcalidrawImperativeAPI): string {
  return serializeAsJSON(
    api.getSceneElements(),
    api.getAppState(),
    api.getFiles(),
    'local',
  );
}

/**
 * Parse a stored JSON string back into a scene that can be fed to
 * {@link Canvas2EditorProps.initialScene}. Returns null on malformed input.
 */
export function parseScene(json: string): Canvas2Scene | null {
  try {
    const data = JSON.parse(json) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') return null;
    return {
      elements: (data.elements as Canvas2Scene['elements']) ?? [],
      appState: (data.appState as Canvas2Scene['appState']) ?? {},
      files: (data.files as Canvas2Scene['files']) ?? {},
    };
  } catch {
    return null;
  }
}
