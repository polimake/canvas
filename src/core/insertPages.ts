import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
import { commitElements } from './mutate';
import { framesInDocumentOrder, packPagesInArray, renumberPagesInArray } from './pages';

/**
 * Añadir a la escena viva páginas que vienen de fuera —las de un .pptx o un
 * .pdf ya convertidas por `documentToScene`— detrás de `afterPageId` (por
 * defecto, al final), en UNA entrada de deshacer.
 *
 * Las páginas llegan colocadas a partir de x = 0; aquí se desplazan detrás de
 * la de referencia y `packPagesInArray` las asienta en la fila con el orden del
 * documento. Un id que ya exista en la escena se renombra (y con él las
 * referencias de sus elementos), así que importar dos veces el mismo fichero
 * no pisa nada. Los ficheros de imagen van por `addFiles`. Devuelve los ids de
 * las páginas nuevas, en su orden.
 */
export interface IncomingPages {
  elements: readonly unknown[];
  files?: Record<string, unknown>;
}

type Loose = SceneElement & Record<string, unknown>;

export function insertPagesIntoScene(
  api: ExcalidrawImperativeAPI,
  incoming: IncomingPages,
  { afterPageId }: { afterPageId?: string | null } = {},
): string[] {
  const current = api.getSceneElements();
  const taken = new Set((api.getSceneElementsIncludingDeleted?.() ?? current).map((e) => e.id));
  const rename = new Map<string, string>();
  const fresh = (id: string) => {
    if (!taken.has(id)) return id;
    let n = 2;
    while (taken.has(`${id}-${n}`)) n += 1;
    return `${id}-${n}`;
  };
  const source = incoming.elements as Loose[];
  for (const el of source) {
    const id = fresh(el.id);
    taken.add(id);
    if (id !== el.id) rename.set(el.id, id);
  }
  const remap = (id: unknown) => (typeof id === 'string' ? rename.get(id) ?? id : id);
  // Los grupos, igual: dos importaciones del mismo fichero traen los mismos
  // ids de grupo y Excalidraw las movería juntas como un solo grupo.
  const groupsTaken = new Set(current.flatMap((e) => (e.groupIds ?? []) as string[]));
  const groupRename = new Map<string, string>();
  const regroup = (ids: unknown) => (Array.isArray(ids) ? (ids as string[]).map((g) => {
    if (!groupsTaken.has(g)) return g;
    let renamed = groupRename.get(g);
    if (!renamed) {
      let n = 2;
      while (groupsTaken.has(`${g}-${n}`)) n += 1;
      renamed = `${g}-${n}`;
      groupRename.set(g, renamed);
    }
    return renamed;
  }) : ids);

  const existing = framesInDocumentOrder(current);
  const anchor = (afterPageId && existing.find((f) => f.id === afterPageId)) || existing[existing.length - 1] || null;
  const newFrames = source.filter((e) => e.type === 'frame');
  if (!newFrames.length) return [];
  // Provisional, a la derecha del ancla y a su altura; el empaquetado la asienta.
  const minX = Math.min(...newFrames.map((f) => f.x));
  const minY = Math.min(...newFrames.map((f) => f.y));
  const dx = (anchor ? anchor.x + anchor.width + 1 : 0) - minX;
  const dy = (anchor ? anchor.y : 0) - minY;

  const moved = source.map((el) => ({
    ...el,
    id: remap(el.id),
    x: el.x + dx,
    y: el.y + dy,
    frameId: remap(el.frameId) ?? null,
    groupIds: regroup(el.groupIds) ?? [],
    containerId: el.containerId == null ? el.containerId : remap(el.containerId),
    boundElements: Array.isArray(el.boundElements)
      ? (el.boundElements as { id: string; type: string }[]).map((b) => ({ ...b, id: remap(b.id) as string }))
      : el.boundElements,
  })) as unknown as SceneElement[];

  const files = Object.values(incoming.files ?? {});
  if (files.length) api.addFiles(files as Parameters<ExcalidrawImperativeAPI['addFiles']>[0]);

  const newIds = framesInDocumentOrder(moved).map((f) => f.id);
  const order = existing.map((f) => f.id);
  const at = anchor ? order.indexOf(anchor.id) + 1 : order.length;
  order.splice(at, 0, ...newIds);

  let combined: readonly SceneElement[] = [...current, ...moved];
  combined = packPagesInArray(combined, order);
  combined = renumberPagesInArray(combined, order);
  commitElements(api, combined);
  return newIds;
}
