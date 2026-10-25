import type { SceneElement } from './excal';
/**
 * ¿Hay que soltar la selección antes de este clic? Devuelve el id de lo que
 * está encima, o `null` si Excalidraw ya hace lo que toca.
 */
export declare function pickOverSelection(elements: readonly SceneElement[], selectedElementIds: Readonly<Record<string, boolean>>, point: {
    x: number;
    y: number;
}, zoom: number): string | null;
/**
 * Pulsar un elemento pegado al borde de una página coge el elemento, no la
 * página.
 *
 * Excalidraw mira las páginas (marcos) después de lo que tienen dentro y las
 * coge por su borde: un elemento a menos de unos píxeles del borde no se podía
 * arrastrar, se llevaba la página entera con todo lo suyo (banco del lienzo,
 * 23/10/2026: «mover banco-elipse-1 cambia también 7 que no se tocaron», la
 * elipse a 5 px del borde derecho). En Canva manda lo que está encima. Pasa a
 * menudo: un diseño que sangra tiene sus bloques justo en el borde.
 *
 * Si el clic es de ese caso, devuelve el id del elemento; el lienzo lo
 * selecciona antes de que Excalidraw vea el clic, y Excalidraw, que da
 * prioridad a lo seleccionado, lo arrastra a él.
 */
export declare function pickOverPageEdge(elements: readonly SceneElement[], selectedElementIds: Readonly<Record<string, boolean>>, point: {
    x: number;
    y: number;
}, zoom: number): string | null;
//# sourceMappingURL=pick.d.ts.map