import { CaptureUpdateAction, type ExcalidrawImperativeAPI } from '../../../core/excal';
import { isPageBackground } from '../../../core/pageModel';
import {
  addPage,
  deletePage,
  duplicatePage,
  listPages,
  movePage,
  movePageTo,
  resizePages,
  type PageInfo,
  type PageSize,
} from '../../../core/pages';
import type { PageNames } from '../../../core/pageNames';
import { isPageSkipped, setPageSkipped } from '../../../core/slideMeta';
import { forwardKey } from '../../editor/keyRouting';

/**
 * Las órdenes del espacio Presentación, en UN sitio: las usan la barra de
 * menús, el clic derecho de la tira, la barra de herramientas y los atajos.
 * Cada una es una operación de `core` que ya existe (una entrada de deshacer);
 * aquí solo se decide sobre qué diapositiva y qué queda activa después.
 */

export type ActivatePage = (id: string) => void;

export function newSlide(
  api: ExcalidrawImperativeAPI,
  afterId: string | null,
  size: PageSize,
  names: PageNames | undefined,
  activate: ActivatePage,
): void {
  const id = addPage(api, size, { ...(afterId ? { afterPageId: afterId } : {}), names });
  activate(id);
}

export function duplicateSlide(
  api: ExcalidrawImperativeAPI,
  id: string,
  names: PageNames | undefined,
  activate: ActivatePage,
): void {
  const copy = duplicatePage(api, id, names);
  if (copy) activate(copy);
}

/** Borra la diapositiva y activa la que queda en su sitio (la siguiente, o la anterior si era la última). */
export function deleteSlide(api: ExcalidrawImperativeAPI, id: string, activate: ActivatePage): void {
  const before = listPages(api);
  if (before.length < 2) return;
  const index = before.findIndex((p) => p.id === id);
  if (!deletePage(api, id)) return;
  const after = listPages(api);
  const next = after[Math.min(Math.max(0, index), after.length - 1)];
  if (next) activate(next.id);
}

export function moveSlide(api: ExcalidrawImperativeAPI, id: string, where: 'start' | 'end' | 'up' | 'down'): void {
  if (where === 'up' || where === 'down') {
    movePage(api, id, where === 'up' ? -1 : 1);
    return;
  }
  const count = listPages(api).length;
  movePageTo(api, id, where === 'start' ? 0 : count - 1);
}

export function toggleSkip(api: ExcalidrawImperativeAPI, id: string): void {
  setPageSkipped(api, id, !isPageSkipped(api, id));
}

/**
 * El tamaño de una presentación es de TODAS sus diapositivas (Archivo ›
 * Configurar página en Slides): se cambian todas, escalando su contenido, en
 * una sola entrada de deshacer.
 */
export function resizeAllSlides(api: ExcalidrawImperativeAPI, size: PageSize): void {
  const ids = listPages(api)
    .filter((page) => page.width !== size.width || page.height !== size.height)
    .map((page) => page.id);
  if (ids.length) resizePages(api, ids, size);
}

/**
 * Seleccionar todo = lo de LA diapositiva activa, como en Slides. El de
 * Excalidraw coge toda la escena (marcos incluidos): con las vecinas tapadas
 * por la máscara, Supr después borraba la presentación entera. Ni el papel ni
 * lo bloqueado; mirar no entra en el historial.
 */
export function selectAllInSlide(api: ExcalidrawImperativeAPI, pageId: string | null): void {
  if (!pageId) return;
  const ids = api.getSceneElements()
    .filter((e) => e.frameId === pageId && !e.locked && !isPageBackground(e))
    .map((e) => [e.id, true] as const);
  api.updateScene({
    appState: { selectedElementIds: Object.fromEntries(ids) as never, selectedGroupIds: {} as never },
    captureUpdate: CaptureUpdateAction.NEVER,
  });
}

/**
 * La selección sin los marcos de las diapositivas. En Presentación las
 * diapositivas son fijas: seleccionar un marco (un clic en su borde o en su
 * nombre) dejaba arrastrarlo o encogerlo sin querer, y la diapositiva se
 * descolocaba. Devuelve null si no había ningún marco. Pura.
 */
export function selectionWithoutFrames(
  selected: Readonly<Record<string, boolean>>,
  elements: ReadonlyArray<{ id: string; type: string }>,
): Record<string, true> | null {
  const ids = Object.keys(selected).filter((id) => selected[id]);
  if (!ids.length) return null;
  const frames = new Set(elements.filter((e) => e.type === 'frame').map((e) => e.id));
  if (!ids.some((id) => frames.has(id))) return null;
  const next: Record<string, true> = {};
  for (const id of ids) if (!frames.has(id)) next[id] = true;
  return next;
}

export function canDeleteSlide(pages: readonly PageInfo[]): boolean {
  return pages.length > 1;
}

/**
 * Lanza un atajo de teclado de Excalidraw como si se hubiera pulsado: deshacer,
 * rehacer, duplicar, eliminar, seleccionar todo, agrupar, ordenar, zoom.
 *
 * Pasa por el mismo reenvío que ya usa el lienzo (keyRouting.ts) en vez de
 * pulsar sus botones escondidos o copiar sus acciones: así el menú hace
 * EXACTAMENTE lo que hace el atajo, con su deshacer y sus reglas.
 */
export function sendCanvasKey(
  root: HTMLElement | null,
  key: string,
  mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {},
  code?: string,
): void {
  const canvas = root?.querySelector<HTMLElement>('.excalidraw');
  if (!canvas) return;
  const isMac = IS_MAC;
  const View = canvas.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
  const event = new View('keydown', {
    key,
    code: code ?? (key.length === 1 && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : key),
    ctrlKey: Boolean(mods.ctrl) && !isMac,
    metaKey: Boolean(mods.ctrl) && isMac,
    shiftKey: Boolean(mods.shift),
    altKey: Boolean(mods.alt),
    bubbles: true,
    cancelable: true,
  });
  forwardKey(event, canvas);
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Los atajos de Excalidraw que reutilizan los menús. Traer al frente y enviar
 * al fondo van con Alt en macOS (Cmd+Alt+]/[): es su `keyTest` en Darwin.
 */
export const CANVAS_KEYS = {
  undo: ['z', { ctrl: true }],
  redo: ['z', { ctrl: true, shift: true }],
  duplicate: ['d', { ctrl: true }],
  delete: ['Delete', {}],
  group: ['g', { ctrl: true }],
  ungroup: ['g', { ctrl: true, shift: true }],
  bringToFront: [']', IS_MAC ? { ctrl: true, alt: true } : { ctrl: true, shift: true }],
  bringForward: [']', { ctrl: true }],
  sendBackward: ['[', { ctrl: true }],
  sendToBack: ['[', IS_MAC ? { ctrl: true, alt: true } : { ctrl: true, shift: true }],
  zoomIn: ['=', { ctrl: true }],
  zoomOut: ['-', { ctrl: true }],
} as const satisfies Record<string, readonly [string, { ctrl?: boolean; shift?: boolean; alt?: boolean }]>;

export type CanvasKey = keyof typeof CANVAS_KEYS;

const KEY_CODES: Record<string, string> = { ']': 'BracketRight', '[': 'BracketLeft', '=': 'Equal', '-': 'Minus' };

export function runCanvasKey(root: HTMLElement | null, name: CanvasKey): void {
  const [key, mods] = CANVAS_KEYS[name];
  sendCanvasKey(root, key, mods, KEY_CODES[key]);
}

/** Cómo se llaman las teclas en el idioma del editor (labels.slides.keys). */
export interface KeyWords {
  shift: string;
  enter: string;
  del: string;
}

/** Texto del atajo para el menú, en el formato del sistema. */
export function shortcutLabel(
  name: CanvasKey | 'newSlide' | 'present' | 'moveUp' | 'moveDown' | 'selectAll',
  words: KeyWords,
): string {
  const ctrl = IS_MAC ? '⌘' : 'Ctrl+';
  const shift = IS_MAC ? '⇧' : `${words.shift}+`;
  const alt = IS_MAC ? '⌥' : 'Alt+';
  if (name === 'newSlide') return `${ctrl}M`;
  if (name === 'selectAll') return `${ctrl}A`;
  if (name === 'present') return `${ctrl}${IS_MAC ? '↩' : words.enter}`;
  if (name === 'moveUp') return `${ctrl}${shift}↑`;
  if (name === 'moveDown') return `${ctrl}${shift}↓`;
  const [key, mods] = CANVAS_KEYS[name] as readonly [string, { ctrl?: boolean; shift?: boolean; alt?: boolean }];
  const shown = key === 'Delete' ? words.del : key.length === 1 ? key.toUpperCase() : key;
  return `${mods.ctrl ? ctrl : ''}${mods.alt ? alt : ''}${mods.shift ? shift : ''}${shown}`;
}
