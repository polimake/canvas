import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/excal', () => excalMock);

const { setPageBackgroundColor, getPageBackground, ensurePagePapers } = await import(
  '../src/background.js'
);

const isBg = (e: any) => e.customData?.c2 === 'pageBackground';

describe('page background', () => {
  it('creates a locked full-bleed rect at the back of the page', () => {
    const { api } = fakeApi([
      frame('p1', 100, 50, 500, 500),
      member('m1', 'p1', 120, 60, 40, 40),
    ]);
    const id = setPageBackgroundColor(api as any, 'p1', '#d0ebff');
    expect(id).toBeTruthy();
    const els = api.getSceneElements();
    const bg = els.find(isBg);
    expect(bg).toMatchObject({
      x: 100,
      y: 50,
      width: 500,
      height: 500,
      locked: true,
      backgroundColor: '#d0ebff',
      frameId: 'p1',
    });
    // Back of the page = first among the page's members in array order.
    const members = els.filter((e: any) => e.frameId === 'p1');
    expect(members[0].id).toBe(bg.id);
    expect(getPageBackground(api as any, 'p1')).toBe('#d0ebff');
  });

  it('re-applying replaces the previous background instead of stacking', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 500, 500)]);
    setPageBackgroundColor(api as any, 'p1', '#ffffff');
    setPageBackgroundColor(api as any, 'p1', '#1e1e1e');
    const bgs = api.getSceneElements().filter(isBg);
    expect(bgs).toHaveLength(1);
    expect(bgs[0].backgroundColor).toBe('#1e1e1e');
  });

  it('null removes the background', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 500, 500)]);
    setPageBackgroundColor(api as any, 'p1', '#ffffff');
    setPageBackgroundColor(api as any, 'p1', null);
    expect(api.getSceneElements().filter(isBg)).toHaveLength(0);
    expect(getPageBackground(api as any, 'p1')).toBeNull();
  });

  it('ensurePagePapers gives paperless legacy pages a white sheet, once', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 500, 500),
      frame('p2', 500, 0, 500, 500),
    ]);
    setPageBackgroundColor(api as any, 'p1', '#d0ebff');
    ensurePagePapers(api as any);
    const bgs = api.getSceneElements().filter(isBg);
    expect(bgs).toHaveLength(2);
    // The page that already had a background keeps its color.
    expect(getPageBackground(api as any, 'p1')).toBe('#d0ebff');
    expect(getPageBackground(api as any, 'p2')).toBe('#ffffff');
    // Idempotent.
    ensurePagePapers(api as any);
    expect(api.getSceneElements().filter(isBg)).toHaveLength(2);
  });

  it('does nothing for an unknown page', () => {
    const { api, get } = fakeApi([frame('p1', 0, 0, 500, 500)]);
    const before = get();
    expect(setPageBackgroundColor(api as any, 'ghost', '#fff')).toBeNull();
    expect(get()).toBe(before);
  });
});
