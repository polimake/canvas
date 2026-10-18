/**
 * Gestos de teclado como los de Canva, encima de la historia y el teclado de
 * Excalidraw.
 *
 * Deshacer. Desde la 0.17 Excalidraw guarda la selección en la historia: cada
 * clic que selecciona algo deja una entrada propia, así que «seleccionar y
 * Ctrl+Z» solo deselecciona y hacen falta dos pulsaciones para deshacer el
 * cambio de verdad. En Canva seleccionar no es un paso. Aquí se reconoce la
 * entrada que solo toca la selección (ningún elemento cambia y el estado que
 * cambia es solo de selección) y se descarta antes de deshacer o rehacer; las
 * que mezclan selección con un cambio real se quedan enteras, y con ellas la
 * selección de antes del cambio.
 *
 * No se puede filtrar al grabar: la historia y el `store` de Excalidraw no
 * salen por su API imperativa. Sí le llegan a una acción en `perform(…, app)`,
 * que es por donde lo hace su propio «undo». Por eso esto son acciones que
 * sustituyen por nombre a `undo` y `redo` (ver ui/editor/canvaGestures.tsx).
 *
 * Mayúsculas+flecha. Excalidraw mueve 5 px; Canva, 10. Las flechas solas no se
 * tocan (1 px), ni el paso de la cuadrícula cuando está puesta.
 */
import { type SceneElement } from './excal';
/** Lo que se lee de una entrada de la historia de Excalidraw (`HistoryEntry`). */
export interface HistoryEntryLike {
    elementsChange?: {
        isEmpty?: () => boolean;
    };
    appStateChange?: {
        delta?: {
            deleted?: object;
            inserted?: object;
        };
    };
}
/** Lo que se usa de la `History` de Excalidraw. */
export interface HistoryLike {
    undoStack: HistoryEntryLike[];
    redoStack: HistoryEntryLike[];
    undo: (elements: Map<string, SceneElement>, appState: any, snapshot: unknown) => [Map<string, SceneElement>, any] | void;
    redo: (elements: Map<string, SceneElement>, appState: any, snapshot: unknown) => [Map<string, SceneElement>, any] | void;
    onHistoryChangedEmitter?: {
        on: (cb: () => void) => () => void;
    };
}
/** La parte del `App` de Excalidraw que reciben las acciones. */
export interface AppLike {
    history?: HistoryLike;
    store?: {
        snapshot: unknown;
    };
    flowChartCreator?: {
        isCreatingChart?: boolean;
    };
    getEffectiveGridSize?: () => number | null;
}
/** ¿La entrada solo cambia qué está seleccionado? */
export declare function isSelectionOnlyEntry(entry: HistoryEntryLike): boolean;
/** Quita de la cima de la pila las entradas que solo son selección. */
export declare function dropSelectionOnlyTail(stack: HistoryEntryLike[]): number;
/** ¿Queda en la pila algo que deshacer de verdad? Para apagar el botón. */
export declare function hasRealEntry(stack: readonly HistoryEntryLike[] | undefined): boolean;
/**
 * Lo mismo que comprueba el `executeHistoryAction` de Excalidraw: con un gesto
 * a medias (arrastre, texto en edición, dibujo) no se deshace nada.
 */
export declare function historyIsBusy(appState: any, app: AppLike | undefined): boolean;
export type HistoryDirection = 'undo' | 'redo';
/**
 * Deshace o rehace el último cambio de verdad. Devuelve el resultado de acción
 * de Excalidraw sin `captureUpdate` (lo pone quien llama) o `null` si no hay
 * nada que aplicar.
 */
export declare function performHistory(direction: HistoryDirection, elements: readonly SceneElement[], appState: any, app: AppLike | undefined): {
    elements: SceneElement[];
    appState: any;
} | null;
/** Mayúsculas+flecha, como en Canva. */
export declare const SHIFT_NUDGE_PX = 10;
export declare const ARROW_OFFSETS: {
    readonly ArrowLeft: readonly [-1, 0];
    readonly ArrowRight: readonly [1, 0];
    readonly ArrowUp: readonly [0, -1];
    readonly ArrowDown: readonly [0, 1];
};
export type ArrowKey = keyof typeof ARROW_OFFSETS;
/**
 * Desplaza la selección como lo hace Excalidraw con las flechas: lo
 * seleccionado, el texto de sus contenedores y, si hay una página (marco)
 * seleccionada, lo que vive dentro. La pertenencia a la página no cambia.
 * Devuelve `null` si no hay nada seleccionado.
 */
export declare function nudgeSelection(elements: readonly SceneElement[], selectedElementIds: Readonly<Record<string, boolean>>, dx: number, dy: number): SceneElement[] | null;
//# sourceMappingURL=gestures.d.ts.map