import { type ExcalidrawImperativeAPI } from './excal';
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
/** Cuánto del hueco ocupa la diapositiva: Slides deja un margen fino. */
export declare const SLIDE_COVERAGE = 0.94;
/** Zoom y desplazamiento que dejan `box` centrada en `rect`. Puro. */
export declare function fitBoxInRect(box: SceneBox, rect: ScreenRect, coverage?: number): Viewport;
/** Dónde cae `box` en pantalla con el encuadre actual. Puro. */
export declare function boxOnScreen(box: SceneBox, view: Viewport): ScreenRect;
/** El encuadre vivo de Excalidraw. */
export declare function currentViewport(api: ExcalidrawImperativeAPI): Viewport;
/** La caja de escena de una página, o null si no existe. */
export declare function pageBox(api: ExcalidrawImperativeAPI, pageId: string): SceneBox | null;
/**
 * Lleva la vista a la página `pageId`, centrada en `rect`. Sin animación (en
 * Slides cambiar de diapositiva es instantáneo) y fuera del historial: mirar no
 * es editar. Devuelve false si la página no existe.
 */
export declare function fitPageInRect(api: ExcalidrawImperativeAPI, pageId: string, rect: ScreenRect, coverage?: number): boolean;
//# sourceMappingURL=slideView.d.ts.map