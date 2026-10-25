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
  const box = boxOfUnrotated(el);
  const angle = (el as { angle?: number }).angle ?? 0;
  if (!angle) return box;
  const [x1, y1, x2, y2] = box;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pts = [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].map(([px, py]) => [
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
  const top = topAt(elements, point, zoom);
  if (!top || selectedElementIds[top.id]) return null;
  // Del mismo grupo que lo seleccionado: es la misma cosa.
  const groups = new Set(selected.flatMap((el) => el.groupIds ?? []));
  if ((top.groupIds ?? []).some((g) => groups.has(g))) return null;
  return top.id;
}

/** Holgura (px de pantalla) alrededor de un trazo que se ve: la mano no es exacta. */
const STROKE_SLACK_PX = 3;

/**
 * El margen con el que Excalidraw coge: DEFAULT_COLLISION_THRESHOLD (2·4 − ε) px
 * de pantalla alrededor de cada elemento (la mitad entre dos que se tocan).
 */
const EXCALIDRAW_HIT_PX = 8;

/** Lo que en Excalidraw no pinta relleno: «transparent» o un color con alfa 0. */
function isTransparent(color: unknown): boolean {
  if (color === undefined || color === null) return false;
  const c = String(color).trim().toLowerCase();
  return c === 'transparent' || c === '' || (/^#[0-9a-f]{4}$/.test(c) && c.endsWith('0')) || (/^#[0-9a-f]{8}$/.test(c) && c.endsWith('00'));
}

type Points = readonly (readonly [number, number])[];
const pointsOf = (el: SceneElement): Points | null => {
  const pts = (el as { points?: Points }).points;
  return Array.isArray(pts) && pts.length ? pts : null;
};

/** La caja sin girar: la de los puntos en una línea, la de x/y/ancho/alto en lo demás. */
function boxOfUnrotated(el: SceneElement): Box {
  const pts = pointsOf(el);
  if (pts) {
    const xs = pts.map((p) => el.x + p[0]);
    const ys = pts.map((p) => el.y + p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  const { x, y, width, height } = el;
  return [Math.min(x, x + width), Math.min(y, y + height), Math.max(x, x + width), Math.max(y, y + height)];
}

/** El punto en las coordenadas del elemento sin girar, con su caja sin girar. */
function local(el: SceneElement, x: number, y: number): { x: number; y: number; box: Box } {
  const box = boxOfUnrotated(el);
  const angle = (el as { angle?: number }).angle ?? 0;
  if (!angle) return { x, y, box };
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return { x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos, box };
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insidePolygon(px: number, py: number, poly: Points): boolean {
  let inPoly = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inPoly = !inPoly;
  }
  return inPoly;
}

/**
 * ¿Se ve el elemento justo bajo el punto? Como en Canva: una foto, un texto o
 * una forma rellena, por dentro de su forma (una elipse por dentro de la
 * elipse, no por las esquinas de su caja); una forma sin relleno o una línea,
 * solo por su trazo. Un texto metido en una forma sin relleno coge la forma.
 */
function under(el: SceneElement, x: number, y: number, zoom: number, byId?: ReadonlyMap<string, SceneElement>): boolean {
  const z = zoom || 1;
  const p = local(el, x, y);
  const [x1, y1, x2, y2] = p.box;
  const sw = Math.max(0, Number((el as { strokeWidth?: number }).strokeWidth) || 0);
  const tol = sw / 2 + STROKE_SLACK_PX / z;
  const filled = !isTransparent((el as { backgroundColor?: string }).backgroundColor);
  const pts = pointsOf(el);
  if (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw' || pts) {
    if (!pts) return false;
    const abs = pts.map(([px, py]) => [el.x + px, el.y + py] as const);
    if (abs.length === 1) return Math.hypot(p.x - abs[0][0], p.y - abs[0][1]) <= tol;
    for (let i = 1; i < abs.length; i++) {
      if (distToSegment(p.x, p.y, abs[i - 1][0], abs[i - 1][1], abs[i][0], abs[i][1]) <= tol) return true;
    }
    const first = abs[0];
    const last = abs[abs.length - 1];
    const closed = Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6;
    return closed && filled && insidePolygon(p.x, p.y, abs);
  }
  const shape = el.type === 'ellipse' || el.type === 'diamond' || el.type === 'rectangle';
  const rx = (x2 - x1) / 2;
  const ry = (y2 - y1) / 2;
  const cx = x1 + rx;
  const cy = y1 + ry;
  if (!shape || filled) {
    if (p.x < x1 || p.x > x2 || p.y < y1 || p.y > y2) return false;
    if (!shape || el.type === 'rectangle') return true;
    if (!rx || !ry) return false;
    if (el.type === 'ellipse') return ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1;
    return Math.abs(p.x - cx) / rx + Math.abs(p.y - cy) / ry <= 1;
  }
  // Sin relleno: el texto que lleva dentro, o el trazo.
  const bound = (el as { boundElements?: readonly { id: string; type: string }[] | null }).boundElements ?? [];
  for (const b of bound) {
    const t = b.type === 'text' ? byId?.get(b.id) : undefined;
    if (t && !t.isDeleted && inside(boxOf(t), x, y)) return true;
  }
  if (el.type === 'rectangle') {
    const out = p.x >= x1 - tol && p.x <= x2 + tol && p.y >= y1 - tol && p.y <= y2 + tol;
    const deep = p.x > x1 + tol && p.x < x2 - tol && p.y > y1 + tol && p.y < y2 - tol;
    return out && !deep;
  }
  if (!rx || !ry) return false;
  if (el.type === 'ellipse') {
    const r = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
    return Math.abs(r - 1) * Math.min(rx, ry) <= tol;
  }
  const d = Math.abs(p.x - cx) / rx + Math.abs(p.y - cy) / ry;
  return (Math.abs(d - 1) * rx * ry) / Math.hypot(rx, ry) <= tol;
}

const framesOf = (elements: readonly SceneElement[]) =>
  new Map(elements.filter((el) => (el.type === 'frame' || el.type === 'magicframe') && !el.isDeleted).map((el) => [el.id, boxOf(el)]));

/** Lo de más arriba que se puede coger bajo el punto, tal como se ve. */
function topAt(elements: readonly SceneElement[], point: { x: number; y: number }, zoom = 1): SceneElement | null {
  const frames = framesOf(elements);
  const byId = new Map(elements.map((el) => [el.id, el]));
  let top: SceneElement | null = null;
  for (const el of elements) {
    if (!grabbable(el) || !under(el, point.x, point.y, zoom, byId)) continue;
    // Lo de una página solo se ve dentro de ella (el marco recorta).
    const frame = el.frameId ? frames.get(el.frameId) : null;
    if (frame && !inside(frame, point.x, point.y)) continue;
    top = el;
  }
  return top;
}

const outerGroup = (el: SceneElement): string | null => {
  const g = el.groupIds ?? [];
  return g.length ? g[g.length - 1] : null;
};

/**
 * ¿Está el punto sobre un asa de la selección? Entonces escala o gira lo
 * seleccionado, como siempre. Las de Excalidraw: las esquinas en diagonal
 * fuera de la caja, todo el borde (de 4 px dentro en una foto a 8 fuera en lo
 * demás) y el giro encima del centro de arriba.
 */
function onSelectionHandles(selected: readonly SceneElement[], point: { x: number; y: number }, zoom: number): boolean {
  if (!selected.length) return false;
  const z = zoom || 1;
  const boxes = selected.map(boxOf);
  const x1 = Math.min(...boxes.map((b) => b[0]));
  const y1 = Math.min(...boxes.map((b) => b[1]));
  const x2 = Math.max(...boxes.map((b) => b[2]));
  const y2 = Math.max(...boxes.map((b) => b[3]));
  const { x, y } = point;
  const zone = HANDLE_ZONE_PX / z;
  for (const [cx, cy] of [[x1, y1], [x2, y1], [x1, y2], [x2, y2]]) {
    if (Math.abs(x - cx) <= zone && Math.abs(y - cy) <= zone) return true;
  }
  const reach = 10 / z;
  const inner = 5 / z;
  const near = x >= x1 - reach && x <= x2 + reach && y >= y1 - reach && y <= y2 + reach;
  const deep = x > x1 + inner && x < x2 - inner && y > y1 + inner && y < y2 - inner;
  if (near && !deep) return true;
  return Math.abs(x - (x1 + x2) / 2) <= 12 / z && y <= y1 && y >= y1 - 36 / z;
}

/** Lo que hay que dejar seleccionado antes de que Excalidraw vea el clic. */
export interface VisiblePick {
  /** Lo que se ve bajo el puntero. */
  id: string;
  selectedElementIds: Record<string, true>;
  selectedGroupIds: Record<string, true>;
}

const trueOnly = (ids: Readonly<Record<string, boolean>>): Record<string, true> =>
  Object.fromEntries(Object.entries(ids).filter(([, v]) => v).map(([k]) => [k, true as const]));

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
export function pickVisible(
  elements: readonly SceneElement[],
  state: {
    selectedElementIds: Readonly<Record<string, boolean>>;
    selectedGroupIds?: Readonly<Record<string, boolean>>;
    editingGroupId?: string | null;
  },
  point: { x: number; y: number },
  zoom: number,
): VisiblePick | null {
  const z = zoom || 1;
  const selected = elements.filter((el) => !el.isDeleted && state.selectedElementIds[el.id]);
  // Una página seleccionada se arrastra entera: eso es cosa de Excalidraw.
  if (selected.some((el) => el.type === 'frame' || el.type === 'magicframe')) return null;
  if (onSelectionHandles(selected, point, z)) return null;
  const top = topAt(elements, point, z);
  if (!top) return null;
  // Una foto escala desde su borde por dentro (su selección va pegada): ahí, ya
  // seleccionada, Excalidraw la escalaría en vez de moverla.
  if (top.type === 'image') {
    const p = local(top, point.x, point.y);
    const m = 5 / z;
    if (p.x < p.box[0] + m || p.x > p.box[2] - m || p.y < p.box[1] + m || p.y > p.box[3] - m) return null;
  }
  // ¿Hay por encima algo que Excalidraw cogería por su margen?
  const frames = framesOf(elements);
  const reach = EXCALIDRAW_HIT_PX / z;
  const group = outerGroup(top);
  const grazed = elements.slice(elements.indexOf(top) + 1).some((el) => {
    if (el.isDeleted || el.locked || el.type === 'frame' || el.type === 'magicframe' || isPageBackground(el)) return false;
    if ((el as { containerId?: string | null }).containerId) return false;
    if (group && outerGroup(el) === group) return false;
    const [x1, y1, x2, y2] = boxOf(el);
    if (!(point.x >= x1 - reach && point.x <= x2 + reach && point.y >= y1 - reach && point.y <= y2 + reach)) return false;
    const frame = el.frameId ? frames.get(el.frameId) : null;
    return !frame || inside(frame, point.x, point.y);
  });
  if (!grazed) return null;
  // Ya seleccionado (solo o con más): se arrastra lo seleccionado, tal cual.
  if (state.selectedElementIds[top.id]) {
    return { id: top.id, selectedElementIds: trueOnly(state.selectedElementIds), selectedGroupIds: trueOnly(state.selectedGroupIds ?? {}) };
  }
  // De un grupo: se coge el grupo entero, salvo dentro del grupo que se edita.
  const editing = state.editingGroupId ?? null;
  if (group && !(editing && (top.groupIds ?? []).includes(editing))) {
    const ids: Record<string, true> = {};
    for (const el of elements) if (!el.isDeleted && (el.groupIds ?? []).includes(group)) ids[el.id] = true;
    return { id: top.id, selectedElementIds: ids, selectedGroupIds: { [group]: true } };
  }
  return { id: top.id, selectedElementIds: { [top.id]: true }, selectedGroupIds: {} };
}

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
export function pickOverPageEdge(
  elements: readonly SceneElement[],
  selectedElementIds: Readonly<Record<string, boolean>>,
  point: { x: number; y: number },
  zoom: number,
): string | null {
  const zone = HANDLE_ZONE_PX / (zoom || 1);
  const nearEdge = elements.some((el) => {
    if (el.isDeleted || (el.type !== 'frame' && el.type !== 'magicframe')) return false;
    const [x1, y1, x2, y2] = boxOf(el);
    const within = point.x >= x1 - zone && point.x <= x2 + zone && point.y >= y1 - zone && point.y <= y2 + zone;
    const deep = point.x > x1 + zone && point.x < x2 - zone && point.y > y1 + zone && point.y < y2 - zone;
    return within && !deep;
  });
  if (!nearEdge) return null;
  const top = topAt(elements, point, zoom);
  if (!top || selectedElementIds[top.id]) return null;
  return top.id;
}
