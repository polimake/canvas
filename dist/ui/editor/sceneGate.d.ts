/**
 * ¿Ha cambiado lo que se guarda de la escena desde la última vez que se dio?
 *
 * Antes se miraba solo si el array de elementos era otro: Excalidraw lo
 * mantiene en los ticks de pura vista (encuadre, zoom, selección) y así se
 * descartaban sin recorrer nada. Pero también lo mantiene cuando muta un
 * elemento EN SU SITIO: mover con las flechas es `mutateElement` +
 * `scene.triggerUpdate()`, sin array nuevo. Ese cambio no salía nunca hacia el
 * host, y salir o recargar justo después lo perdía (el banco del lienzo,
 * parte 1: «salir-a-mitad» y «recargar»).
 *
 * `mutateElement` sube siempre `version` y `versionNonce`, así que una huella
 * de las versiones distingue lo uno de lo otro. Recorrerla es O(n) por tick,
 * nada al lado de lo que hace Excalidraw en cada uno.
 */
export interface SceneGateState {
    elements: unknown;
    versions: number | null;
    bg: unknown;
}
export declare const emptySceneGate: () => SceneGateState;
/** La huella de las versiones, en orden: cambia con cualquier mutación de un elemento. */
export declare function hashVersions(elements: readonly {
    version?: number;
    versionNonce?: number;
}[]): number;
/**
 * Devuelve el estado nuevo si hay algo que dar al host, o `null` si el tick es
 * solo de vista (mismo array, mismas versiones y mismo fondo).
 */
export declare function sceneChange(previous: SceneGateState, elements: readonly {
    version?: number;
    versionNonce?: number;
}[], bg: unknown): SceneGateState | null;
//# sourceMappingURL=sceneGate.d.ts.map