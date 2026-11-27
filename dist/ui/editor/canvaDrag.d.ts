import { type ExcalidrawImperativeAPI, type SceneElement } from '../../core/excal';
/** Ancho, en px de pantalla, de la franja del borde que desplaza la vista. */
export declare const EDGE_ZONE_PX = 48;
/** Velocidad en el mismo borde (o fuera), en px de pantalla por ms: ~15 por fotograma. */
export declare const EDGE_MAX_SPEED = 0.9;
/**
 * Lo que hay que quedarse en el borde antes de que la vista corra: pasar por él
 * de camino (a la tira, a otra página) no la mueve.
 */
export declare const EDGE_DELAY_MS = 150;
/** Lo que se usa de `pointerDownState` (el tipo de Excalidraw es más ancho). */
export interface DragState {
    origin: {
        x: number;
        y: number;
    };
    drag: {
        hasOccurred: boolean;
    };
    resize: {
        isResizing: boolean;
    };
    eventListeners: {
        onMove: null | {
            cancel?: () => void;
        };
        onUp: null | ((event: PointerEvent) => void);
    };
}
type Api = ExcalidrawImperativeAPI;
type El = SceneElement & Record<string, unknown>;
/** Copia de la escena que sobrevive a `mutateElement`, que cambia los elementos en el sitio. */
export declare function snapshotElements(elements: readonly SceneElement[]): El[];
/**
 * La escena de `snapshot` sobre la de ahora: lo que cambió vuelve como estaba
 * (con la versión por delante, para que nadie lo tome por viejo) y lo que nació
 * en el gesto (Alt+arrastrar duplica) se va. Lo que no cambió se queda tal cual,
 * mismo objeto. Devuelve null si no hay nada que devolver.
 */
export declare function restoreElements(current: readonly SceneElement[], snapshot: readonly El[]): SceneElement[] | null;
/**
 * Velocidad de desplazamiento para un puntero en `p` dentro de la vista `box`,
 * en px de pantalla por ms, en cada eje (positivo: hacia la derecha o abajo).
 */
export declare function edgeVelocity(p: {
    x: number;
    y: number;
}, box: {
    left: number;
    top: number;
    width: number;
    height: number;
}, zone?: number, max?: number): {
    vx: number;
    vy: number;
};
export declare function installCanvaDrag(api: Api, win?: Window): () => void;
export {};
//# sourceMappingURL=canvaDrag.d.ts.map