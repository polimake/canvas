import { type RefObject } from 'react';
import { type ExcalidrawImperativeAPI } from '../../../core/excal';
import { type ScreenRect } from '../../../core/slideView';
export interface SlideMaskProps {
    api: ExcalidrawImperativeAPI;
    /** El envoltorio `[data-canvas2]`, para reenviar la rueda al lienzo. */
    rootRef: RefObject<HTMLDivElement | null>;
    activePageId: string | null;
    /** El hueco de la diapositiva (sin las barras, la tira, los paneles ni las notas). */
    stage: ScreenRect;
    /** Hasta dónde llegan las franjas de arriba y abajo: el borde de las barras y el del editor. */
    limits: {
        top: number;
        bottom: number;
    };
}
/**
 * Las franjas que tapan las diapositivas vecinas con el color de la mesa.
 *
 * Componente aparte, con su propia suscripción al encuadre: se repinta en cada
 * movimiento de la vista y el resto del espacio (la tira con N miniaturas, la
 * barra, los paneles) no tiene por qué repintarse con él.
 */
export declare function SlideMask({ api, rootRef, activePageId, stage, limits }: SlideMaskProps): import("react").JSX.Element;
/**
 * Las cuatro franjas que tapan lo que no es la diapositiva dentro del hueco
 * (las vecinas siguen ahí, en el mismo plano). Puro.
 */
export declare function maskBands(stage: ScreenRect, slide: ScreenRect, limits: {
    top: number;
    bottom: number;
}): Array<{
    left: number;
    top: number;
    width: number;
    height: number;
}>;
//# sourceMappingURL=SlideMask.d.ts.map