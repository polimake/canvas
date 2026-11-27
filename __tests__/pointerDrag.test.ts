// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { startPointerDrag } from '../src/ui/shared/pointerDrag';

/** Un evento de puntero sobre `window` (jsdom no siempre trae `PointerEvent`). */
function puntero(tipo: string, x: number, y: number, pointerId = 1) {
  const ev = new MouseEvent(tipo, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'pointerId', { value: pointerId });
  window.dispatchEvent(ev);
}

function empezar(x = 10, y = 10) {
  const h = { onStart: vi.fn(), onMove: vi.fn(), onDrop: vi.fn(), onCancel: vi.fn() };
  startPointerDrag({ button: 0, pointerId: 1, clientX: x, clientY: y } as unknown as React.PointerEvent, h);
  return h;
}

describe('startPointerDrag (desktop#371)', () => {
  it('un clic sin moverse no arrastra ni se traga el clic', () => {
    const h = empezar();
    puntero('pointermove', 12, 11);
    puntero('pointerup', 12, 11);
    expect(h.onStart).not.toHaveBeenCalled();
    expect(h.onDrop).not.toHaveBeenCalled();
    const clic = vi.fn();
    document.body.addEventListener('click', clic);
    document.body.click();
    expect(clic).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('click', clic);
  });

  it('pasado el umbral arrastra, sigue al puntero y suelta donde acaba', () => {
    const h = empezar();
    puntero('pointermove', 10, 30);
    puntero('pointermove', 10, 60);
    puntero('pointerup', 10, 60);
    expect(h.onStart).toHaveBeenCalledWith(10, 10);
    expect(h.onMove).toHaveBeenLastCalledWith(10, 60);
    expect(h.onDrop).toHaveBeenCalledWith(10, 60);
    // Tras soltar, el clic que manda el navegador no selecciona.
    const clic = vi.fn();
    document.body.addEventListener('click', clic);
    document.body.click();
    expect(clic).not.toHaveBeenCalled();
    document.body.removeEventListener('click', clic);
    // Y no deja escuchas colgadas.
    puntero('pointermove', 10, 90);
    expect(h.onMove).toHaveBeenCalledTimes(2);
  });

  it('Escape cancela sin soltar', () => {
    const h = empezar();
    puntero('pointermove', 40, 10);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    puntero('pointerup', 40, 10);
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    expect(h.onDrop).not.toHaveBeenCalled();
    expect(document.body.style.userSelect).toBe('');
  });

  it('ignora otro puntero y el botón derecho', () => {
    const h = empezar();
    puntero('pointermove', 90, 90, 2);
    expect(h.onStart).not.toHaveBeenCalled();
    const d = { onStart: vi.fn(), onMove: vi.fn(), onDrop: vi.fn(), onCancel: vi.fn() };
    startPointerDrag({ button: 2, pointerId: 3, clientX: 0, clientY: 0 } as unknown as React.PointerEvent, d);
    puntero('pointermove', 90, 90, 3);
    expect(d.onStart).not.toHaveBeenCalled();
    puntero('pointerup', 90, 90, 1);
  });
});
