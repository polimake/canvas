/**
 * Pulsar coge lo que se ve, como en Canva (ver core/pick.ts): lo decide el
 * lienzo antes que Excalidraw, en captura, y lo deja hecho al soltar.
 *
 * Excalidraw no deja elegir qué coge un clic, pero da prioridad a lo
 * seleccionado: si al pulsar ya está seleccionado lo que se ve, lo arrastra a
 * ello. Por eso el lienzo selecciona antes (con `flushSync`, porque Excalidraw
 * lee su estado en ese mismo evento). Lo que no hace es dejarlo seleccionado si
 * se suelta sin arrastrar: al soltar elige lo que él habría cogido. Así que,
 * tras su `pointerup`, el lienzo vuelve a dejar seleccionado lo que se ve. Va en
 * la misma tanda de eventos, antes del `dblclick`: un doble clic sobre un texto
 * edita ese texto y no lo que roza por encima.
 *
 * El orden importa. Excalidraw registra su `pointerup` en `window` al pulsar,
 * desde su manejador de React; el del lienzo se registra en `window` al burbujear
 * el mismo `pointerdown`, que llega después: corre detrás del suyo, cuando su
 * selección ya está puesta.
 */
import { flushSync } from 'react-dom';
import { CaptureUpdateAction, type ExcalidrawImperativeAPI } from '../../core/excal';
import { pickOverPageEdge, pickOverSelection, pickVisible } from '../../core/pick';

type Ids = Record<string, true>;

export function installCanvaPick(root: HTMLElement, api: ExcalidrawImperativeAPI, win: Window = window): () => void {
  let disarm: (() => void) | null = null;
  const drop = () => {
    disarm?.();
    disarm = null;
  };

  const select = (ids: Ids, groups: Ids, keepLinear: string | null) => {
    const s = api.getAppState();
    // El editor de puntos de una línea que deja de estar seleccionada se va con ella.
    const stale = !!s.selectedLinearElement && s.selectedLinearElement.elementId !== keepLinear;
    flushSync(() => {
      if (stale) {
        api.updateScene({
          appState: { selectedElementIds: ids, selectedGroupIds: groups, selectedLinearElement: null },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
      } else {
        api.updateScene({
          appState: { selectedElementIds: ids, selectedGroupIds: groups },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
      }
    });
  };

  /** Tras el `pointerup` de Excalidraw: si eligió otra cosa, vuelve lo que se ve. */
  const arm = (down: PointerEvent, id: string) => {
    const s = api.getAppState();
    const ids = { ...(s.selectedElementIds as Record<string, boolean>) };
    const groups = { ...(s.selectedGroupIds as Record<string, boolean>) };
    const want: Ids = Object.fromEntries(Object.keys(ids).filter((k) => ids[k]).map((k) => [k, true as const]));
    const wantGroups: Ids = Object.fromEntries(Object.keys(groups).filter((k) => groups[k]).map((k) => [k, true as const]));
    const onUp = () => {
      drop();
      // En una microtarea: la selección que Excalidraw pone al soltar ya está
      // en su estado (React la vuelca al acabar su manejador).
      queueMicrotask(() => {
        const now = api.getAppState();
        if (now.selectedElementIds[id] || now.editingTextElement || now.activeTool.type !== 'selection') return;
        select(want, wantGroups, id);
      });
    };
    const afterDown = (ev: Event) => {
      if (ev !== down) return;
      win.removeEventListener('pointerdown', afterDown);
      win.addEventListener('pointerup', onUp);
    };
    win.addEventListener('pointerdown', afterDown);
    win.addEventListener('pointercancel', drop);
    disarm = () => {
      win.removeEventListener('pointerdown', afterDown);
      win.removeEventListener('pointerup', onUp);
      win.removeEventListener('pointercancel', drop);
    };
  };

  const onDown = (ev: PointerEvent) => {
    drop();
    if (ev.button !== 0 || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const target = ev.target;
    if (!(target instanceof HTMLCanvasElement) || !target.classList.contains('interactive')) return;
    const s = api.getAppState();
    if (s.activeTool.type !== 'selection' || s.editingTextElement || s.croppingElementId) return;
    const z = s.zoom.value;
    const point = { x: (ev.clientX - s.offsetLeft) / z - s.scrollX, y: (ev.clientY - s.offsetTop) / z - s.scrollY };
    const elements = api.getSceneElements();
    // Lo de encima manda aunque haya otra cosa seleccionada debajo: se quita
    // la selección y Excalidraw hace lo de siempre sin ella.
    if (pickOverSelection(elements, s.selectedElementIds, point, z)) select({}, {}, null);
    // Lo que se ve, aunque algo de encima lo roce por el margen de Excalidraw.
    const visible = pickVisible(elements, api.getAppState(), point, z);
    if (visible) {
      select(visible.selectedElementIds, visible.selectedGroupIds, visible.id);
      arm(ev, visible.id);
      return;
    }
    // Pegado al borde de una página: seleccionado antes, Excalidraw lo
    // arrastra a él y no a la página.
    const edge = pickOverPageEdge(elements, api.getAppState().selectedElementIds, point, z);
    if (!edge) return;
    select({ [edge]: true }, {}, edge);
    arm(ev, edge);
  };

  root.addEventListener('pointerdown', onDown, true);
  return () => {
    drop();
    root.removeEventListener('pointerdown', onDown, true);
  };
}
