import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';
import { PAGE_GAP } from '../src/layout';

vi.mock('../src/excal', () => excalMock);

const {
  addPage,
  listPages,
  getPageSize,
  deletePage,
  duplicatePage,
  movePage,
  renamePage,
  resizePage,
  relayoutPages,
  setPageLocked,
  isPageLocked,
} = await import('../src/pages.js');


// Se importa de la fuente en vez de duplicarlo: un GAP a mano en el test se
// desincroniza del real y los tests dejan de comprobar el layout de verdad.
const GAP = PAGE_GAP;

describe('pages on frames', () => {
  it('addPage appends flush to the right with the requested size and a paper sheet', () => {
    const { api, get } = fakeApi([frame('p1', 0, 0, 1000, 800)]);
    const id = addPage(api as any, { width: 1080, height: 1920 });
    const added = get().find((e) => e.id === id);
    expect(added).toMatchObject({ type: 'frame', x: 1000 + GAP, width: 1080, height: 1920 });
    expect(listPages(api as any).map((p) => p.id)).toEqual(['p1', id]);
    // Every new page ships with a locked, sharp-cornered white paper rect.
    const paper = get().find((e) => e.frameId === id && e.customData?.c2 === 'pageBackground');
    expect(paper).toMatchObject({
      x: 1000 + GAP,
      width: 1080,
      height: 1920,
      locked: true,
      backgroundColor: '#ffffff',
      roughness: 0,
      roundness: null,
    });
  });

  it('deletePage removes the page and its members but refuses the last page', () => {
    const { api, get } = fakeApi([
      frame('p1', 0, 0, 500, 500),
      frame('p2', 700, 0, 500, 500),
      member('m2', 'p2', 720, 20, 50, 50),
    ]);
    deletePage(api as any, 'p2');
    expect(get().map((e) => e.id)).toEqual(['p1']);
    deletePage(api as any, 'p1');
    expect(get().map((e) => e.id)).toEqual(['p1']); // last page survives
  });

  it('duplicatePage clones members with fresh ids and remapped frameId', () => {
    const { api, get } = fakeApi([
      frame('p1', 0, 0, 500, 500, { name: 'Portada' }),
      member('m1', 'p1', 100, 100, 50, 50),
    ]);
    const newId = duplicatePage(api as any, 'p1');
    expect(newId).toBeTruthy();
    const clonedFrame = get().find((e) => e.id === newId);
    expect(clonedFrame).toMatchObject({ type: 'frame', x: 500 + GAP, name: 'Portada (copia)' });
    const clonedMember = get().find((e) => e.frameId === newId);
    expect(clonedMember).toBeTruthy();
    expect(clonedMember.id).not.toBe('m1');
    expect(clonedMember.x).toBe(100 + 500 + GAP);
  });

  it('movePage swaps order and carries members along', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 500, 500),
      frame('p2', 660, 0, 500, 500),
      member('m2', 'p2', 700, 10, 20, 20),
    ]);
    movePage(api as any, 'p2', -1);
    const pages = listPages(api as any);
    expect(pages.map((p) => p.id)).toEqual(['p2', 'p1']);
    // After relayout p2 occupies the leftmost slot and its member kept its offset.
    const p2 = api.getSceneElements().find((e: any) => e.id === 'p2');
    const m2 = api.getSceneElements().find((e: any) => e.id === 'm2');
    expect(m2.x - p2.x).toBe(700 - 660);
  });

  it('resizePage with scaleContent remaps centers and scales sizes uniformly', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 1000, 1000),
      member('m1', 'p1', 100, 100, 200, 200),
      member('t1', 'p1', 400, 400, 200, 100, { type: 'text', fontSize: 40 }),
    ]);
    resizePage(api as any, 'p1', { width: 500, height: 1000 });
    const els = api.getSceneElements();
    const f = els.find((e: any) => e.id === 'p1');
    expect(f).toMatchObject({ width: 500, height: 1000 });
    // sx=0.5 sy=1 k=0.5. m1 center (200,200) -> (100,200); size 100x100.
    const m1 = els.find((e: any) => e.id === 'm1');
    expect(m1).toMatchObject({ x: 50, y: 150, width: 100, height: 100 });
    // Text scales fontSize by k too.
    const t1 = els.find((e: any) => e.id === 't1');
    expect(t1.fontSize).toBe(20);
  });

  it('resizePage always stretches the paper sheet to the exact new bounds', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 1000, 1000),
      { ...member('bg', 'p1', 0, 0, 1000, 1000), locked: true, customData: { c2: 'pageBackground' } },
    ]);
    resizePage(api as any, 'p1', { width: 500, height: 1000 });
    const bg = api.getSceneElements().find((e: any) => e.id === 'bg');
    expect(bg).toMatchObject({ x: 0, y: 0, width: 500, height: 1000 });
  });

  it('resizePage without scaleContent keeps member geometry', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 1000, 1000),
      member('m1', 'p1', 100, 100, 200, 200),
    ]);
    resizePage(api as any, 'p1', { width: 500, height: 500 }, { scaleContent: false });
    const m1 = api.getSceneElements().find((e: any) => e.id === 'm1');
    expect(m1).toMatchObject({ x: 100, y: 100, width: 200, height: 200 });
  });

  it('resizePage re-packs the following pages so nothing overlaps', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 500, 500),
      frame('p2', 660, 0, 500, 500),
      member('m2', 'p2', 700, 10, 20, 20),
    ]);
    resizePage(api as any, 'p1', { width: 2000, height: 500 });
    const els = api.getSceneElements();
    const p2 = els.find((e: any) => e.id === 'p2');
    expect(p2.x).toBe(2000 + GAP);
    const m2 = els.find((e: any) => e.id === 'm2');
    expect(m2.x - p2.x).toBe(700 - 660);
  });

  it('relayoutPages is a no-op when already packed', () => {
    const scene = [frame('p1', 0, 0, 500, 500), frame('p2', 500 + GAP, 0, 500, 500)];
    const { api, get } = fakeApi(scene);
    const before = get();
    relayoutPages(api as any);
    expect(get()).toBe(before); // no updateScene call → same reference
  });

  it('setPageLocked locks the frame and every member; listPages reflects it', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 500, 500),
      member('m1', 'p1', 10, 10, 20, 20),
    ]);
    setPageLocked(api as any, 'p1', true);
    expect(isPageLocked(api as any, 'p1')).toBe(true);
    expect(api.getSceneElements().every((e: any) => e.locked)).toBe(true);
    expect(listPages(api as any)[0].locked).toBe(true);
  });

  it('getPageSize rounds live frame dimensions', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 1080.4, 1919.6)]);
    expect(getPageSize(api as any, 'p1')).toEqual({ width: 1080, height: 1920 });
  });
});

describe('single-undo + ordering guarantees', () => {
  it('addPage with afterPageId inserts between pages, shifts the rest, renumbers — one commit', () => {
    const { api, commits } = fakeApi([
      frame('a', 0, 0, 500, 500, { name: 'Página 1' }),
      frame('b', 500, 0, 500, 500, { name: 'Página 2' }),
      member('mb', 'b', 600, 10, 20, 20),
    ]);
    const id = addPage(api as any, { width: 300, height: 300 }, { afterPageId: 'a' });
    expect(commits).toHaveLength(1);
    const pagesNow = listPages(api as any);
    expect(pagesNow.map((p) => p.id)).toEqual(['a', id, 'b']);
    expect(pagesNow.map((p) => p.name)).toEqual(['Página 1', 'Página 2', 'Página 3']);
    const b = api.getSceneElements().find((e: any) => e.id === 'b');
    // desplazada por el ancho de la página insertada + los dos carriles
    expect(b.x).toBe(500 + GAP + 300 + GAP);
    const mb = api.getSceneElements().find((e: any) => e.id === 'mb');
    expect(mb.x - b.x).toBe(100); // member offset preserved
  });

  it("addPage capture 'never' is invisible to history (init-created first page)", () => {
    const { api, commits } = fakeApi([]);
    addPage(api as any, { width: 100, height: 100 }, { capture: 'never' });
    expect(commits).toHaveLength(1);
    expect(commits[0].captureUpdate).toBe('NEVER');
  });

  it('duplicatePage inserts the copy right AFTER the source — one commit', () => {
    const { api, commits } = fakeApi([
      frame('a', 0, 0, 500, 500, { name: 'Página 1' }),
      frame('b', 500, 0, 400, 500, { name: 'Página 2' }),
    ]);
    const copy = duplicatePage(api as any, 'a');
    expect(commits).toHaveLength(1);
    const order = listPages(api as any);
    expect(order.map((p) => p.id)).toEqual(['a', copy, 'b']);
    expect(order[1].name).toBe('Página 1 (copia)');
    // The default-named page after the insertion point renumbers to its slot.
    expect(order[2].name).toBe('Página 3');
    const b = api.getSceneElements().find((e: any) => e.id === 'b');
    // a (500) + carril + copia (500) + carril
    expect(b.x).toBe(500 + GAP + 500 + GAP);
    // Clones carry no inherited fractional index.
    const clone = api.getSceneElements().find((e: any) => e.id === copy);
    expect('index' in clone).toBe(false);
  });

  it('movePage and resizePage are exactly one commit each (single undo entry)', () => {
    const { api, commits } = fakeApi([
      frame('a', 0, 0, 500, 500),
      frame('b', 500, 0, 500, 500),
    ]);
    movePage(api as any, 'b', -1);
    expect(commits).toHaveLength(1);
    resizePage(api as any, 'b', { width: 800, height: 500 });
    expect(commits).toHaveLength(2);
  });

  it('deletePage renumbers surviving default-named pages (custom names untouched)', () => {
    const { api } = fakeApi([
      frame('a', 0, 0, 500, 500, { name: 'Página 1' }),
      frame('b', 500, 0, 500, 500, { name: 'Página 2' }),
      frame('c', 1000, 0, 500, 500, { name: 'Portada' }),
    ]);
    deletePage(api as any, 'a');
    expect(listPages(api as any).map((p) => p.name)).toEqual(['Página 1', 'Portada']);
  });

  it('element patches bump version so the history store can diff them', () => {
    const { api } = fakeApi([frame('a', 0, 0, 500, 500, { name: 'Página 1' })]);
    renamePage(api as any, 'a', 'Portada');
    const f = api.getSceneElements().find((e: any) => e.id === 'a');
    expect(f.name).toBe('Portada');
    expect(f.version).toBe(1);
  });
});
