import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
import type { FileEntry } from './media';
import type { CustomFontFace } from './fonts';
import { extractComponentFragment, type ComponentFragment, type SlotValues } from './components';
/**
 * Inserta un componente como página nueva tras `afterPageId` (por defecto, la
 * última página) y navega hasta ella. Un solo commit = una sola entrada de
 * deshacer, la regla de todas las operaciones compuestas de pages.ts.
 *
 * Devuelve las tipografías del componente: persistirlas es tarea del HOST
 * (`editorConfig.fonts` es suyo) — aquí no hay dónde guardarlas y callárselas
 * significaría reabrir el diseño con la fuente de respaldo.
 */
export declare function insertComponentIntoScene(api: ExcalidrawImperativeAPI, fragment: ComponentFragment, { afterPageId, slots }?: {
    afterPageId?: string | null;
    slots?: SlotValues;
}): {
    pageId: string;
    fonts: CustomFontFace[];
    unknownSlots: string[];
};
/**
 * Extrae la página activa de la escena viva con la MISMA forma de `editorConfig`
 * que guarda `useCanvas2Save` — es lo que "Guardar página como componente"
 * envía a `POST /api/designs`. Los ficheros pasan por `buildPersistableFiles`:
 * si queda base64 (una imagen pegada aún sin externalizar), se devuelve en
 * `inline` para que el host CIERRE EL PASO en vez de guardar bytes en la fila.
 */
export declare function extractPageForComponent(api: ExcalidrawImperativeAPI, pageId: string, { fonts }?: {
    fonts?: readonly CustomFontFace[];
}): {
    editorConfig: {
        elements: SceneElement[];
        appState: {
            viewBackgroundColor?: string;
        };
        files: Record<string, FileEntry>;
        fonts?: CustomFontFace[];
    };
    inline: string[];
} | null;
export { extractComponentFragment };
//# sourceMappingURL=insertComponent.d.ts.map