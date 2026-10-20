/**
 * Pulsar sobre lo que está ENCIMA, aunque haya otra cosa seleccionada debajo.
 *
 * Excalidraw da prioridad a la selección: si se pulsa dentro de la caja de lo
 * seleccionado, arrastra lo seleccionado aunque el clic caiga sobre otro
 * elemento que está por encima. Con un texto seleccionado y una foto encima de
 * parte de él, arrastrar la foto movía el texto y dejaba la foto donde estaba
 * (banco del lienzo: «mover banco-foto-1 cambia también text banco-texto-1»).
 * En Canva manda lo que está encima: se coge la foto.
 *
 * Esto decide si el clic es de ese caso. Si lo es, el lienzo quita la selección
 * antes de que Excalidraw vea el clic, y Excalidraw hace lo de siempre sin
 * selección: coge lo que hay debajo del ratón y lo arrastra.
 */
import { isPageBackground } from './background';
import type { SceneElement } from './excal';

/** Distancia (px de pantalla) a una esquina de la selección que es de sus asas. */
const HANDLE_ZONE_PX = 16;

type Box = [number, number, number, number];

/** La caja de un elemento, girada si lo está. */
function boxOf(el: SceneElement): Box {
  const { x, y, width, height } = el;
  const angle = (el as { angle?: number }).angle ?? 0;
  if (!angle) return [Math.min(x, x + width), Math.min(y, y + height), Math.max(x, x + width), Math.max(y, y + height)];
  const cx = x + width / 2;
  const cy = y + height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pts = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(([px, py]) => [
    cx + (px - cx) * cos - (py - cy) * sin,
    cy + (px - cx) * sin + (py - cy) * cos,
  ]);
  return [
    Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])),
    Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])),
  ];
}

const inside = ([x1, y1, x2, y2]: Box, x: number, y: number) => x >= x1 && x <= x2 && y >= y1 && y <= y2;

const grabbable = (el: SceneElement) =>
  !el.isDeleted &&
  el.type !== 'frame' &&
  el.type !== 'magicframe' &&
  !el.locked &&
  !isPageBackground(el) &&
  !(el as { containerId?: string | null }).containerId;

/**
 * ¿Hay que soltar la selección antes de este clic? Devuelve el id de lo que
 * está encima, o `null` si Excalidraw ya hace lo que toca.
 */
export function pickOverSelection(
  elements: readonly SceneElement[],
  selectedElementIds: Readonly<Record<string, boolean>>,
  point: { x: number; y: number },
  zoom: number,
): string | null {
  const selected = elements.filter((el) => !el.isDeleted && selectedElementIds[el.id]);
  if (!selected.length) return null;
  // Una página seleccionada se arrastra entera: eso es cosa de Excalidraw.
  if (selected.some((el) => el.type === 'frame' || el.type === 'magicframe')) return null;
  const boxes = selected.map(boxOf);
  const common: Box = [
    Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3])),
  ];
  // Fuera de la caja de la selección Excalidraw ya coge lo de debajo.
  if (!inside(common, point.x, point.y)) return null;
  // Cerca de una esquina se coge un asa: escalar lo seleccionado.
  const zone = HANDLE_ZONE_PX / (zoom || 1);
  for (const [cx, cy] of [[common[0], common[1]], [common[2], common[1]], [common[0], common[3]], [common[2], common[3]]]) {
    if (Math.abs(point.x - cx) <= zone && Math.abs(point.y - cy) <= zone) return null;
  }
  const frames = new Map(elements.filter((el) => el.type === 'frame' && !el.isDeleted).map((el) => [el.id, boxOf(el)]));
  let top: SceneElement | null = null;
  for (const el of elements) {
    if (!grabbable(el) || !inside(boxOf(el), point.x, point.y)) continue;
    // Lo de una página solo se ve dentro de ella (el marco recorta).
    const frame = el.frameId ? frames.get(el.frameId) : null;
    if (frame && !inside(frame, point.x, point.y)) continue;
    top = el;
  }
  if (!top || selectedElementIds[top.id]) return null;
  // Del mismo grupo que lo seleccionado: es la misma cosa.
  const groups = new Set(selected.flatMap((el) => el.groupIds ?? []));
  if ((top.groupIds ?? []).some((g) => groups.has(g))) return null;
  return top.id;
}
