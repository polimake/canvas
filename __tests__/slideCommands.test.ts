import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const {
  deleteSlide, duplicateSlide, moveSlide, newSlide, resizeAllSlides, toggleSkip, canDeleteSlide, shortcutLabel,
} = await import('../src/ui/workspaces/slides/slideCommands.js');
const { listPages } = await import('../src/core/pages.js');
const { isPageSkipped } = await import('../src/core/slideMeta.js');

const deck = () => fakeApi([
  frame('a', 0, 0, 1920, 1080, { customData: { c2page: { index: 0 } } }),
  frame('b', 1968, 0, 1920, 1080, { customData: { c2page: { index: 1 } } }),
  frame('c', 3936, 0, 1920, 1080, { customData: { c2page: { index: 2 } } }),
  member('t', 'b', 2000, 100, 400, 60, { type: 'text', fontSize: 40 }),
]);
const order = (fx: { api: any }) => listPages(fx.api).map((p) => p.id);

describe('órdenes de diapositiva', () => {
  it('nueva: detrás de la activa, del tamaño pedido y activa', () => {
    const fx = deck();
    const activate = vi.fn();
    newSlide(fx.api, 'a', { width: 1920, height: 1080 }, undefined, activate);
    const ids = order(fx);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe('a');
    expect(activate).toHaveBeenCalledWith(ids[1]);
    expect(listPages(fx.api)[1]).toMatchObject({ width: 1920, height: 1080 });
  });

  it('borrar la del medio activa la que queda en su sitio; borrar la última, la anterior', () => {
    const fx = deck();
    const activate = vi.fn();
    deleteSlide(fx.api, 'b', activate);
    expect(order(fx)).toEqual(['a', 'c']);
    expect(activate).toHaveBeenLastCalledWith('c');
    deleteSlide(fx.api, 'c', activate);
    expect(activate).toHaveBeenLastCalledWith('a');
  });

  it('nunca borra la única diapositiva', () => {
    const fx = fakeApi([frame('solo', 0, 0, 100, 100)]);
    const activate = vi.fn();
    deleteSlide(fx.api, 'solo', activate);
    expect(order(fx)).toEqual(['solo']);
    expect(activate).not.toHaveBeenCalled();
    expect(fx.commits).toHaveLength(0);
    expect(canDeleteSlide(listPages(fx.api))).toBe(false);
  });

  it('duplicar activa la copia, que va justo detrás', () => {
    const fx = deck();
    const activate = vi.fn();
    duplicateSlide(fx.api, 'b', undefined, activate);
    const ids = order(fx);
    expect(ids).toHaveLength(4);
    expect(ids.slice(0, 2)).toEqual(['a', 'b']);
    expect(activate).toHaveBeenCalledWith(ids[2]);
  });

  it('mover al principio, al final, subir y bajar', () => {
    const fx = deck();
    moveSlide(fx.api, 'c', 'start');
    expect(order(fx)).toEqual(['c', 'a', 'b']);
    moveSlide(fx.api, 'c', 'end');
    expect(order(fx)).toEqual(['a', 'b', 'c']);
    moveSlide(fx.api, 'b', 'up');
    expect(order(fx)).toEqual(['b', 'a', 'c']);
    moveSlide(fx.api, 'b', 'down');
    expect(order(fx)).toEqual(['a', 'b', 'c']);
    // En los extremos no hace nada.
    const commits = fx.commits.length;
    moveSlide(fx.api, 'a', 'up');
    moveSlide(fx.api, 'c', 'down');
    expect(order(fx)).toEqual(['a', 'b', 'c']);
    expect(fx.commits.length).toBe(commits);
  });

  it('cambiar el tamaño de la presentación es UNA entrada de deshacer y escala el contenido', () => {
    const fx = deck();
    resizeAllSlides(fx.api, { width: 1080, height: 1080 });
    expect(fx.commits).toHaveLength(1);
    for (const page of listPages(fx.api)) expect(page).toMatchObject({ width: 1080, height: 1080 });
    const text = fx.get().find((e) => e.id === 't');
    expect(text.fontSize).toBeCloseTo(40 * (1080 / 1920), 5);
  });

  it('el mismo tamaño que ya tienen no escribe nada', () => {
    const fx = deck();
    resizeAllSlides(fx.api, { width: 1920, height: 1080 });
    expect(fx.commits).toHaveLength(0);
  });

  it('saltar alterna', () => {
    const fx = deck();
    toggleSkip(fx.api, 'a');
    expect(isPageSkipped(fx.api, 'a')).toBe(true);
    toggleSkip(fx.api, 'a');
    expect(isPageSkipped(fx.api, 'a')).toBe(false);
  });

  it('los atajos del menú salen en el idioma del editor', () => {
    const es = { shift: 'Mayús', enter: 'Intro', del: 'Supr' };
    expect(shortcutLabel('newSlide', es)).toBe('Ctrl+M');
    expect(shortcutLabel('redo', es)).toBe('Ctrl+Mayús+Z');
    expect(shortcutLabel('delete', es)).toBe('Supr');
    expect(shortcutLabel('present', es)).toBe('Ctrl+Intro');
    expect(shortcutLabel('moveUp', { shift: 'Shift', enter: 'Enter', del: 'Del' })).toBe('Ctrl+Shift+↑');
  });
});
