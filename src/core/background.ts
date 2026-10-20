import {
  convertToExcalidrawElements,
  type ExcalidrawImperativeAPI,
  type FrameElement,
  type SceneElement,
} from './excal';
import { commitElements, patchElement, type CaptureMode } from './mutate';
import { reorderMembersInArray } from './zorder';

/**
 * Per-page background color — Canva-clone parity. Excalidraw frames have no
 * fill of their own, so the background is a locked, full-bleed rectangle sent
 * to the back of the page. It is tagged through the PUBLIC `customData` field
 * (round-tripped verbatim by Excalidraw), so re-applying a color PATCHES the
 * existing background in place (stable element id) instead of rebuilding it.
 */

const BG_MARKER = 'pageBackground';

/** Whether an element is a page's background "paper" sheet. */
export function isPageBackground(el: SceneElement): boolean {
  return (el.customData as { c2?: string } | undefined)?.c2 === BG_MARKER;
}

/**
 * Build the background "paper" element for a page: a locked, full-bleed,
 * SHARP-CORNERED rectangle (roughness 0, no roundness) with a hairline border.
 * Pages read as straight-edged sheets — Excalidraw's own frame outline (which
 * is drawn with rounded corners and no public radius knob) is disabled by the
 * editor (`frameRendering.outline: false`), so this rect IS the page's visual.
 */
export function buildPageBackground(
  pageId: string,
  bounds: { x: number; y: number; width: number; height: number },
  color: string,
): SceneElement[] {
  const skeleton = [
    {
      type: 'rectangle',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      backgroundColor: color,
      fillStyle: 'solid',
      strokeColor: '#d4d4d8',
      strokeWidth: 1,
      roughness: 0,
      roundness: null,
    },
  ] as Parameters<typeof convertToExcalidrawElements>[0];

  return convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) => ({
    ...el,
    frameId: pageId,
    locked: true,
    customData: { c2: BG_MARKER },
  })) as SceneElement[];
}

/**
 * Holgura, en px de escena, dentro de la cual papel y marco «coinciden». Es la
 * misma con la que `packPagesInArray` decide si una página se ha movido: por
 * debajo de eso es ruido de coma flotante, no un papel descolocado.
 */
const PAPER_TOLERANCE = 0.01;

/** ¿Ocupan los dos elementos el mismo rectángulo? */
function sameBounds(a: SceneElement, b: SceneElement): boolean {
  // Escrito en positivo a propósito: con un `NaN` en el papel ninguna
  // comparación se cumple, así que cuenta como descolocado y se repone.
  return (
    Math.abs(a.x - b.x) <= PAPER_TOLERANCE &&
    Math.abs(a.y - b.y) <= PAPER_TOLERANCE &&
    Math.abs(a.width - b.width) <= PAPER_TOLERANCE &&
    Math.abs(a.height - b.height) <= PAPER_TOLERANCE
  );
}

/**
 * PURA: devuelve cada papel a los límites exactos de su marco.
 *
 * El papel ES la página a la vista —el marco no pinta nada, ver
 * `buildPageBackground`— y el marco es lo que recorta y lo que se exporta, así
 * que los dos tienen que ocupar el mismo rectángulo. Todo lo que crea o cambia
 * una página lo cumple: el papel nace con los límites del marco, `resizePage`
 * lo estira a los nuevos y mover una página se lleva a sus miembros con ella.
 * Pero nadie lo REPONÍA: hasta el 11/10 `addPage` y la paginación dejaban el
 * papel 10 px por debajo de su marco (el margen que Excalidraw pone a un marco
 * sin hijos), y un diseño guardado así se quedaba así para siempre. Lo mismo un
 * marco estirado a mano en el lienzo, que Excalidraw redimensiona sin tocar a
 * sus miembros.
 *
 * Solo toca papeles, y solo los que tienen marco: uno suelto, o de un marco que
 * ya no existe, se queda como está, y a una página sin papel no se le inventa
 * aquí (eso es cosa de `ensurePagePapers`).
 *
 * Devuelve la MISMA referencia cuando no hay nada que mover —como
 * `packPagesInArray`—, que es lo que permite llamarla en cada pasada del
 * normalizador sin escribir en la escena.
 */
export function fitPagePapersInArray(
  elements: readonly SceneElement[],
): readonly SceneElement[] {
  const frames = new Map<string, SceneElement>();
  for (const e of elements) {
    if (e.type === 'frame' && !e.isDeleted) frames.set(e.id, e);
  }
  if (frames.size === 0) return elements;

  let next: SceneElement[] | null = null;
  for (let i = 0; i < elements.length; i += 1) {
    const e = elements[i];
    if (!e.frameId || e.isDeleted || !isPageBackground(e)) continue;
    const frame = frames.get(e.frameId);
    if (!frame || sameBounds(e, frame)) continue;
    // Un marco con medidas rotas no es referencia de nada: copiarlas al papel
    // extendería el daño en vez de arreglarlo.
    if (![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite)) continue;
    if (!next) next = elements.slice();
    next[i] = patchElement(e, {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    });
  }
  return next ?? elements;
}

/**
 * ¿Hay alguna página cuyo papel no es su miembro más bajo? Es la comprobación
 * barata que el lienzo hace en cada `onChange` para no esperar al normalizador
 * con retardo: al soltar un elemento en otra página, Excalidraw le cambia el
 * `frameId` pero no su sitio en el orden, y si estaba por debajo del papel de
 * la nueva página se queda tapado por él hasta que alguien lo hunde.
 */
export function hasRaisedPaper(elements: readonly SceneElement[]): boolean {
  const firstOf = new Map<string, SceneElement>();
  for (const e of elements) {
    if (e.isDeleted || !e.frameId || firstOf.has(e.frameId)) continue;
    firstOf.set(e.frameId, e);
  }
  for (const [frameId, first] of firstOf) {
    if (isPageBackground(first)) continue;
    if (elements.some((e) => !e.isDeleted && e.frameId === frameId && isPageBackground(e))) return true;
  }
  return false;
}

/**
 * Garantiza el suelo de cada página: que TENGA papel, que el papel esté ABAJO y
 * que ocupe su marco.
 *
 * Nació como migración de una sola pasada para escenas anteriores al papel, y
 * por eso volvía al primer `return` en cuanto todas las páginas tenían uno. El
 * efecto era que el papel se colocaba bien el día que se creaba y nunca más se
 * revisaba: bastaba que algo lo levantara UNA vez (un deshacer, un reordenado
 * con la lista incompleta) para que la página se quedara tapada por su propio
 * fondo para siempre, porque nadie volvía a bajarlo.
 *
 * Ahora corre en cada pasada del normalizador y hace las tres cosas —crear el
 * que falte, hundir el que se haya levantado y devolver a su marco el que esté
 * descolocado (ver `fitPagePapersInArray`)— en un SOLO commit invisible al
 * historial (`capture: 'never'`): es la forma canónica de la escena, no una
 * edición del usuario, y el primer Ctrl+Z tras abrir no debe borrar un papel.
 * Si no hay nada que corregir no commitea nada, que es lo que la hace apta para
 * un `onChange`.
 */
export function ensurePagePapers(
  api: ExcalidrawImperativeAPI,
  capture: CaptureMode = 'never',
): void {
  const elements = api.getSceneElements();
  const frames = elements.filter((e): e is FrameElement => e.type === 'frame');
  if (frames.length === 0) return;

  const withPaper = new Set(
    elements.filter((e) => e.frameId && isPageBackground(e)).map((e) => e.frameId as string),
  );
  const missing = frames.filter((f) => !withPaper.has(f.id));

  // Páginas cuyo papel ya no es su miembro más bajo: el fallo silencioso que
  // esta función dejaba pasar cuando solo miraba si el papel EXISTÍA.
  const sunk = frames.filter((f) => {
    const members = elements.filter((e) => e.frameId === f.id);
    return members.length > 1 && !isPageBackground(members[0]);
  });

  // Papeles que no están donde su marco. Va antes de crear los que faltan: esos
  // nacen ya con los límites del suyo.
  const fitted = fitPagePapersInArray(elements);

  /**
   * Páginas guardadas con la convención VIEJA: el marco delante de sus
   * miembros. Excalidraw inserta lo que lleva `frameId` en el hueco del marco
   * (`Scene.insertElement`), así que en esas escenas un texto pegado —o creado
   * con la T— caía DELANTE del papel opaco y nacía invisible (issue #103).
   *
   * Los 1.271 diseños ya guardados tienen esa forma, y el arreglo de
   * `pageElementsInOrder` solo cubre las páginas nuevas. Aquí se migran al
   * abrirlas: mover el marco detrás de los suyos no cambia nada de lo que se
   * ve —el marco no pinta— pero devuelve su sentido al hueco de inserción.
   */
  const frameBeforeMembers = frames.filter((f) => {
    const frameAt = elements.indexOf(f);
    if (frameAt < 0) return false;
    return elements.some((e, i) => e.frameId === f.id && i > frameAt);
  });

  if (
    missing.length === 0 &&
    sunk.length === 0 &&
    frameBeforeMembers.length === 0 &&
    fitted === elements
  ) {
    return;
  }

  let combined: readonly SceneElement[] = [...fitted];
  for (const frame of missing) {
    combined = [...combined, ...buildPageBackground(frame.id, frame, '#ffffff')];
  }
  // Recolocar cada marco tras sus miembros, sin tocar el orden relativo de
  // nadie más: se saca el marco de su hueco y se reinserta justo después del
  // último de los suyos.
  for (const frame of frameBeforeMembers) {
    const rest = combined.filter((e) => e.id !== frame.id);
    let lastMember = -1;
    rest.forEach((e, i) => {
      if (e.frameId === frame.id) lastMember = i;
    });
    const self = combined.find((e) => e.id === frame.id);
    if (!self || lastMember < 0) continue;
    combined = [...rest.slice(0, lastMember + 1), self, ...rest.slice(lastMember + 1)];
  }
  // Una sola pasada por página: `reorderMembersInArray` hunde el papel de
  // oficio (ver `floorFirst` en zorder.ts), así que basta con nombrarla.
  for (const frame of [...missing, ...sunk]) {
    combined = reorderMembersInArray(
      combined,
      frame.id,
      combined.filter((e) => e.frameId === frame.id).map((e) => e.id),
    );
  }
  commitElements(api, combined, capture);
}

/** Current background color of a page, or null if it has none. */
export function getPageBackground(
  api: ExcalidrawImperativeAPI,
  pageId: string,
): string | null {
  const bg = api
    .getSceneElements()
    .find((e) => e.frameId === pageId && isPageBackground(e));
  return bg ? ((bg as { backgroundColor?: string }).backgroundColor ?? null) : null;
}

/**
 * Set (or replace) a page's background color. Pass `null` to remove it.
 * Re-coloring PATCHES the existing paper in place — same element id, one
 * history-visible change. `capture: 'transient'` is for live previews (the
 * color-input drag); the final pick commits 'undoable'.
 * Returns the background element id, or null when removing.
 */
export function setPageBackgroundColor(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  color: string | null,
  opts: { capture?: CaptureMode } = {},
): string | null {
  const capture = opts.capture ?? 'undoable';
  const elements = api.getSceneElements();
  const frame = elements.find(
    (e): e is FrameElement => e.id === pageId && e.type === 'frame',
  );
  if (!frame) return null;

  const existing = elements.find((e) => e.frameId === pageId && isPageBackground(e));

  if (!color) {
    if (!existing) return null;
    commitElements(api, elements.filter((e) => e !== existing), capture);
    return null;
  }

  if (existing) {
    if ((existing as { backgroundColor?: string }).backgroundColor === color) {
      return existing.id;
    }
    const next = elements.map((e) =>
      e === existing
        ? patchElement(e, { backgroundColor: color } as Partial<SceneElement>)
        : e,
    );
    commitElements(api, next, capture);
    return existing.id;
  }

  const created = buildPageBackground(pageId, frame, color);
  const id = created[0]?.id ?? null;
  const appended: readonly SceneElement[] = [...elements, ...created];
  const reordered = id
    ? reorderMembersInArray(appended, pageId, [id])
    : appended;
  commitElements(api, reordered, capture);
  return id;
}
