import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
import { commitElements, patchElement, type CaptureMode } from './mutate';
import {
  SLIDE_NOTES_KEY, SLIDE_SKIP_KEY, SLIDE_TRANSITION_KEY, SLIDE_TRANSITIONS,
  notesOf, isSkippedFrame, transitionOf, type SlideTransition,
} from './pageModel';

/**
 * Lo que una página sabe de sí misma cuando se usa como DIAPOSITIVA: notas del
 * orador, si se salta al presentar y con qué transición entra.
 *
 * Todo vive en el `customData` del MARCO, el mismo canal público que ya usan el
 * orden de las páginas (`c2page`, pages.ts) y el papel de fondo (`c2`,
 * background.ts): Excalidraw lo guarda y lo devuelve tal cual, así que viaja con
 * el diseño sin columna nueva ni migración. Duplicar una página clona el marco
 * entero (`duplicatePage`), y con él todo esto, como en Slides.
 *
 * Nada de esto se pinta en el lienzo ni en las imágenes exportadas; el .pptx
 * sí lo lleva (notas, diapositivas ocultas y fundido: documentToPptx.ts).
 */
type WithCustomData = { customData?: Record<string, unknown> | null };

function frameIn(elements: readonly SceneElement[], pageId: string): SceneElement | undefined {
  return elements.find((e) => e.id === pageId && e.type === 'frame');
}

// Claves y lectura: pageModel.ts (puro, para los conversores headless).
export {
  SLIDE_NOTES_KEY, SLIDE_SKIP_KEY, SLIDE_TRANSITION_KEY, SLIDE_TRANSITIONS,
  notesOf, isSkippedFrame, transitionOf, type SlideTransition,
};

/**
 * Copia del array con una clave del `customData` de la página cambiada. Puro.
 *
 * `undefined` BORRA la clave en vez de guardar un valor vacío: una página sin
 * notas, sin saltar y sin transición es idéntica a una que nunca las tuvo.
 *
 * Devuelve el MISMO array si no hay nada que cambiar (página que no existe o
 * mismo valor): quien llama lo usa para no dejar una entrada de deshacer vacía.
 */
export function setSlideMetaInArray(
  elements: readonly SceneElement[],
  pageId: string,
  key: string,
  value: string | boolean | undefined,
): readonly SceneElement[] {
  const index = elements.findIndex((e) => e.id === pageId && e.type === 'frame');
  if (index < 0) return elements;
  const frame = elements[index];
  const current = { ...((frame as WithCustomData).customData ?? {}) };
  if (current[key] === value || (value === undefined && !(key in current))) return elements;
  if (value === undefined) delete current[key];
  else current[key] = value;
  const next = elements.slice();
  next[index] = patchElement(frame, { customData: current } as Partial<SceneElement>);
  return next;
}

function commitMeta(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  key: string,
  value: string | boolean | undefined,
  capture: CaptureMode,
): boolean {
  const elements = api.getSceneElements();
  const next = setSlideMetaInArray(elements, pageId, key, value);
  if (next === elements) return false;
  commitElements(api, next, capture);
  return true;
}

/** Las notas de la página `pageId` en la escena viva. */
export function getPageNotes(api: ExcalidrawImperativeAPI, pageId: string): string {
  return notesOf(frameIn(api.getSceneElements(), pageId) as WithCustomData | undefined);
}

/**
 * Guarda las notas de una página: UNA entrada de deshacer, ninguna si el texto
 * no cambia (los espacios del final no cuentan). Devuelve si ha escrito algo.
 *
 * La caja de notas no llama a esto en cada tecla: guarda al salir de ella y al
 * cambiar de diapositiva, igual que un título se confirma al terminar de
 * escribirlo y no letra a letra en el historial.
 */
export function setPageNotes(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  text: string,
  capture: CaptureMode = 'undoable',
): boolean {
  const value = text.replace(/\s+$/, '');
  return commitMeta(api, pageId, SLIDE_NOTES_KEY, value || undefined, capture);
}

/** Si la página se salta al presentar. */
export function isPageSkipped(api: ExcalidrawImperativeAPI, pageId: string): boolean {
  return isSkippedFrame(frameIn(api.getSceneElements(), pageId) as WithCustomData | undefined);
}

/** Saltar (o volver a incluir) una página al presentar. Una entrada de deshacer. */
export function setPageSkipped(api: ExcalidrawImperativeAPI, pageId: string, skipped: boolean): boolean {
  return commitMeta(api, pageId, SLIDE_SKIP_KEY, skipped || undefined, 'undoable');
}

/** La transición con la que entra la página al presentar. */
export function getPageTransition(api: ExcalidrawImperativeAPI, pageId: string): SlideTransition {
  return transitionOf(frameIn(api.getSceneElements(), pageId) as WithCustomData | undefined);
}

/**
 * Cambia la transición de una página, o de todas si `pageId` es null (el
 * «Aplicar a todas» de Slides): en los dos casos, UNA entrada de deshacer.
 */
export function setPageTransition(
  api: ExcalidrawImperativeAPI,
  pageId: string | null,
  transition: SlideTransition,
): boolean {
  const value = transition === 'none' ? undefined : transition;
  const elements = api.getSceneElements();
  const ids = pageId ? [pageId] : elements.filter((e) => e.type === 'frame').map((e) => e.id);
  let next = elements;
  for (const id of ids) next = setSlideMetaInArray(next, id, SLIDE_TRANSITION_KEY, value);
  if (next === elements) return false;
  commitElements(api, next, 'undoable');
  return true;
}
