import type { SceneElement } from './excal';

/**
 * Lo que se LEE de una página sin tocar el editor: su orden, cuál es su papel
 * de fondo y lo que sabe de sí misma como diapositiva.
 *
 * Módulo puro (solo tipos de Excalidraw): lo usan el editor (`pages.ts`,
 * `background.ts`, `slideMeta.ts`, que escriben) y los conversores headless
 * (`converters/sceneToDocument.ts`, que exporta en un worker o en el servidor
 * sin cargar Excalidraw; ver `__tests__/decoupling.test.ts`).
 */

type FrameElement = Extract<SceneElement, { type: 'frame' }>;
type WithCustomData = { customData?: Record<string, unknown> | null };

/**
 * El orden del documento vive en el marco, no en su `x`.
 *
 * Deducirlo de la posición era barato pero frágil: los marcos se pueden
 * arrastrar (Excalidraw dibuja su rótulo y tira de él), así que empujar una
 * página 20 px a la izquierda la colaba delante de su vecina y el siguiente
 * reempaquetado —o la simple recarga, que llama a `relayoutPages`— consolidaba
 * ese cambio de orden que nadie había pedido. Se guarda en `customData`, el
 * mismo canal público que ya usa el papel de fondo (Excalidraw lo devuelve tal
 * cual), y la `x` pasa a ser una CONSECUENCIA del orden en vez de su origen.
 */
export const PAGE_MARKER = 'c2page';

export function pageOrderOf(el: SceneElement): number | null {
  const raw = (el.customData as { [PAGE_MARKER]?: { index?: unknown } } | undefined)?.[PAGE_MARKER]?.index;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/**
 * Los marcos, en orden de documento.
 *
 * Manda la marca guardada, pero SOLO si la llevan todas: con una sola sin
 * marcar no hay forma de intercalarla entre índices (¿va antes o después de la
 * 3?), así que se cae en bloque a ordenar por `x` —el comportamiento histórico—
 * y el siguiente `packPagesInArray` vuelve a marcarlas todas. Eso cubre a la vez
 * las escenas antiguas (ninguna marcada) y el marco que alguien acaba de dibujar
 * a mano (una sin marcar).
 */
export function framesInDocumentOrder(elements: readonly SceneElement[]): FrameElement[] {
  const frames = elements.filter((e): e is FrameElement => e.type === 'frame');
  const marked = frames.length > 0 && frames.every((f) => pageOrderOf(f) !== null);
  return frames
    .slice()
    .sort(
      marked
        ? (a, b) => (pageOrderOf(a) as number) - (pageOrderOf(b) as number)
        : (a, b) => a.x - b.x,
    );
}

/** Marca del papel de cada página (ver background.ts). */
export const BG_MARKER = 'pageBackground';

/** Whether an element is a page's background "paper" sheet. */
export function isPageBackground(el: SceneElement): boolean {
  return (el.customData as { c2?: string } | undefined)?.c2 === BG_MARKER;
}

/**
 * Lo que una página sabe de sí misma cuando se usa como DIAPOSITIVA (lo escribe
 * slideMeta.ts): notas del orador, si se salta al presentar y con qué
 * transición entra. Viaja en el `customData` del marco.
 */
export const SLIDE_NOTES_KEY = 'c2notes';
export const SLIDE_SKIP_KEY = 'c2skip';
export const SLIDE_TRANSITION_KEY = 'c2transition';

export type SlideTransition = 'none' | 'fade';
export const SLIDE_TRANSITIONS: readonly SlideTransition[] = ['none', 'fade'];

/** Las notas de un marco (vacío si no tiene). */
export function notesOf(el: WithCustomData | null | undefined): string {
  const raw = el?.customData?.[SLIDE_NOTES_KEY];
  return typeof raw === 'string' ? raw : '';
}

/** Si el marco se salta al presentar. */
export function isSkippedFrame(el: WithCustomData | null | undefined): boolean {
  return el?.customData?.[SLIDE_SKIP_KEY] === true;
}

/** La transición del marco; cualquier valor desconocido cuenta como ninguna. */
export function transitionOf(el: WithCustomData | null | undefined): SlideTransition {
  const raw = el?.customData?.[SLIDE_TRANSITION_KEY];
  return (SLIDE_TRANSITIONS as readonly unknown[]).includes(raw) ? (raw as SlideTransition) : 'none';
}
