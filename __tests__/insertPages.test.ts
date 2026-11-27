import { describe, expect, it, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { insertPagesIntoScene } = await import('../src/core/insertPages.js');
const { listPages } = await import('../src/core/pages.js');
const { selectAllInSlide } = await import('../src/ui/workspaces/slides/slideCommands.js');
const { documentToScene } = await import('../src/converters/document.js');

const deck = () => {
  const fx = fakeApi([
    frame('a', 0, 0, 1920, 1080, { customData: { c2page: { index: 0 } } }),
    frame('b', 1968, 0, 1920, 1080, { customData: { c2page: { index: 1 } } }),
    member('a-text', 'a', 10, 10, 100, 40, { groupIds: ['g1'] }),
  ]);
  (fx.api as any).addFiles = vi.fn();
  return fx;
};

/** Lo que da `documentToScene` para dos páginas, como lo devolvería el host. */
const incoming = (prefix = 'imp') => documentToScene({
  format: 'pptx', assets: [], warnings: [],
  pages: [
    { id: 'slide-1', name: 'Uno', width: 1920, height: 1080, notes: 'Notas de la 1', transition: 'fade',
      elements: [{ id: 's1', kind: 'rectangle', x: 0, y: 0, width: 10, height: 10, groupIds: ['g1'] }] },
    { id: 'slide-2', name: 'Dos', width: 1920, height: 1080, hidden: true, elements: [] },
  ],
}, { idPrefix: prefix });

describe('documentToScene', () => {
  it('cada marco lleva su orden, sus notas, si se salta y su transición', () => {
    const scene = incoming();
    const frames = scene.elements.filter((e) => e.type === 'frame') as any[];
    expect(frames[0].customData).toMatchObject({ c2page: { index: 0 }, c2notes: 'Notas de la 1', c2transition: 'fade' });
    expect(frames[1].customData).toMatchObject({ c2page: { index: 1 }, c2skip: true });
    expect(frames[1].customData.c2notes).toBeUndefined();
  });
});

describe('insertar páginas importadas', () => {
  it('van detrás de la activa, en orden y en UNA entrada de deshacer', () => {
    const fx = deck();
    const scene = incoming();
    const ids = insertPagesIntoScene(fx.api, { elements: scene.elements, files: { f: { id: 'f' } } }, { afterPageId: 'a' });
    expect(ids).toHaveLength(2);
    expect(listPages(fx.api).map((p) => p.id)).toEqual(['a', ...ids, 'b']);
    expect(fx.commits).toHaveLength(1);
    expect(fx.commits[0].captureUpdate).toBe('IMMEDIATELY');
    expect((fx.api as any).addFiles).toHaveBeenCalledWith([{ id: 'f' }]);
    // Los hijos siguen a su página.
    const child = fx.get().find((e) => e.customData?.sourceId === 's1');
    expect(child.frameId).toBe(ids[0]);
  });

  it('sin página de referencia, al final', () => {
    const fx = deck();
    const ids = insertPagesIntoScene(fx.api, { elements: incoming().elements });
    expect(listPages(fx.api).map((p) => p.id)).toEqual(['a', 'b', ...ids]);
  });

  it('importar dos veces lo mismo no pisa ids ni junta grupos', () => {
    const fx = deck();
    const first = insertPagesIntoScene(fx.api, { elements: incoming('x').elements });
    const second = insertPagesIntoScene(fx.api, { elements: incoming('x').elements });
    expect(new Set([...first, ...second]).size).toBe(4);
    const ids = fx.get().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = fx.get().filter((e) => e.customData?.sourceId === 's1').map((e) => e.groupIds[0]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).not.toBe(groups[1]);
    // El grupo que ya existía en la escena tampoco se mezcla.
    expect(groups).not.toContain('g1');
  });

  it('sin páginas que añadir no escribe nada', () => {
    const fx = deck();
    expect(insertPagesIntoScene(fx.api, { elements: [] })).toEqual([]);
    expect(fx.commits).toHaveLength(0);
  });
});

describe('seleccionar todo en Presentación', () => {
  it('solo lo de la diapositiva activa, sin papel ni bloqueados, y sin historial', () => {
    const fx = fakeApi([
      frame('a', 0, 0, 100, 100), frame('b', 200, 0, 100, 100),
      member('paper', 'a', 0, 0, 100, 100, { locked: true, customData: { c2: 'pageBackground' } }),
      member('x', 'a', 10, 10, 10, 10), member('locked', 'a', 20, 20, 10, 10, { locked: true }),
      member('y', 'b', 210, 10, 10, 10),
    ]);
    selectAllInSlide(fx.api, 'a');
    expect(fx.api.getAppState().selectedElementIds).toEqual({ x: true });
    expect(fx.commits.at(-1)?.captureUpdate).toBe('NEVER');
  });
});
