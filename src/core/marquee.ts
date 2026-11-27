import { isPageBackground } from './pageModel';
import type { SceneBox } from './slideView';
import type { SceneElement } from './excal';

/**
 * Selección de recuadro de UNA página, hecha a mano.
 *
 * En Presentación, alrededor de la diapositiva hay franjas que tapan las
 * vecinas, y el recuadro de Excalidraw no puede empezar en ellas. Este coge,
 * como Excalidraw, lo que queda entero dentro del recuadro, pero solo de la
 * página activa: nunca algo de una vecina tapada.
 */
export interface MarqueeSelection {
  selectedElementIds: Record<string, true>;
  selectedGroupIds: Record<string, true>;
}

/** La caja de escena de un elemento, con el giro y los puntos de las líneas. Pura. */
export function elementSceneBounds(el: SceneElement): SceneBox {
  const points = (el as { points?: readonly (readonly [number, number])[] }).points;
  if (points && points.length) {
    const xs = points.map((p) => el.x + p[0]);
    const ys = points.map((p) => el.y + p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  const angle = el.angle ?? 0;
  if (!angle) return { x: el.x, y: el.y, width: el.width, height: el.height };
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [el.x, el.y], [el.x + el.width, el.y], [el.x, el.y + el.height], [el.x + el.width, el.y + el.height],
  ].map(([px, py]) => [cx + (px - cx) * cos - (py - cy) * sin, cy + (px - cx) * sin + (py - cy) * cos]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function inside(inner: SceneBox, outer: SceneBox): boolean {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

/**
 * Lo de la página `pageId` que queda entero dentro de `box`. Como Excalidraw:
 * sin lo bloqueado, sin el texto que va dentro de una forma (se coge con ella)
 * y un grupo entero si se coge algo suyo. Tampoco el fondo de la página.
 * `previous` (con Mayúsculas) se suma. Pura.
 */
export function selectInBox(
  elements: readonly SceneElement[],
  pageId: string,
  box: SceneBox,
  previous?: MarqueeSelection,
): MarqueeSelection {
  const members = elements.filter((e) => !e.isDeleted && e.frameId === pageId);
  const selectedElementIds: Record<string, true> = { ...(previous?.selectedElementIds ?? {}) };
  const selectedGroupIds: Record<string, true> = { ...(previous?.selectedGroupIds ?? {}) };
  for (const el of members) {
    if (el.locked || isPageBackground(el)) continue;
    if ((el as { containerId?: string | null }).containerId) continue;
    if (!inside(elementSceneBounds(el), box)) continue;
    const outer = el.groupIds?.length ? el.groupIds[el.groupIds.length - 1] : null;
    if (!outer) {
      selectedElementIds[el.id] = true;
      continue;
    }
    selectedGroupIds[outer] = true;
    for (const mate of members) {
      if (mate.groupIds?.includes(outer) && !(mate as { containerId?: string | null }).containerId) {
        selectedElementIds[mate.id] = true;
      }
    }
  }
  return { selectedElementIds, selectedGroupIds };
}
