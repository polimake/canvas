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
import { newElementWith, type SceneElement } from './excal';

/**
 * Claves del estado observado por la historia que son selección o modo de
 * edición, no contenido. `name` y `viewBackgroundColor` también las observa y
 * son cambios de verdad: por eso no están.
 */
const SELECTION_KEYS = new Set([
  'selectedElementIds',
  'selectedGroupIds',
  'editingGroupId',
  'selectedLinearElementId',
  'editingLinearElementId',
  'croppingElementId',
]);

/** Lo que se lee de una entrada de la historia de Excalidraw (`HistoryEntry`). */
export interface HistoryEntryLike {
  elementsChange?: { isEmpty?: () => boolean };
  appStateChange?: { delta?: { deleted?: object; inserted?: object } };
}

/** Lo que se usa de la `History` de Excalidraw. */
export interface HistoryLike {
  undoStack: HistoryEntryLike[];
  redoStack: HistoryEntryLike[];
  undo: (elements: Map<string, SceneElement>, appState: any, snapshot: unknown) => [Map<string, SceneElement>, any] | void;
  redo: (elements: Map<string, SceneElement>, appState: any, snapshot: unknown) => [Map<string, SceneElement>, any] | void;
  onHistoryChangedEmitter?: { on: (cb: () => void) => () => void };
}

/** La parte del `App` de Excalidraw que reciben las acciones. */
export interface AppLike {
  history?: HistoryLike;
  store?: { snapshot: unknown };
  flowChartCreator?: { isCreatingChart?: boolean };
  getEffectiveGridSize?: () => number | null;
}

/** ¿La entrada solo cambia qué está seleccionado? */
export function isSelectionOnlyEntry(entry: HistoryEntryLike): boolean {
  if (!entry.elementsChange?.isEmpty?.()) return false;
  const delta = entry.appStateChange?.delta;
  if (!delta) return false;
  const keys = [...Object.keys(delta.deleted ?? {}), ...Object.keys(delta.inserted ?? {})];
  return keys.every((key) => SELECTION_KEYS.has(key));
}

/** Quita de la cima de la pila las entradas que solo son selección. */
export function dropSelectionOnlyTail(stack: HistoryEntryLike[]): number {
  let dropped = 0;
  while (stack.length && isSelectionOnlyEntry(stack[stack.length - 1])) {
    stack.pop();
    dropped++;
  }
  return dropped;
}

/** ¿Queda en la pila algo que deshacer de verdad? Para apagar el botón. */
export function hasRealEntry(stack: readonly HistoryEntryLike[] | undefined): boolean {
  return !!stack?.some((entry) => !isSelectionOnlyEntry(entry));
}

/**
 * Lo mismo que comprueba el `executeHistoryAction` de Excalidraw: con un gesto
 * a medias (arrastre, texto en edición, dibujo) no se deshace nada.
 */
export function historyIsBusy(appState: any, app: AppLike | undefined): boolean {
  return !!(
    appState.multiElement ||
    appState.resizingElement ||
    appState.editingTextElement ||
    appState.newElement ||
    appState.selectedElementsAreBeingDragged ||
    appState.selectionElement ||
    app?.flowChartCreator?.isCreatingChart
  );
}

export type HistoryDirection = 'undo' | 'redo';

/**
 * Deshace o rehace el último cambio de verdad. Devuelve el resultado de acción
 * de Excalidraw sin `captureUpdate` (lo pone quien llama) o `null` si no hay
 * nada que aplicar.
 */
export function performHistory(
  direction: HistoryDirection,
  elements: readonly SceneElement[],
  appState: any,
  app: AppLike | undefined,
): { elements: SceneElement[]; appState: any } | null {
  const history = app?.history;
  const store = app?.store;
  if (!history || !store || historyIsBusy(appState, app)) return null;
  const stack = direction === 'undo' ? history.undoStack : history.redoStack;
  let map = new Map(elements.map((el) => [el.id, el] as const));
  let state = appState;
  let applied = false;
  // Un texto nuevo puede ocupar DOS entradas: si había algo seleccionado, el
  // `pointerup` del clic con la T captura la escena con el texto ya puesto y
  // aún vacío, y al cerrar el editor llega la segunda con lo escrito. Un
  // Ctrl+Z dejaba entonces un texto "" (8 px de ancho) en la página, y la
  // cadena de deshacer iba un paso por detrás desde ahí. Excalidraw nunca deja
  // vivo un texto vacío —lo borra al cerrar el editor—, así que un paso que
  // termina con uno que antes no estaba es medio paso: se aplica el siguiente.
  for (let guard = 0; guard < 4; guard++) {
    dropSelectionOnlyTail(stack);
    const result = history[direction](map, state, store.snapshot);
    if (!result) break;
    applied = true;
    const before = map;
    [map, state] = result;
    if (!leavesNewEmptyText(before, map) || !hasRealEntry(stack)) break;
  }
  if (!applied) return null;
  return { elements: Array.from(map.values()), appState: state };
}

const isEmptyLiveText = (el: SceneElement | undefined): boolean =>
  !!el && el.type === 'text' && !el.isDeleted && (el as { text?: string }).text === '';

/** ¿Hay en `after` un texto vacío y vivo que en `before` no lo era? */
export function leavesNewEmptyText(
  before: ReadonlyMap<string, SceneElement>,
  after: ReadonlyMap<string, SceneElement>,
): boolean {
  for (const [id, el] of after) {
    if (isEmptyLiveText(el) && !isEmptyLiveText(before.get(id))) return true;
  }
  return false;
}

/** Mayúsculas+flecha, como en Canva. */
export const SHIFT_NUDGE_PX = 10;

export const ARROW_OFFSETS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
} as const;
export type ArrowKey = keyof typeof ARROW_OFFSETS;

/**
 * Desplaza la selección como lo hace Excalidraw con las flechas: lo
 * seleccionado, el texto de sus contenedores y, si hay una página (marco)
 * seleccionada, lo que vive dentro. La pertenencia a la página no cambia.
 * Devuelve `null` si no hay nada seleccionado.
 */
export function nudgeSelection(
  elements: readonly SceneElement[],
  selectedElementIds: Readonly<Record<string, boolean>>,
  dx: number,
  dy: number,
): SceneElement[] | null {
  const selected = new Set(
    elements.filter((el) => !el.isDeleted && selectedElementIds[el.id]).map((el) => el.id),
  );
  if (!selected.size) return null;
  const frames = new Set(
    elements.filter((el) => selected.has(el.id) && (el.type === 'frame' || el.type === 'magicframe')).map((el) => el.id),
  );
  const moves = (el: SceneElement): boolean => {
    if (el.isDeleted) return false;
    if (selected.has(el.id)) return true;
    const containerId = (el as { containerId?: string | null }).containerId;
    if (containerId && selected.has(containerId)) return true;
    return !!el.frameId && frames.has(el.frameId);
  };
  return elements.map((el) => (moves(el) ? (newElementWith(el, { x: el.x + dx, y: el.y + dy } as never) as SceneElement) : el));
}
