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

export const emptySceneGate = (): SceneGateState => ({ elements: null, versions: null, bg: null });

/** La huella de las versiones, en orden: cambia con cualquier mutación de un elemento. */
export function hashVersions(
  elements: readonly { version?: number; versionNonce?: number }[],
): number {
  let hash = 5381;
  for (const e of elements) {
    hash = ((hash << 5) + hash + (e.version ?? 0)) | 0;
    hash = ((hash << 5) + hash + (e.versionNonce ?? 0)) | 0;
  }
  return hash >>> 0;
}

/**
 * Devuelve el estado nuevo si hay algo que dar al host, o `null` si el tick es
 * solo de vista (mismo array, mismas versiones y mismo fondo).
 */
export function sceneChange(
  previous: SceneGateState,
  elements: readonly { version?: number; versionNonce?: number }[],
  bg: unknown,
): SceneGateState | null {
  const versions = hashVersions(elements);
  if (elements === previous.elements && versions === previous.versions && bg === previous.bg) {
    return null;
  }
  return { elements, versions, bg };
}
