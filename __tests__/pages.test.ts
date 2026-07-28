import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/excal', () => excalMock);

const {
  addPage,
  listPages,
  getPageSize,
  deletePage,
  duplicatePage,
  movePage,
  resizePage,
  relayoutPages,
  setPageLocked,
  isPageLocked,
} = await import('../src/pages.js');

// Pages sit FLUSH against each other (Canva-style contiguous sheets).
const GAP = 0;

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
