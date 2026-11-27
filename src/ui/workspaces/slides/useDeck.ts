import { useEffect, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '../../../core/excal';
import { listPages, type PageInfo } from '../../../core/pages';
import type { PageNames } from '../../../core/pageNames';
import { isSkippedFrame } from '../../../core/slideMeta';

export interface DeckSlide extends PageInfo {
  skipped: boolean;
}

export interface DeckState {
  slides: DeckSlide[];
  /** Hay algo seleccionado: la barra cambia a las opciones de formato. */
  hasSelection: boolean;
  /** La herramienta activa de Excalidraw (`selection`, `text`, `rectangle`…). */
  activeTool: string;
  /** Zoom actual, en tanto por uno. */
  zoom: number;
}

const EMPTY: DeckState = { slides: [], hasSelection: false, activeTool: 'selection', zoom: 1 };

/**
 * Lo que el cromo del espacio Presentación necesita saber de la escena, con UNA
 * suscripción. Solo avisa a React cuando cambia algo de esto: `onChange` se
 * dispara con cada movimiento del puntero y repintar la tira en cada uno se
 * notaría.
 */
export function useDeck(api: ExcalidrawImperativeAPI | null, names?: PageNames): DeckState {
  const [state, setState] = useState<DeckState>(EMPTY);
  const namesRef = useRef(names);
  namesRef.current = names;
  const keyRef = useRef('');

  useEffect(() => {
    if (!api) return;
    // La lista solo se recalcula si cambia el array de elementos: `onChange`
    // llega con cada movimiento del puntero y el array es el mismo entonces.
    // Ojo: Excalidraw cambia algunos elementos EN SITIO (redimensionar un
    // marco arrastrando) sin array nuevo; por eso cuenta también la suma de
    // versiones de los marcos, que es barata de rehacer.
    let lastElements: unknown = null;
    let frameList: { version: number }[] = [];
    let lastFrameVersions = -1;
    let slides: DeckSlide[] = [];
    let slidesKey = '';
    const refresh = () => {
      const elements = api.getSceneElements();
      const frameVersions = elements === lastElements
        ? frameList.reduce((sum, f) => sum + f.version, 0)
        : -2;
      if (elements !== lastElements || frameVersions !== lastFrameVersions) {
        lastElements = elements;
        const frameElements = elements.filter((e) => e.type === 'frame');
        frameList = frameElements;
        lastFrameVersions = frameList.reduce((sum, f) => sum + f.version, 0);
        const frames = new Map(frameElements.map((f) => [f.id, f]));
        slides = listPages(api, namesRef.current).map((p) => ({
          ...p,
          skipped: isSkippedFrame(frames.get(p.id) as never),
        }));
        // La posición cuenta: mover o insertar una diapositiva recoloca la fila,
        // y la activa tiene que volver a encajarse donde quede.
        slidesKey = slides.map((s) => `${s.id}:${s.name}:${s.width}x${s.height}@${Math.round(s.x)},${Math.round(s.y)}:${s.skipped ? 1 : 0}`).join('|');
      }
      const appState = api.getAppState();
      const hasSelection = Object.values(appState.selectedElementIds ?? {}).some(Boolean);
      const activeTool = String(appState.activeTool?.type ?? 'selection');
      const zoom = appState.zoom?.value ?? 1;
      const key = [slidesKey, hasSelection, activeTool, Math.round(zoom * 100)].join('#');
      if (key === keyRef.current) return;
      keyRef.current = key;
      setState({ slides, hasSelection, activeTool, zoom });
    };
    refresh();
    const offChange = api.onChange(refresh);
    // Hacer zoom no pasa por `onChange` en todas las versiones: también por aquí.
    const offScroll = api.onScrollChange?.(refresh);
    return () => {
      offChange();
      offScroll?.();
    };
  }, [api]);

  return state;
}
