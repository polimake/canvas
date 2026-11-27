import type { SceneBox } from './slideView';
import type { SceneElement } from './excal';
/**
 * Selección de recuadro de UNA página, hecha a mano.
 *
 * En Presentación, alrededor de la diapositiva hay franjas que tapan las
 * vecinas, y el recuadro de Excalidraw no puede empezar en ellas. Este coge,
 * como Excalidraw, lo que queda entero dentro del recuadro, pero solo de la
 * página activa: nunca algo de una vecina tapada.
 */
export interface MarqueeSelection {
    selectedElementIds: Record<string, true>;
    selectedGroupIds: Record<string, true>;
}
/** La caja de escena de un elemento, con el giro y los puntos de las líneas. Pura. */
export declare function elementSceneBounds(el: SceneElement): SceneBox;
/**
 * Lo de la página `pageId` que queda entero dentro de `box`. Como Excalidraw:
 * sin lo bloqueado, sin el texto que va dentro de una forma (se coge con ella)
 * y un grupo entero si se coge algo suyo. Tampoco el fondo de la página.
 * `previous` (con Mayúsculas) se suma. Pura.
 */
export declare function selectInBox(elements: readonly SceneElement[], pageId: string, box: SceneBox, previous?: MarqueeSelection): MarqueeSelection;
//# sourceMappingURL=marquee.d.ts.map