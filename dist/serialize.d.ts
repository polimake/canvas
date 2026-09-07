import { type ExcalidrawImperativeAPI } from './excal';
import type { Canvas2Scene } from './Canvas2';
/**
 * Scene ↔ JSON persistence. We store Excalidraw's own canonical JSON (via
 * `serializeAsJSON`) rather than translating into a layer tree of our own, so a
 * saved scene round-trips losslessly.
 */
/** Serialize the current scene to a canonical JSON string for storage. */
export declare function serializeScene(api: ExcalidrawImperativeAPI): string;
/**
 * Parse a stored JSON string back into a scene that can be fed to
 * {@link Canvas2EditorProps.initialScene}. Returns null on malformed input.
 */
export declare function parseScene(json: string): Canvas2Scene | null;
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
export declare function restoreScene(scene: StoredScene): Canvas2Scene;
//# sourceMappingURL=serialize.d.ts.map