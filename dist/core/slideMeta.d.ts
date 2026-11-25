import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
import { type CaptureMode } from './mutate';
import { SLIDE_NOTES_KEY, SLIDE_SKIP_KEY, SLIDE_TRANSITION_KEY, SLIDE_TRANSITIONS, notesOf, isSkippedFrame, transitionOf, type SlideTransition } from './pageModel';
export { SLIDE_NOTES_KEY, SLIDE_SKIP_KEY, SLIDE_TRANSITION_KEY, SLIDE_TRANSITIONS, notesOf, isSkippedFrame, transitionOf, type SlideTransition, };
/**
 * Copia del array con una clave del `customData` de la página cambiada. Puro.
 *
 * `undefined` BORRA la clave en vez de guardar un valor vacío: una página sin
 * notas, sin saltar y sin transición es idéntica a una que nunca las tuvo.
 *
 * Devuelve el MISMO array si no hay nada que cambiar (página que no existe o
 * mismo valor): quien llama lo usa para no dejar una entrada de deshacer vacía.
 */
export declare function setSlideMetaInArray(elements: readonly SceneElement[], pageId: string, key: string, value: string | boolean | undefined): readonly SceneElement[];
/** Las notas de la página `pageId` en la escena viva. */
export declare function getPageNotes(api: ExcalidrawImperativeAPI, pageId: string): string;
/**
 * Guarda las notas de una página: UNA entrada de deshacer, ninguna si el texto
 * no cambia (los espacios del final no cuentan). Devuelve si ha escrito algo.
 *
 * La caja de notas no llama a esto en cada tecla: guarda al salir de ella y al
 * cambiar de diapositiva, igual que un título se confirma al terminar de
 * escribirlo y no letra a letra en el historial.
 */
export declare function setPageNotes(api: ExcalidrawImperativeAPI, pageId: string, text: string, capture?: CaptureMode): boolean;
/** Si la página se salta al presentar. */
export declare function isPageSkipped(api: ExcalidrawImperativeAPI, pageId: string): boolean;
/** Saltar (o volver a incluir) una página al presentar. Una entrada de deshacer. */
export declare function setPageSkipped(api: ExcalidrawImperativeAPI, pageId: string, skipped: boolean): boolean;
/** La transición con la que entra la página al presentar. */
export declare function getPageTransition(api: ExcalidrawImperativeAPI, pageId: string): SlideTransition;
/**
 * Cambia la transición de una página, o de todas si `pageId` es null (el
 * «Aplicar a todas» de Slides): en los dos casos, UNA entrada de deshacer.
 */
export declare function setPageTransition(api: ExcalidrawImperativeAPI, pageId: string | null, transition: SlideTransition): boolean;
//# sourceMappingURL=slideMeta.d.ts.map