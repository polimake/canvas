import { restore, serializeAsJSON, type ExcalidrawImperativeAPI } from './excal';
import type { Canvas2Scene } from './Canvas2';

/**
 * Scene ↔ JSON persistence — the canvas2 analogue of polimake-canvas's
 * `serialize()` / minified `editorConfig`. We store Excalidraw's own canonical
 * JSON (via `serializeAsJSON`) rather than translating into a foreign layer
 * tree, so a saved scene round-trips losslessly.
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

/** Una escena tal y como sale del ALMACÉN: un `.excalidraw`, un `editorConfig`. */
export interface StoredScene {
  elements?: unknown;
  appState?: unknown;
  files?: unknown;
}

/**
 * Deja una escena guardada lista para montar o dibujar. Úsalo SIEMPRE al abrir
 * algo que venga de fuera del editor.
 *
 * El motivo es el ancho de los textos. Un `text` guarda su `width`/`height` en
 * el fichero, y al cargar por `initialData` Excalidraw los usa TAL CUAL: no
 * remide nada. Si esas medidas no son las que da la fuente real —porque el
 * fichero se generó fuera del editor, o se guardó con otra tipografía— la línea
 * se dibuja recortada por el borde de su propia caja. Al hacer doble clic el
 * editor entra en modo texto, remide y la caja se corrige sola: ESE es el
 * "se arregla al hacer doble clic".
 *
 * `restore` con `refreshDimensions` hace esa misma medición para todos los
 * textos de golpe, al abrir. `repairBindings` va obligado: sin él
 * `restoreElements` ni siquiera entra en el bucle que remide.
 *
 * Se conserva el `appState` ORIGINAL en vez del que devuelve `restore`: aquí
 * solo se corrige la geometría, y el appState completo de Excalidraw (cámara,
 * selección, tema) pisaría lo que el editor ya ha decidido.
 *
 * Ojo: mide con las fuentes CARGADAS en ese momento. Quien llame desde el
 * navegador debería esperar a `document.fonts.ready` antes, o volverá a medir
 * con la tipografía de respaldo.
 */
export function restoreScene(scene: StoredScene): Canvas2Scene {
  const restored = restore(
    {
      elements: (Array.isArray(scene.elements) ? scene.elements : []) as never,
      appState: (scene.appState ?? {}) as never,
      files: (scene.files ?? {}) as never,
    },
    null,
    null,
    { refreshDimensions: true, repairBindings: true },
  );

  return {
    elements: restored.elements as Canvas2Scene['elements'],
    appState: (scene.appState ?? {}) as Canvas2Scene['appState'],
    files: (restored.files ?? {}) as Canvas2Scene['files'],
  };
}
