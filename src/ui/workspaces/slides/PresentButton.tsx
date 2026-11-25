'use client';

import { useCallback, useRef, useState } from 'react';
import { SlidesMenu } from './SlidesMenu';
import { SlidesIcon } from './icons';
import type { Canvas2Labels } from '../../shared/labels';

export interface PresentButtonProps {
  labels: Canvas2Labels;
  shortcut: string;
  onPresent: (opts: { fromStart: boolean; presenter: boolean }) => void;
}

/**
 * «▶ Presentar ▾», arriba a la derecha como el «Presentación» de Slides: el
 * botón presenta desde la diapositiva activa y la flecha ofrece empezar por el
 * principio o con la vista del orador.
 */
export function PresentButton({ labels, shortcut, onPresent }: PresentButtonProps) {
  const L = labels.slides;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const within = useCallback(() => ref.current, []);
  return (
    <div ref={ref} className="canvas2-slides-present-btn">
      <button type="button" className="canvas2-slides-present-main" title={`${L.present} (${shortcut})`}
        onClick={() => onPresent({ fromStart: false, presenter: false })}>
        <SlidesIcon.play />
        <span>{L.present}</span>
      </button>
      <span className="canvas2-slides-present-split" aria-hidden="true" />
      <button type="button" className="canvas2-slides-present-caret" aria-label={L.presentOptions}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <SlidesIcon.caret />
      </button>
      {open && (
        <SlidesMenu label={L.presentOptions} onClose={close} keepOpenWithin={within}
          style={{ position: 'absolute', top: 34, right: 0 }}
          items={[
            { label: L.present, icon: <SlidesIcon.play />, shortcut, onSelect: () => onPresent({ fromStart: false, presenter: false }) },
            { label: L.presentFromStart, onSelect: () => onPresent({ fromStart: true, presenter: false }) },
            { label: L.presenterView, icon: <SlidesIcon.presenter />, onSelect: () => onPresent({ fromStart: false, presenter: true }) },
          ]} />
      )}
    </div>
  );
}
