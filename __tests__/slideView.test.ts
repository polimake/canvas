import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { fitBoxInRect, boxOnScreen, fitPageInRect, SLIDE_COVERAGE } = await import('../src/core/slideView.js');
const { maskBands } = await import('../src/ui/workspaces/slides/SlideMask.js');

describe('encuadre de una diapositiva en el hueco', () => {
  const stage = { left: 224, top: 102, width: 1000, height: 600 };

  it('la deja centrada en el hueco y al tamaño que cabe', () => {
    const box = { x: 2000, y: 0, width: 1920, height: 1080 };
    const view = fitBoxInRect(box, stage);
    const on = boxOnScreen(box, view);
    // Manda el lado que antes se llena: aquí el ancho (1000 × 0,94).
    expect(on.width).toBeCloseTo(stage.width * SLIDE_COVERAGE, 5);
    expect(on.left + on.width / 2).toBeCloseTo(stage.left + stage.width / 2, 5);
    expect(on.top + on.height / 2).toBeCloseTo(stage.top + stage.height / 2, 5);
  });

  it('una vertical se ajusta por el alto', () => {
    const box = { x: 0, y: 0, width: 1080, height: 1920 };
    const on = boxOnScreen(box, fitBoxInRect(box, stage));
    expect(on.height).toBeCloseTo(stage.height * SLIDE_COVERAGE, 5);
  });

  it('mueve la vista sin dejar paso de deshacer', () => {
    const fx = fakeApi([frame('p1', 0, 0, 1920, 1080), frame('p2', 1968, 0, 1920, 1080)]);
    expect(fitPageInRect(fx.api, 'p2', stage)).toBe(true);
    expect(fx.commits).toHaveLength(1);
    expect(fx.commits[0].captureUpdate).toBe('NEVER');
    expect(fx.commits[0].elements).toBeUndefined();
    expect(fitPageInRect(fx.api, 'no-existe', stage)).toBe(false);
  });
});

describe('máscara de las vecinas', () => {
  it('tapa el hueco menos la diapositiva, sin pisar las barras', () => {
    const stage = { left: 224, top: 102, width: 1000, height: 600 };
    const slide = { left: 254, top: 138, width: 940, height: 528 };
    const bands = maskBands(stage, slide, { top: 86, bottom: 900 });
    expect(bands).toHaveLength(4);
    for (const b of bands) {
      expect(b.left).toBeGreaterThanOrEqual(stage.left);
      expect(b.left + b.width).toBeLessThanOrEqual(stage.left + stage.width);
      expect(b.top).toBeGreaterThanOrEqual(86);
      // Ninguna franja cae encima de la diapositiva.
      const overlapW = Math.min(b.left + b.width, slide.left + slide.width) - Math.max(b.left, slide.left);
      const overlapH = Math.min(b.top + b.height, slide.top + slide.height) - Math.max(b.top, slide.top);
      expect(overlapW > 0 && overlapH > 0).toBe(false);
    }
  });

  it('con la diapositiva más grande que el hueco (zoom) no queda nada que tapar a los lados', () => {
    const stage = { left: 224, top: 102, width: 1000, height: 600 };
    const slide = { left: 100, top: 50, width: 2000, height: 1200 };
    const bands = maskBands(stage, slide, { top: 86, bottom: 900 });
    // Solo las franjas de fuera del hueco (barras arriba, notas abajo): nada a
    // los lados ni dentro del hueco.
    expect(bands).toHaveLength(2);
    for (const b of bands) {
      const inside = Math.min(b.top + b.height, stage.top + stage.height) - Math.max(b.top, stage.top);
      expect(inside).toBeLessThanOrEqual(0);
    }
  });
});
