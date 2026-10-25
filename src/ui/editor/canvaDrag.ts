/**
 * Arrastrar como en Canva, por encima de lo que hace Excalidraw:
 *
 *  - **Escape a mitad de un arrastre lo cancela**: lo arrastrado (o lo que se
 *    escalaba o giraba) vuelve a donde estaba, la selección es la de antes y no
 *    queda nada en el historial. Excalidraw no lo hace: Escape no le llega al
 *    gesto, y al soltar dejaba lo movido donde estuviera.
 *  - **Llevar algo al borde de la vista la desplaza**: mientras se arrastra con
 *    el puntero cerca del borde (o fuera), la vista corre hacia ese lado, más
 *    deprisa cuanto más al borde, y lo arrastrado la sigue. Empieza tras un
 *    momento en el borde (pasar por él no la mueve) y para al soltar, al
 *    apartarse del borde o al pasar del final del diseño.
 *
 * Las dos cosas cuelgan de `api.onPointerDown`, que Excalidraw dispara dentro de
 * su `pointerdown` con el estado del gesto (`pointerDownState`), antes de
 * registrar sus manejadores de `pointermove` y `pointerup` en `window`: así los
 * de aquí corren antes que los suyos.
 *
 * Escape se oye en `window`, en captura (antes que Excalidraw y que la app), y
 * solo se queda con la tecla si de verdad hay un arrastre que cancelar. Para
 * acabar el gesto se llama al `pointerup` del propio Excalidraw con el puntero
 * en el punto donde se pulsó: decide la página de lo soltado por ese punto, y
 * así lo devuelto sigue en la suya. Todo va en un `flushSync`, para que el
 * historial vea de una vez lo de antes y lo de ahora, iguales: no hay paso.
 *
 * El desplazamiento cambia `scrollX`/`scrollY` y le reenvía a Excalidraw un
 * `pointermove` con la última posición del puntero: él recalcula el arrastre
 * con la vista nueva, como si el ratón se hubiera movido. Va con
 * `EVENTUALLY`: un `NEVER` a mitad de gesto le haría al historial una foto a
 * medias, y deshacer el arrastre dejaría lo movido a medio camino.
 */
import { flushSync } from 'react-dom';
import { CaptureUpdateAction, type ExcalidrawImperativeAPI, type SceneElement } from '../../core/excal';
import { commitElements, patchElement } from '../../core/mutate';

/** Ancho, en px de pantalla, de la franja del borde que desplaza la vista. */
export const EDGE_ZONE_PX = 48;
/** Velocidad en el mismo borde (o fuera), en px de pantalla por ms: ~15 por fotograma. */
export const EDGE_MAX_SPEED = 0.9;
/**
 * Lo que hay que quedarse en el borde antes de que la vista corra: pasar por él
 * de camino (a la tira, a otra página) no la mueve.
 */
export const EDGE_DELAY_MS = 150;
/** Un fotograma que tarda más no da un salto: cuenta como este tanto. */
const MAX_FRAME_MS = 50;

/** Lo que se usa de `pointerDownState` (el tipo de Excalidraw es más ancho). */
export interface DragState {
  origin: { x: number; y: number };
  drag: { hasOccurred: boolean };
  resize: { isResizing: boolean };
  eventListeners: {
    onMove: null | { cancel?: () => void };
    onUp: null | ((event: PointerEvent) => void);
  };
}

type Api = ExcalidrawImperativeAPI;
type El = SceneElement & Record<string, unknown>;

/** Lo que no cuenta para decir si un elemento cambió: lo pone Excalidraw en cada toque. */
const BOOKKEEPING = new Set(['version', 'versionNonce', 'updated']);

function sameElement(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (BOOKKEEPING.has(k)) continue;
    const x = a[k];
    const y = b[k];
    if (x === y) continue;
    // Puntos, enlaces, recorte…: copias distintas con lo mismo dentro.
    if (x && y && typeof x === 'object' && typeof y === 'object' && JSON.stringify(x) === JSON.stringify(y)) continue;
    return false;
  }
  return true;
}

/** Copia de la escena que sobrevive a `mutateElement`, que cambia los elementos en el sitio. */
export function snapshotElements(elements: readonly SceneElement[]): El[] {
  return elements.map((e) => {
    const copy = { ...(e as El) };
    const points = (e as { points?: unknown }).points;
    if (Array.isArray(points)) copy.points = points.map((p) => (Array.isArray(p) ? [...p] : p));
    return copy as El;
  });
}

/**
 * La escena de `snapshot` sobre la de ahora: lo que cambió vuelve como estaba
 * (con la versión por delante, para que nadie lo tome por viejo) y lo que nació
 * en el gesto (Alt+arrastrar duplica) se va. Lo que no cambió se queda tal cual,
 * mismo objeto. Devuelve null si no hay nada que devolver.
 */
export function restoreElements(current: readonly SceneElement[], snapshot: readonly El[]): SceneElement[] | null {
  const now = new Map(current.map((e) => [e.id, e as El]));
  let changed = current.length !== snapshot.length;
  const next = snapshot.map((before) => {
    const live = now.get(before.id);
    if (!live) {
      changed = true;
      return before as SceneElement;
    }
    if (sameElement(live, before)) return live as SceneElement;
    changed = true;
    const props = Object.fromEntries(Object.entries(before).filter(([k]) => !BOOKKEEPING.has(k)));
    return patchElement(live as SceneElement, props as Partial<SceneElement>);
  });
  if (!changed) {
    // Mismos ids y en el mismo orden, y ninguno cambió.
    for (let i = 0; i < next.length; i++) if (next[i] !== current[i]) return next;
    return null;
  }
  return next;
}

/**
 * Velocidad de desplazamiento para un puntero en `p` dentro de la vista `box`,
 * en px de pantalla por ms, en cada eje (positivo: hacia la derecha o abajo).
 */
export function edgeVelocity(
  p: { x: number; y: number },
  box: { left: number; top: number; width: number; height: number },
  zone = EDGE_ZONE_PX,
  max = EDGE_MAX_SPEED,
): { vx: number; vy: number } {
  const axis = (pos: number, start: number, size: number) => {
    const z = Math.min(zone, size / 4);
    if (z <= 0) return 0;
    const fromStart = pos - start;
    const fromEnd = start + size - pos;
    if (fromStart < z) return -max * Math.min(1, (z - fromStart) / z);
    if (fromEnd < z) return max * Math.min(1, (z - fromEnd) / z);
    return 0;
  };
  return { vx: axis(p.x, box.left, box.width), vy: axis(p.y, box.top, box.height) };
}

interface Gesture {
  pds: DragState;
  snapshot: El[];
  selectedElementIds: Record<string, true>;
  selectedGroupIds: Record<string, boolean>;
  /** Lo último del puntero de verdad: dónde, sobre qué y con qué teclas. */
  last: { x: number; y: number; target: EventTarget | null; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean };
  /** Hasta dónde llega el diseño, en escena (sin lo que se arrastra). */
  content: { minX: number; minY: number; maxX: number; maxY: number } | null;
  frame: number | null;
  lastTick: number | null;
  /** Desde cuándo está el puntero en la franja del borde. */
  edgeSince: number | null;
}

function contentBounds(elements: readonly SceneElement[], skip: Record<string, true>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of elements) {
    if (e.isDeleted || skip[e.id]) continue;
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e.width);
    maxY = Math.max(maxY, e.y + e.height);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

export function installCanvaDrag(api: Api, win: Window = window): () => void {
  let gesture: Gesture | null = null;
  /** Los `pointermove` que manda el desplazamiento: no son el puntero de verdad. */
  const synthetic = new WeakSet<Event>();
  const raf = win.requestAnimationFrame?.bind(win) ?? ((cb: FrameRequestCallback) => win.setTimeout(() => cb(Date.now()), 16));
  const caf = win.cancelAnimationFrame?.bind(win) ?? ((id: number) => win.clearTimeout(id));

  const end = () => {
    if (!gesture) return;
    if (gesture.frame !== null) caf(gesture.frame);
    gesture = null;
    win.removeEventListener('pointermove', onMove);
    win.removeEventListener('pointerup', end);
    win.removeEventListener('pointercancel', end);
    win.removeEventListener('blur', end);
    win.removeEventListener('keydown', onKey, true);
  };

  const view = win as unknown as { PointerEvent?: typeof PointerEvent; MouseEvent: typeof MouseEvent };
  const PointerCtor = view.PointerEvent ?? view.MouseEvent;
  const pointer = (type: string, x: number, y: number, mods: Gesture['last']) =>
    new PointerCtor(type, {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      shiftKey: mods.shiftKey,
      altKey: mods.altKey,
      ctrlKey: mods.ctrlKey,
      metaKey: mods.metaKey,
      ...(PointerCtor !== view.MouseEvent ? { pointerId: 1, pointerType: 'mouse', isPrimary: true } : {}),
    } as PointerEventInit) as PointerEvent;

  // ─── El borde de la vista ──────────────────────────────────────────────────
  const tick = (time: number) => {
    const g = gesture;
    if (!g) return;
    g.frame = null;
    const s = api.getAppState();
    const dt = g.lastTick === null ? 16 : Math.min(MAX_FRAME_MS, Math.max(0, time - g.lastTick));
    g.lastTick = time;
    if (!s.selectedElementsAreBeingDragged) {
      g.lastTick = null;
      g.edgeSince = null;
      return;
    }
    const { vx, vy } = edgeVelocity(g.last, { left: s.offsetLeft, top: s.offsetTop, width: s.width, height: s.height });
    const zoom = s.zoom.value;
    let dx = vx * dt;
    let dy = vy * dt;
    // No más allá del diseño: con su borde a media vista del de la ventana, para.
    if (g.content) {
      const viewW = s.width / zoom;
      const viewH = s.height / zoom;
      const left = -s.scrollX;
      const top = -s.scrollY;
      if (dx > 0 && left + viewW >= g.content.maxX + viewW / 2) dx = 0;
      if (dx < 0 && left <= g.content.minX - viewW / 2) dx = 0;
      if (dy > 0 && top + viewH >= g.content.maxY + viewH / 2) dy = 0;
      if (dy < 0 && top <= g.content.minY - viewH / 2) dy = 0;
    }
    if (dx === 0 && dy === 0) {
      g.lastTick = null;
      g.edgeSince = null;
      return;
    }
    if (g.edgeSince === null) g.edgeSince = time;
    if (time - g.edgeSince < EDGE_DELAY_MS) {
      g.frame = raf(tick);
      return;
    }
    api.updateScene({
      appState: { scrollX: s.scrollX - dx / zoom, scrollY: s.scrollY - dy / zoom },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
    // Excalidraw rehace el arrastre con la vista nueva, como si el ratón se moviera.
    const target = g.last.target instanceof EventTarget ? g.last.target : win;
    const move = pointer('pointermove', g.last.x, g.last.y, g.last);
    synthetic.add(move);
    target.dispatchEvent(move);
    if (gesture === g) g.frame = raf(tick);
  };

  const schedule = () => {
    if (gesture && gesture.frame === null) gesture.frame = raf(tick);
  };

  function onMove(ev: PointerEvent) {
    if (!gesture || synthetic.has(ev)) return;
    gesture.last = {
      x: ev.clientX,
      y: ev.clientY,
      target: ev.target,
      shiftKey: ev.shiftKey,
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      metaKey: ev.metaKey,
    };
    schedule();
  }

  // ─── Escape ────────────────────────────────────────────────────────────────
  function onKey(ev: KeyboardEvent) {
    const g = gesture;
    if (!g || ev.key !== 'Escape') return;
    const { pds } = g;
    if (!pds.drag.hasOccurred && !pds.resize.isResizing) return;
    const s = api.getAppState();
    if (s.editingTextElement || s.croppingElementId) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    end();
    const zoom = s.zoom.value;
    // El punto donde se pulsó, en la pantalla de ahora (la vista pudo correr).
    const x = (pds.origin.x + s.scrollX) * zoom + s.offsetLeft;
    const y = (pds.origin.y + s.scrollY) * zoom + s.offsetTop;
    // Se queda seleccionado lo que se arrastraba, como en Canva; si eran copias
    // de Alt+arrastrar, que se van, lo que había seleccionado al pulsar.
    const known = new Set(g.snapshot.map((e) => e.id));
    const dragging = Object.keys(s.selectedElementIds as Record<string, boolean>).filter((k) => s.selectedElementIds[k]);
    const keep = dragging.length > 0 && dragging.every((id) => known.has(id));
    const selection = keep
      ? { selectedElementIds: Object.fromEntries(dragging.map((k) => [k, true as const])), selectedGroupIds: { ...(s.selectedGroupIds as Record<string, boolean>) } }
      : { selectedElementIds: g.selectedElementIds, selectedGroupIds: g.selectedGroupIds };
    const putBack = () => {
      const next = restoreElements(api.getSceneElementsIncludingDeleted(), g.snapshot);
      // `transient`: lo cierra el paso que apunta el `pointerup` de Excalidraw,
      // que ve la escena igual que antes de pulsar y no apunta nada.
      if (next) commitElements(api, next, 'transient', selection);
      else api.updateScene({ appState: selection, captureUpdate: CaptureUpdateAction.EVENTUALLY });
    };
    flushSync(() => {
      // Lo que le quedaba por mover a Excalidraw ya no se mueve.
      pds.eventListeners.onMove?.cancel?.();
      putBack();
      pds.eventListeners.onUp?.(pointer('pointerup', x, y, g.last));
      // Lo que su `pointerup` haya tocado al soltar (la página de lo soltado).
      putBack();
    });
  }

  const unsubscribe = api.onPointerDown((tool, pds, event) => {
    end();
    if (tool.type !== 'selection') return;
    const s = api.getAppState();
    if (s.viewModeEnabled || s.editingTextElement) return;
    const selected = Object.fromEntries(
      Object.entries(s.selectedElementIds as Record<string, boolean>).filter(([, v]) => v).map(([k]) => [k, true as const]),
    );
    const elements = api.getSceneElementsIncludingDeleted();
    gesture = {
      pds: pds as unknown as DragState,
      snapshot: snapshotElements(elements),
      selectedElementIds: selected,
      selectedGroupIds: { ...(s.selectedGroupIds as Record<string, boolean>) },
      last: {
        x: event.clientX,
        y: event.clientY,
        target: event.target,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      },
      content: contentBounds(elements, selected),
      frame: null,
      lastTick: null,
      edgeSince: null,
    };
    win.addEventListener('pointermove', onMove);
    win.addEventListener('pointerup', end);
    win.addEventListener('pointercancel', end);
    win.addEventListener('blur', end);
    win.addEventListener('keydown', onKey, true);
  });

  return () => {
    end();
    unsubscribe();
  };
}
