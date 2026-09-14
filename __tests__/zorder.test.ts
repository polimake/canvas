import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { reorderMembersInArray, sendMemberToBack } = await import('../src/core/zorder.js');

describe('z-order', () => {
  it('reorders only the page member slots, leaving frames and other pages alone', () => {
    const els = [
      frame('p1', 0, 0, 100, 100),
      member('a', 'p1', 0, 0, 10, 10),
      member('x', 'p2', 0, 0, 10, 10),
      member('b', 'p1', 0, 0, 10, 10),
      member('c', 'p1', 0, 0, 10, 10),
    ];
    const next = reorderMembersInArray(els as any, 'p1', ['c', 'a', 'b']);
    expect(next.map((e: any) => e.id)).toEqual(['p1', 'c', 'x', 'a', 'b']);
  });

  it('appends unmentioned members in their existing relative order', () => {
    const els = [
      frame('p1', 0, 0, 100, 100),
      member('a', 'p1', 0, 0, 10, 10),
      member('b', 'p1', 0, 0, 10, 10),
      member('c', 'p1', 0, 0, 10, 10),
    ];
    const next = reorderMembersInArray(els as any, 'p1', ['c']);
    expect(next.map((e: any) => e.id)).toEqual(['p1', 'c', 'a', 'b']);
  });

  it('sendMemberToBack puts the element first among its page members', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 100, 100),
      member('a', 'p1', 0, 0, 10, 10),
      member('b', 'p1', 0, 0, 10, 10),
    ]);
    const next = sendMemberToBack(api as any, 'b', 'p1');
    expect((next as any[]).map((e) => e.id)).toEqual(['p1', 'b', 'a']);
  });
});
