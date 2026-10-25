import type { SceneElement } from './excal';
/**
 * ¿Hay que soltar la selección antes de este clic? Devuelve el id de lo que
 * está encima, o `null` si Excalidraw ya hace lo que toca.
 */
export declare function pickOverSelection(elements: readonly SceneElement[], selectedElementIds: Readonly<Record<string, boolean>>, point: {
    x: number;
    y: number;
}, zoom: number): string | null;
/** Lo que hay que dejar seleccionado antes de que Excalidraw vea el clic. */
export interface VisiblePick {
    /** Lo que se ve bajo el puntero. */
    id: string;
    selectedElementIds: Record<string, true>;
    selectedGroupIds: Record<string, true>;
}
/**
 * Pulsar coge lo que se ve bajo el puntero, como en Canva.
 *
 * Excalidraw coge lo de más arriba que esté a menos de unos píxeles del clic
 * (8 de pantalla, 4 entre dos que se tocan): pulsar sobre una elipse a 3,5 px
 * del borde de una caja que tiene encima cogía la caja y el arrastre la movía
 * a ella (nightly del 24/10/2026, semilla 1024, paso 26: «mover
 * banco-elipse-1 cambia también rectangle banco-caja-2»). En Canva lo de
 * encima solo se coge si el punto cae de verdad en ello: dentro de su forma si
 * tiene relleno (foto, texto, forma rellena), sobre su trazo si no.
 *
 * Solo actúa cuando hay ese roce: algo por encima de lo que se ve que
 * Excalidraw cogería por su margen. Entonces devuelve lo que hay que
 * seleccionar (lo que se ve, o su grupo entero, o la selección tal cual si ya
 * está en ella); el lienzo lo selecciona antes que Excalidraw, que arrastra lo
 * seleccionado, y al soltar sin arrastrar lo vuelve a dejar si Excalidraw
 * eligió lo de encima. `null` si Excalidraw ya coge lo que se ve, si el clic
 * es de un asa de la selección, o si no hay nada que coger (el papel, la mesa).
 */
export declare function pickVisible(elements: readonly SceneElement[], state: {
    selectedElementIds: Readonly<Record<string, boolean>>;
    selectedGroupIds?: Readonly<Record<string, boolean>>;
    editingGroupId?: string | null;
}, point: {
    x: number;
    y: number;
}, zoom: number): VisiblePick | null;
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