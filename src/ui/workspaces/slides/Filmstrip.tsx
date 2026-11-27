'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { DeckSlide } from './useDeck';
import { SlidesIcon } from './icons';
import { startPointerDrag } from '../../shared/pointerDrag';
import type { Canvas2Labels } from '../../shared/labels';

export interface FilmstripProps {
  slides: DeckSlide[];
  activeId: string | null;
  /** pageId → URL de su miniatura (usePageThumbnails). */
  thumbs: Record<string, string>;
  labels: Canvas2Labels;
  viewMode?: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (id: string, at: { x: number; y: number }) => void;
  onMove: (id: string, toIndex: number) => void;
  onNewAfter: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveBy: (id: string, where: 'up' | 'down') => void;
  onGrid: () => void;
  onCollapse: () => void;
}

/**
 * La tira de diapositivas de la izquierda, como la de Slides: número, miniatura,
 * clic para ir, clic derecho para sus acciones, arrastrar para reordenar.
 *
 * El arrastre es HTML5 y el origen NO se oculta ni se desmonta mientras dura:
 * cualquiera de las dos cosas corta el arrastre sin aviso en Chrome (lo que ya
 * pasó en la tira de páginas). La juntura de destino se pinta aparte.
 */
/** Selector de una diapositiva por id (los ids de Excalidraw son seguros, pero no se supone). */
const slideSelector = (id: string) =>
  `[data-slide-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"')}"]`;

export function Filmstrip({
  slides, activeId, thumbs, labels, viewMode,
  onSelect, onContextMenu, onMove, onNewAfter, onDuplicate, onDelete, onMoveBy, onGrid, onCollapse,
}: FilmstripProps) {
  const L = labels.slides;
  const listRef = useRef<HTMLOListElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  /**
   * Una orden de teclado (Supr, Ctrl+D, Ctrl+M, mover) cambia la activa o
   * desmonta la miniatura con el foco: el foco tiene que seguir a la activa, o
   * la siguiente pulsación se pierde (borrar cinco seguidas, como en Slides).
   *
   * Es un plazo y no un sí/no: solo vale para el repintado que provoca ESA
   * tecla. Si la orden no cambia nada (borrar la única), caduca sola; si no,
   * el siguiente cambio cualquiera (dibujar en el lienzo) le robaría el foco al
   * lienzo, y un Supr para borrar un rectángulo borraría la diapositiva.
   */
  const followUntil = useRef(0);

  // La activa siempre a la vista (al cambiar desde el lienzo, Av Pág o el menú).
  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector<HTMLElement>(slideSelector(activeId))
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  // Al instante, no en el siguiente fotograma: con la tecla pulsada (o escrita
  // deprisa) la siguiente pulsación tiene que caer ya en la nueva miniatura.
  const focusSlide = (id: string) =>
    listRef.current?.querySelector<HTMLElement>(`${slideSelector(id)} button`)?.focus({ preventScroll: true });

  useEffect(() => {
    if (!activeId || Date.now() > followUntil.current) return;
    followUntil.current = 0;
    focusSlide(activeId);
  }, [activeId, slides]);

  const onKeyDown = (e: ReactKeyboardEvent, slide: DeckSlide, index: number) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const go = (i: number) => {
      const target = slides[Math.min(slides.length - 1, Math.max(0, i))];
      if (target && target.id !== slide.id) {
        onSelect(target.id);
        focusSlide(target.id);
      }
    };
    let handled = true;
    // Las que crean, borran o mueven: el foco irá a la activa cuando se pinte.
    const follow = () => { followUntil.current = Date.now() + 600; };
    const first = index === 0, last = index === slides.length - 1;
    if (ctrl && e.shiftKey && e.key === 'ArrowUp') { if (!viewMode && !first) { follow(); onMoveBy(slide.id, 'up'); } }
    else if (ctrl && e.shiftKey && e.key === 'ArrowDown') { if (!viewMode && !last) { follow(); onMoveBy(slide.id, 'down'); } }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') go(index + 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
    else if (ctrl && e.key.toLowerCase() === 'd') { if (!viewMode) { follow(); onDuplicate(slide.id); } }
    else if (ctrl && e.key.toLowerCase() === 'm') { if (!viewMode) { follow(); onNewAfter(slide.id); } }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (!viewMode && slides.length > 1) { follow(); onDelete(slide.id); } }
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onContextMenu(slide.id, { x: r.right - 8, y: r.top + 12 });
    } else handled = false;
    // Sin esto, el reenvío de teclado del lienzo (keyRouting.ts) le pasaría
    // Ctrl+D o Supr a Excalidraw, que duplicaría o borraría la SELECCIÓN.
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  /** Índice de destino según la altura del puntero sobre la lista. */
  const dropIndexAt = (clientY: number): number => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-slide-id]') ?? []);
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return items.length;
  };

  return (
    <aside className="canvas2-slides-filmstrip" aria-label={L.slides}>
      <ol ref={listRef} className="canvas2-slides-filmstrip-list">
        {slides.map((slide, index) => {
          const active = slide.id === activeId;
          const thumb = thumbs[slide.id];
          return (
            <li key={slide.id} data-slide-id={slide.id} className="canvas2-slides-filmstrip-item"
              data-drop-before={drag && drag.over === index && drag.id !== slide.id ? '' : undefined}
              data-drop-after={drag && drag.over === slides.length && index === slides.length - 1 ? '' : undefined}>
              <span className="canvas2-slides-filmstrip-number" aria-hidden="true">{index + 1}</span>
              <button type="button" className="canvas2-slides-thumb"
                aria-label={slide.skipped ? `${L.slideN(index + 1)} · ${L.skipped}` : L.slideN(index + 1)}
                aria-current={active ? 'true' : undefined}
                data-skipped={slide.skipped ? '' : undefined}
                style={{ aspectRatio: `${slide.width} / ${slide.height}` }}
                // Con punteros, no con el arrastre HTML5: en el escritorio la ventana
                // se queda los `dragover` y reordenar no hacía nada (desktop#371).
                onPointerDown={(e) => {
                  if (viewMode) return;
                  let over = index;
                  startPointerDrag(e, {
                    onStart: () => setDrag({ id: slide.id, over }),
                    onMove: (_x, y) => {
                      over = dropIndexAt(y);
                      setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
                    },
                    onDrop: () => {
                      setDrag(null);
                      const from = slides.findIndex((s) => s.id === slide.id);
                      // Soltar justo debajo de sí misma no la mueve: el índice cuenta la
                      // propia diapositiva, que deja hueco al salir.
                      const to = over > from ? over - 1 : over;
                      if (from >= 0 && to !== from) onMove(slide.id, to);
                    },
                    onCancel: () => setDrag(null),
                  });
                }}
                onClick={() => onSelect(slide.id)}
                onContextMenu={(e) => {
                  if (viewMode) return;
                  e.preventDefault();
                  onSelect(slide.id);
                  onContextMenu(slide.id, { x: e.clientX, y: e.clientY });
                }}
                onKeyDown={(e) => onKeyDown(e, slide, index)}>
                {thumb ? <img src={thumb} alt="" draggable={false} /> : null}
                {slide.skipped && <span className="canvas2-slides-thumb-skip"><SlidesIcon.eyeOff /></span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="canvas2-slides-filmstrip-foot">
        <button type="button" className="canvas2-slides-icon-btn" aria-label={L.gridView} title={L.gridView} onClick={onGrid}>
          <SlidesIcon.grid />
        </button>
        <button type="button" className="canvas2-slides-icon-btn" aria-label={L.hideFilmstrip} title={L.hideFilmstrip} onClick={onCollapse}>
          <SlidesIcon.chevronLeft />
        </button>
      </div>
    </aside>
  );
}
