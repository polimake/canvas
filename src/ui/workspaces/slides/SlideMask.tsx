'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { CaptureUpdateAction, type ExcalidrawImperativeAPI } from '../../../core/excal';
import { boxOnScreen, currentViewport, pageBox, type ScreenRect } from '../../../core/slideView';

export interface SlideMaskProps {
  api: ExcalidrawImperativeAPI;
  /** El envoltorio `[data-canvas2]`, para reenviar la rueda al lienzo. */
  rootRef: RefObject<HTMLDivElement | null>;
  activePageId: string | null;
  /** El hueco de la diapositiva (sin las barras, la tira, los paneles ni las notas). */
  stage: ScreenRect;
  /** Hasta dónde llegan las franjas de arriba y abajo: el borde de las barras y el del editor. */
  limits: { top: number; bottom: number };
}

/**
 * Las franjas que tapan las diapositivas vecinas con el color de la mesa.
 *
 * Componente aparte, con su propia suscripción al encuadre: se repinta en cada
 * movimiento de la vista y el resto del espacio (la tira con N miniaturas, la
 * barra, los paneles) no tiene por qué repintarse con él.
 */
export function SlideMask({ api, rootRef, activePageId, stage, limits }: SlideMaskProps) {
  const [slide, setSlide] = useState<ScreenRect | null>(null);
  const layer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let lastElements: unknown = null;
    let box = activePageId ? pageBox(api, activePageId) : null;
    const track = (fromChange: boolean) => {
      // En `onChange` (cada movimiento del puntero) solo se busca la caja si la
      // escena ha cambiado; en el scroll basta con la que ya se tiene.
      if (fromChange) {
        const elements = api.getSceneElements();
        if (elements !== lastElements) {
          lastElements = elements;
          box = activePageId ? pageBox(api, activePageId) : null;
        }
      }
      const next = box ? boxOnScreen(box, currentViewport(api)) : null;
      setSlide((prev) =>
        prev && next && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.top - next.top) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 ? prev : next,
      );
    };
    track(true);
    const offScroll = api.onScrollChange(() => track(false));
    const offChange = api.onChange(() => track(true));
    return () => { offScroll(); offChange(); };
  }, [api, activePageId]);

  // La rueda sobre la máscara mueve o acerca el lienzo, y no la página: React
  // registra `onWheel` como pasivo, así que hace falta un escuchador propio.
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.target as Element | null)?.closest?.('.canvas2-slides-mask')) return;
      e.preventDefault();
      forwardWheel(rootRef.current, e);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [rootRef]);

  const bands = slide ? maskBands(stage, slide, limits) : [];
  return (
    <div ref={layer} className="canvas2-slides-mask-layer" aria-hidden="true">
      {bands.map((band, i) => (
        <div key={i} className="canvas2-slides-mask" style={band}
          // Pulsar fuera de la diapositiva quita la selección (y no coge lo que
          // haya debajo, en una vecina tapada).
          onPointerDown={() => api.updateScene({ appState: { selectedElementIds: {} }, captureUpdate: CaptureUpdateAction.NEVER })} />
      ))}
    </div>
  );
}

/**
 * Las cuatro franjas que tapan lo que no es la diapositiva dentro del hueco
 * (las vecinas siguen ahí, en el mismo plano). Puro.
 */
export function maskBands(
  stage: ScreenRect,
  slide: ScreenRect,
  limits: { top: number; bottom: number },
): Array<{ left: number; top: number; width: number; height: number }> {
  const right = stage.left + stage.width;
  const bottom = stage.top + stage.height;
  const sTop = Math.max(stage.top, slide.top);
  const sBottom = Math.min(bottom, slide.top + slide.height);
  const sLeft = Math.max(stage.left, slide.left);
  const sRight = Math.min(right, slide.left + slide.width);
  const bands = [
    // Arriba y abajo, a lo ancho del hueco: desde las barras hasta el borde
    // del editor (las notas van encima de la de abajo).
    { left: stage.left, top: limits.top, width: stage.width, height: Math.max(0, sTop - limits.top) },
    { left: stage.left, top: sBottom, width: stage.width, height: Math.max(0, limits.bottom - sBottom) },
    // Izquierda y derecha, a la altura de la diapositiva.
    { left: stage.left, top: sTop, width: Math.max(0, sLeft - stage.left), height: Math.max(0, sBottom - sTop) },
    { left: sRight, top: sTop, width: Math.max(0, right - sRight), height: Math.max(0, sBottom - sTop) },
  ];
  return bands.filter((b) => b.width > 0 && b.height > 0);
}

/** Reenvía la rueda al lienzo de Excalidraw. */
function forwardWheel(root: HTMLElement | null, e: WheelEvent) {
  const target = root?.querySelector<HTMLElement>('.excalidraw__canvas.interactive') ?? root?.querySelector<HTMLElement>('canvas');
  if (!target) return;
  const View = target.ownerDocument.defaultView?.WheelEvent ?? WheelEvent;
  target.dispatchEvent(new View('wheel', e));
}
