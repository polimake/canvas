'use client';

import { useEffect, useRef } from 'react';
import type { DeckSlide } from './useDeck';
import type { Canvas2Labels } from '../../shared/labels';
import { SlidesIcon } from './icons';

export interface SlidesGridProps {
  slides: DeckSlide[];
  activeId: string | null;
  thumbs: Record<string, string>;
  labels: Canvas2Labels;
  /** Abre la diapositiva y vuelve a la vista de una. */
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onContextMenu: (id: string, at: { x: number; y: number }) => void;
  onBack: () => void;
}

/** Vista de cuadrícula (Ver › Vista de cuadrícula): todas las diapositivas de un vistazo. */
export function SlidesGrid({ slides, activeId, thumbs, labels, onOpen, onSelect, onContextMenu, onBack }: SlidesGridProps) {
  const L = labels.slides;
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus({ preventScroll: false });
  }, []);
  return (
    <div ref={ref} className="canvas2-slides-grid" role="region" aria-label={L.gridView}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onBack();
        }
      }}>
      <div className="canvas2-slides-grid-head">
        <h2>{L.slideCount(slides.length)}</h2>
        <button type="button" className="canvas2-slides-secondary" onClick={onBack}>{L.backToSlide}</button>
      </div>
      <ol className="canvas2-slides-grid-list">
        {slides.map((slide, i) => (
          <li key={slide.id}>
            <button type="button" className="canvas2-slides-thumb"
              aria-label={slide.skipped ? `${L.slideN(i + 1)} · ${L.skipped}` : L.slideN(i + 1)}
              aria-current={slide.id === activeId ? 'true' : undefined}
              data-skipped={slide.skipped ? '' : undefined}
              style={{ aspectRatio: `${slide.width} / ${slide.height}` }}
              onClick={() => onSelect(slide.id)}
              onDoubleClick={() => onOpen(slide.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onOpen(slide.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onSelect(slide.id);
                onContextMenu(slide.id, { x: e.clientX, y: e.clientY });
              }}>
              {thumbs[slide.id] ? <img src={thumbs[slide.id]} alt="" draggable={false} /> : null}
              {slide.skipped && <span className="canvas2-slides-thumb-skip"><SlidesIcon.eyeOff /></span>}
            </button>
            <span className="canvas2-slides-grid-number">{i + 1}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
