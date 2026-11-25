import { CaptureUpdateAction, type ExcalidrawImperativeAPI } from './excal';

/**
 * Encuadre de UNA diapositiva dentro de un hueco de la pantalla.
 *
 * `goToPage` usa `scrollToContent`, que centra en el lienzo ENTERO. En el
 * espacio Presentación el lienzo queda debajo de la tira, la barra y las notas
 * (van encima, como capas), así que el centro bueno es el del hueco que dejan:
 * aquí se calcula a mano el zoom y el desplazamiento para ese rectángulo.
 *
 * Coordenadas: las de pantalla son relativas a la caja de Excalidraw, y
 * Excalidraw pinta un punto de escena en `(escena + scroll) × zoom`.
 */
export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SceneBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/** Los límites de zoom de Excalidraw (10 % – 3000 %). */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 30;

/** Cuánto del hueco ocupa la diapositiva: Slides deja un margen fino. */
export const SLIDE_COVERAGE = 0.94;

/** Zoom y desplazamiento que dejan `box` centrada en `rect`. Puro. */
export function fitBoxInRect(box: SceneBox, rect: ScreenRect, coverage = SLIDE_COVERAGE): Viewport {
  const zoomRaw = Math.min(
    (rect.width * coverage) / Math.max(1, box.width),
    (rect.height * coverage) / Math.max(1, box.height),
  );
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRaw));
  return {
    zoom,
    scrollX: (rect.left + rect.width / 2) / zoom - (box.x + box.width / 2),
    scrollY: (rect.top + rect.height / 2) / zoom - (box.y + box.height / 2),
  };
}

/** Dónde cae `box` en pantalla con el encuadre actual. Puro. */
export function boxOnScreen(box: SceneBox, view: Viewport): ScreenRect {
  return {
    left: (box.x + view.scrollX) * view.zoom,
    top: (box.y + view.scrollY) * view.zoom,
    width: box.width * view.zoom,
    height: box.height * view.zoom,
  };
}

/** El encuadre vivo de Excalidraw. */
export function currentViewport(api: ExcalidrawImperativeAPI): Viewport {
  const s = api.getAppState() as { scrollX?: number; scrollY?: number; zoom?: { value?: number } };
  return { scrollX: s.scrollX ?? 0, scrollY: s.scrollY ?? 0, zoom: s.zoom?.value ?? 1 };
}

/** La caja de escena de una página, o null si no existe. */
export function pageBox(api: ExcalidrawImperativeAPI, pageId: string): SceneBox | null {
  const f = api.getSceneElements().find((e) => e.id === pageId && e.type === 'frame');
  return f ? { x: f.x, y: f.y, width: f.width, height: f.height } : null;
}

/**
 * Lleva la vista a la página `pageId`, centrada en `rect`. Sin animación (en
 * Slides cambiar de diapositiva es instantáneo) y fuera del historial: mirar no
 * es editar. Devuelve false si la página no existe.
 */
export function fitPageInRect(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  rect: ScreenRect,
  coverage = SLIDE_COVERAGE,
): boolean {
  const box = pageBox(api, pageId);
  if (!box || rect.width <= 0 || rect.height <= 0) return false;
  const view = fitBoxInRect(box, rect, coverage);
  api.updateScene({
    appState: {
      scrollX: view.scrollX,
      scrollY: view.scrollY,
      zoom: { value: view.zoom as never },
    },
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  return true;
}
