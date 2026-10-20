import type { SceneElement } from './excal';
/**
 * ¿Hay que soltar la selección antes de este clic? Devuelve el id de lo que
 * está encima, o `null` si Excalidraw ya hace lo que toca.
 */
export declare function pickOverSelection(elements: readonly SceneElement[], selectedElementIds: Readonly<Record<string, boolean>>, point: {
    x: number;
    y: number;
}, zoom: number): string | null;
//# sourceMappingURL=pick.d.ts.map