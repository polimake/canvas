import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { alignToPage } = await import('../src/core/align.js');

function scene() {
  return fakeApi([
    frame('p1', 100, 200, 1000, 800),
    member('m1', 'p1', 300, 400, 200, 100),
    member('other', 'p2', 0, 0, 10, 10),
    member('locked', 'p1', 500, 500, 10, 10, { locked: true }),
  ]);
}

describe('alignToPage', () => {
  it.each([
    ['left', { x: 100, y: 400 }],
    ['centerX', { x: 100 + (1000 - 200) / 2, y: 400 }],
    ['right', { x: 100 + 1000 - 200, y: 400 }],
    ['top', { x: 300, y: 200 }],
    ['centerY', { x: 300, y: 200 + (800 - 100) / 2 }],
    ['bottom', { x: 300, y: 200 + 800 - 100 }],
  ] as const)('%s aligns against the page bounds', (alignment, expected) => {
    const { api } = scene();
    const moved = alignToPage(api as any, 'p1', alignment, ['m1']);
    expect(moved).toBe(1);
    const m1 = api.getSceneElements().find((e: any) => e.id === 'm1');
    expect(m1).toMatchObject(expected);
  });

  it('uses the live selection when no ids are passed', () => {
    const { api, setSelected } = scene();
    setSelected(['m1']);
    expect(alignToPage(api as any, 'p1', 'left')).toBe(1);
  });

  it('ignores locked elements and members of other pages', () => {
    const { api, get } = scene();
    const before = get();
    expect(alignToPage(api as any, 'p1', 'left', ['locked', 'other'])).toBe(0);
    expect(get()).toBe(before); // untouched → no updateScene
  });

  it('returns 0 for an unknown page or empty selection', () => {
    const { api } = scene();
    expect(alignToPage(api as any, 'ghost', 'left', ['m1'])).toBe(0);
    expect(alignToPage(api as any, 'p1', 'left', [])).toBe(0);
  });
});
