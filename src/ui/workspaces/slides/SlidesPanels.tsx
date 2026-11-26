'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import type { ExcalidrawImperativeAPI } from '../../../core/excal';
import {
  getPageTransition,
  setPageTransition,
  SLIDE_TRANSITIONS,
  type SlideTransition,
} from '../../../core/slideMeta';
import type { WorkspacePanel } from '../types';
import type { Canvas2Labels } from '../../shared/labels';
import { SlidesIcon, panelIcon } from './icons';

/** Los paneles que salen en la tira de la derecha, en este orden. */
const RAIL_ORDER = ['components', 'elements', 'text', 'library', 'brand', 'layers', 'agent'];

export interface SlidesPanelsProps {
  api: ExcalidrawImperativeAPI;
  activePageId: string | null;
  panels: WorkspacePanel[];
  openPanel: string | null;
  onOpenPanel: (id: string | null) => void;
  labels: Canvas2Labels;
  /** «Detalles»: el host enseña los datos de la pieza (texto, comentarios). */
  onDetails?: () => void;
  detailsOpen?: boolean;
  /** «Importar tema»: solo si el host sabe hacerlo. */
  onImportTheme?: () => void;
}

/**
 * A la derecha, como en Slides: la tira de iconos y, al pulsar uno, su panel
 * entre la tira y el lienzo. Son los MISMOS paneles que el resto de espacios
 * (Canvas2.tsx los construye una vez); aquí solo cambia dónde se abren. Fondo
 * es el panel de la página (DesignPanel), Tema el de la marca (BrandGallery) y
 * Transición el único propio del espacio.
 */
export function SlidesPanels({
  api, activePageId, panels, openPanel, onOpenPanel, labels, onDetails, detailsOpen, onImportTheme,
}: SlidesPanelsProps) {
  const L = labels.slides;
  // Los nuestros en su orden, y detrás los del host (Comentarios, IA…). Fondo
  // (`design`) no va en la tira: se abre desde la barra y el menú Diapositiva.
  const rail = [
    ...RAIL_ORDER.map((id) => panels.find((p) => p.id === id)).filter((p): p is WorkspacePanel => Boolean(p)),
    ...panels.filter((p) => !RAIL_ORDER.includes(p.id) && p.id !== 'design'),
  ];

  const titleOf = (id: string, fallback: string) =>
    id === 'brand' ? L.theme : id === 'design' ? L.background : id === 'transition' ? L.transition : fallback;

  let open: { id: string; title: string; content: ReactNode } | null = null;
  if (openPanel === 'transition') {
    open = { id: 'transition', title: L.transition, content: <TransitionPanel api={api} pageId={activePageId} labels={labels} /> };
  } else if (openPanel) {
    const panel = panels.find((p) => p.id === openPanel);
    if (panel) open = { id: panel.id, title: titleOf(panel.id, panel.title), content: panel.content };
  }

  return (
    <>
      {open && (
        <section className="canvas2-slides-panel" aria-label={open.title}>
          <header className="canvas2-slides-panel-head">
            <span className="canvas2-slides-panel-icon">{open.id === 'transition' ? <SlidesIcon.transition /> : open.id === 'design' ? <SlidesIcon.background /> : panelIcon(open.id)}</span>
            <h2>{open.title}</h2>
            <button type="button" className="canvas2-slides-icon-btn" aria-label={L.closePanel} title={L.closePanel}
              onClick={() => onOpenPanel(null)}>
              <SlidesIcon.close />
            </button>
          </header>
          <div className="canvas2-slides-panel-body">{open.content}</div>
          {open.id === 'brand' && onImportTheme && (
            <footer className="canvas2-slides-panel-foot">
              <button type="button" className="canvas2-slides-primary" onClick={onImportTheme}>{L.importTheme}</button>
              <span>{L.importThemeHint}</span>
            </footer>
          )}
        </section>
      )}
      <nav className="canvas2-slides-rail" aria-label={L.panels}>
        {rail.map((panel) => (
          <button key={panel.id} type="button" aria-pressed={openPanel === panel.id} disabled={panel.locked}
            onClick={() => onOpenPanel(openPanel === panel.id ? null : panel.id)}>
            {RAIL_ORDER.includes(panel.id) ? panelIcon(panel.id) : panel.icon ?? panelIcon(panel.id)}
            <span>{panel.id === 'brand' ? labels.workspace.brand : panel.title}</span>
          </button>
        ))}
        {onDetails && (
          <button type="button" className="canvas2-slides-rail-end" aria-pressed={detailsOpen ?? undefined} onClick={onDetails}>
            <SlidesIcon.details />
            <span>{L.details}</span>
          </button>
        )}
      </nav>
    </>
  );
}

/** Transición de la diapositiva activa, y «aplicar a todas». */
function TransitionPanel({ api, pageId, labels }: { api: ExcalidrawImperativeAPI; pageId: string | null; labels: Canvas2Labels }) {
  const L = labels.slides;
  // Un grupo de opciones por panel: con dos editores en la página, compartían uno.
  const grupo = `canvas2-slide-transition-${useId()}`;
  const [value, setValue] = useState<SlideTransition>(() => (pageId ? getPageTransition(api, pageId) : 'none'));
  useEffect(() => {
    if (!pageId) return;
    // Solo si cambia la escena: `onChange` llega con cada movimiento del puntero.
    let lastElements: unknown = null;
    const read = () => {
      const elements = api.getSceneElements();
      if (elements === lastElements) return;
      lastElements = elements;
      setValue(getPageTransition(api, pageId));
    };
    read();
    return api.onChange(read);
  }, [api, pageId]);
  const names: Record<SlideTransition, string> = { none: L.transitionNone, fade: L.transitionFade };
  return (
    <div className="canvas2-slides-transition">
      <div role="radiogroup" aria-label={L.transition}>
        {SLIDE_TRANSITIONS.map((t) => (
          <label key={t} className="canvas2-slides-radio">
            <input type="radio" name={grupo} checked={value === t} disabled={!pageId}
              onChange={() => { if (pageId) setPageTransition(api, pageId, t); }} />
            <span>{names[t]}</span>
          </label>
        ))}
      </div>
      <button type="button" className="canvas2-slides-secondary" onClick={() => setPageTransition(api, null, value)}>
        {L.transitionApplyAll}
      </button>
    </div>
  );
}
