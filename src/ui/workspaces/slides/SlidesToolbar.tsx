'use client';

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SlidesMenu, type MenuEntry } from './SlidesMenu';
import { SlidesIcon } from './icons';
import type { Canvas2Labels } from '../../shared/labels';

export type SlidesTool = 'selection' | 'text' | 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow';

/** Paneles que se abren desde la barra (a la derecha, en la tira de paneles). */
export type ToolbarPanel = 'design' | 'components' | 'brand' | 'transition';

export interface SlidesToolbarProps {
  labels: Canvas2Labels;
  activeTool: string;
  /**
   * Excalidraw enseña sus opciones de formato (con selección o con una
   * herramienta de dibujo): ocupan el hueco derecho de la barra.
   */
  formatting: boolean;
  zoom: number;
  openPanel: string | null;
  /** Qué paneles existen (los da el host): sin el panel, sin botón. */
  available: Partial<Record<ToolbarPanel | 'library' | 'search' | 'comment', boolean>>;
  menusHidden: boolean;
  viewMode?: boolean;
  onSearch: () => void;
  onNewSlide: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomFit: () => void;
  onZoomTo: (zoom: number) => void;
  onZoomStep: (dir: 1 | -1) => void;
  onTool: (tool: SlidesTool) => void;
  onImage: () => void;
  onComment?: () => void;
  onPanel: (panel: ToolbarPanel) => void;
  onToggleMenus: () => void;
  /**
   * Ancho de la parte fija (de la lupa al comentario). Las opciones de formato
   * de Excalidraw se colocan justo detrás (slides.css, `--slides-props-left`).
   */
  onFixedWidth: (px: number) => void;
}

type Dropdown = 'new' | 'zoom' | 'shape' | 'line';

const SHAPES: SlidesTool[] = ['rectangle', 'ellipse', 'diamond'];
const LINES: SlidesTool[] = ['line', 'arrow'];

/**
 * La barra de herramientas del espacio Presentación: la píldora de Slides.
 *
 * Izquierda fija (buscar, nueva, deshacer, zoom, herramientas); a la derecha,
 * sin selección, Fondo · Componentes · Tema · Transición, y con selección, las
 * opciones de formato NATIVAS de Excalidraw, que el CSS coloca en ese hueco: son
 * las que saben qué propiedades tiene cada elemento y cómo deshacerlas.
 */
export function SlidesToolbar(props: SlidesToolbarProps) {
  const { labels, activeTool, formatting, zoom, openPanel, available, menusHidden, viewMode } = props;
  const L = labels.slides;
  const fixedRef = useRef<HTMLDivElement | null>(null);
  const [dropdown, setDropdown] = useState<{ id: Dropdown; left: number } | null>(null);
  const [lastShape, setLastShape] = useState<SlidesTool>('rectangle');
  const [lastLine, setLastLine] = useState<SlidesTool>('line');
  const pillRef = useRef<HTMLDivElement | null>(null);
  const closeDropdown = useCallback(() => setDropdown(null), []);
  const pillElement = useCallback(() => pillRef.current, []);

  useLayoutEffect(() => {
    const el = fixedRef.current;
    if (!el) return;
    const report = () => props.onFixedWidth(el.getBoundingClientRect().width);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
    // Solo al montar: el callback lo da el padre y no cambia de función útil.
  }, []);

  const open = (id: Dropdown, button: HTMLElement) => {
    const bar = button.closest('.canvas2-slides-toolbar')?.getBoundingClientRect();
    const r = button.getBoundingClientRect();
    setDropdown((d) => (d?.id === id ? null : { id, left: r.left - (bar?.left ?? 0) }));
  };

  const toolButton = (tool: SlidesTool, label: string, icon: ReactNode) => (
    <button type="button" className="canvas2-slides-icon-btn" aria-label={label} title={label}
      aria-pressed={activeTool === tool} disabled={viewMode} onClick={() => props.onTool(tool)}>
      {icon}
    </button>
  );

  const shapeIcon = (tool: SlidesTool) =>
    tool === 'ellipse' ? <SlidesIcon.ellipse /> : tool === 'diamond' ? <SlidesIcon.diamond /> : <SlidesIcon.shape />;
  const shapeLabel = (tool: SlidesTool) =>
    tool === 'ellipse' ? L.ellipse : tool === 'diamond' ? L.diamond : L.rectangle;

  const dropdownItems: Record<Dropdown, MenuEntry[]> = {
    new: [
      { label: L.newSlide, icon: <SlidesIcon.plus />, onSelect: props.onNewSlide },
      ...(available.components
        ? [{ label: L.applyComponent, icon: <SlidesIcon.layout />, onSelect: () => props.onPanel('components') }]
        : []),
    ],
    zoom: [
      { label: L.zoomFit, onSelect: props.onZoomFit },
      { kind: 'separator' },
      ...[0.5, 1, 2].map((z) => ({ label: `${z * 100} %`, checked: Math.abs(zoom - z) < 0.005, onSelect: () => props.onZoomTo(z) })),
      { kind: 'separator' },
      { label: L.zoomIn, onSelect: () => props.onZoomStep(1) },
      { label: L.zoomOut, onSelect: () => props.onZoomStep(-1) },
    ],
    shape: SHAPES.map((tool) => ({
      label: shapeLabel(tool),
      icon: shapeIcon(tool),
      checked: activeTool === tool,
      onSelect: () => { setLastShape(tool); props.onTool(tool); },
    })),
    line: LINES.map((tool) => ({
      label: tool === 'arrow' ? L.arrow : L.line,
      icon: tool === 'arrow' ? <SlidesIcon.arrow /> : <SlidesIcon.line />,
      checked: activeTool === tool,
      onSelect: () => { setLastLine(tool); props.onTool(tool); },
    })),
  };

  const panelButton = (panel: ToolbarPanel, label: string) =>
    available[panel] ? (
      <button key={panel} type="button" className="canvas2-slides-text-btn"
        aria-pressed={openPanel === panel} disabled={viewMode} onClick={() => props.onPanel(panel)}>
        {label}
      </button>
    ) : null;

  const rightGroup = [
    panelButton('design', L.background),
    panelButton('components', L.components),
    panelButton('brand', L.theme),
    panelButton('transition', L.transition),
  ].filter(Boolean);

  return (
    <div className="canvas2-slides-toolbar" data-menus-hidden={menusHidden ? '' : undefined}>
      <div ref={pillRef} className="canvas2-slides-pill" role="toolbar" aria-label={L.toolbar}>
        <div ref={fixedRef} className="canvas2-slides-pill-fixed">
          {available.search && (
            <button type="button" className="canvas2-slides-icon-btn" aria-label={L.search} title={L.search} onClick={props.onSearch}>
              <SlidesIcon.search />
            </button>
          )}
          {/* Al mirar se ve la barra entera, igual que al editar, pero lo que
              cambia la presentación va apagado. */}
          <span className="canvas2-slides-split">
            <button type="button" className="canvas2-slides-icon-btn" aria-label={L.newSlide} title={L.newSlide}
              disabled={viewMode} onClick={props.onNewSlide}>
              <SlidesIcon.plus />
            </button>
            <button type="button" className="canvas2-slides-caret-btn" aria-label={L.newSlide} aria-haspopup="menu"
              aria-expanded={dropdown?.id === 'new'} disabled={viewMode} onClick={(e) => open('new', e.currentTarget)}>
              <SlidesIcon.caret />
            </button>
          </span>
          <button type="button" className="canvas2-slides-icon-btn" aria-label={L.undo} title={L.undo}
            disabled={viewMode} onClick={props.onUndo}>
            <SlidesIcon.undo />
          </button>
          <button type="button" className="canvas2-slides-icon-btn" aria-label={L.redo} title={L.redo}
            disabled={viewMode} onClick={props.onRedo}>
            <SlidesIcon.redo />
          </button>
          <span className="canvas2-slides-divider" aria-hidden="true" />
          <button type="button" className="canvas2-slides-zoom-btn" aria-haspopup="menu"
            aria-expanded={dropdown?.id === 'zoom'} onClick={(e) => open('zoom', e.currentTarget)}>
            <SlidesIcon.zoom />
            <span>{L.zoomFit}</span>
            <SlidesIcon.caret />
          </button>
          <>
              <span className="canvas2-slides-divider" aria-hidden="true" />
              <button type="button" className="canvas2-slides-icon-btn canvas2-slides-tool-select" aria-label={L.select} title={L.select}
                aria-pressed={activeTool === 'selection'} disabled={viewMode} onClick={() => props.onTool('selection')}>
                <SlidesIcon.cursor />
              </button>
              {toolButton('text', L.textBox, <SlidesIcon.text />)}
              {available.library && (
                <button type="button" className="canvas2-slides-icon-btn" aria-label={L.image} title={L.image}
                  aria-pressed={openPanel === 'library'} disabled={viewMode} onClick={props.onImage}>
                  <SlidesIcon.image />
                </button>
              )}
              <span className="canvas2-slides-split">
                {toolButton(lastShape, shapeLabel(lastShape), shapeIcon(lastShape))}
                <button type="button" className="canvas2-slides-caret-btn" aria-label={L.shape} aria-haspopup="menu"
                  aria-expanded={dropdown?.id === 'shape'} disabled={viewMode} onClick={(e) => open('shape', e.currentTarget)}>
                  <SlidesIcon.caret />
                </button>
              </span>
              <span className="canvas2-slides-split">
                {toolButton(lastLine, lastLine === 'arrow' ? L.arrow : L.line, lastLine === 'arrow' ? <SlidesIcon.arrow /> : <SlidesIcon.line />)}
                <button type="button" className="canvas2-slides-caret-btn" aria-label={L.line} aria-haspopup="menu"
                  aria-expanded={dropdown?.id === 'line'} disabled={viewMode} onClick={(e) => open('line', e.currentTarget)}>
                  <SlidesIcon.caret />
                </button>
              </span>
              {available.comment && props.onComment && (
                <>
                  <span className="canvas2-slides-divider" aria-hidden="true" />
                  <button type="button" className="canvas2-slides-icon-btn" aria-label={L.comment} title={L.comment} onClick={props.onComment}>
                    <SlidesIcon.comment />
                  </button>
                </>
              )}
              <span className="canvas2-slides-divider" aria-hidden="true" />
          </>
        </div>
        {/* Sin selección, los paneles de la diapositiva; con selección, este hueco
            lo ocupan las opciones de formato de Excalidraw (slides.css). */}
        {!formatting && rightGroup.length > 0 && (
          <div className="canvas2-slides-pill-context">
            {rightGroup.map((button, i) => (
              <span key={i} className="canvas2-slides-pill-context-item">
                {i > 0 && <span className="canvas2-slides-divider canvas2-slides-divider--tight" aria-hidden="true" />}
                {button}
              </span>
            ))}
          </div>
        )}
        <button type="button" className="canvas2-slides-icon-btn canvas2-slides-pill-end"
          aria-label={menusHidden ? L.showMenus : L.hideMenus} title={menusHidden ? L.showMenus : L.hideMenus}
          onClick={props.onToggleMenus}>
          {menusHidden ? <SlidesIcon.chevronDown /> : <SlidesIcon.chevronUp />}
        </button>
      </div>
      {dropdown && (
        <SlidesMenu label={{ new: L.newSlide, zoom: L.zoomFit, shape: L.shape, line: L.line }[dropdown.id]} items={dropdownItems[dropdown.id]}
          onClose={closeDropdown} keepOpenWithin={pillElement}
          style={{ position: 'absolute', top: 44, left: dropdown.left }} />
      )}
    </div>
  );
}
