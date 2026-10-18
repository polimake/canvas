import { type ExcalidrawImperativeAPI } from '../../core/excal';
type Action = Parameters<ExcalidrawImperativeAPI['registerAction']>[0];
export declare const isUndoKey: (e: KeyboardEvent) => boolean;
export declare const isRedoKey: (e: KeyboardEvent) => boolean;
/** Las acciones que registra el lienzo, en el orden en que se registran. */
export declare function canvaGestureActions(): Action[];
/**
 * Registra los gestos. Tiene que ir DESPUÉS de que Excalidraw registre los
 * suyos: el `excalidrawAPI` se entrega dentro de su constructor, antes de que
 * registre `undo` y `redo`, así que registrarlos ahí los dejaría pisados. Por
 * eso Canvas2 lo llama desde un efecto.
 */
export declare function installCanvaGestures(api: Pick<ExcalidrawImperativeAPI, 'registerAction'>): void;
export {};
//# sourceMappingURL=canvaGestures.d.ts.map