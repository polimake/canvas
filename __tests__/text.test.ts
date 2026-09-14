import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { insertTextPreset, contrastTextColor, TEXT_PRESETS } = await import('../src/core/text.js');

describe('text presets', () => {
  it('presets anchor at distinct vertical positions (no exact overlap)', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 1080, 1350)]);
    const h = insertTextPreset(api as any, 'heading', { pageId: 'p1' });
    const s = insertTextPreset(api as any, 'subheading', { pageId: 'p1' });
    const els = api.getSceneElements();
    const heading = els.find((e: any) => e.id === h);
    const sub = els.find((e: any) => e.id === s);
    expect(heading.y).not.toBe(sub.y);
    expect(heading.frameId).toBe('p1');
  });

  it('font size scales with the page width (64px at 1080 → 128px at 2160)', () => {
    const { api } = fakeApi([frame('wide', 0, 0, 2160, 2700)]);
    const id = insertTextPreset(api as any, 'heading', { pageId: 'wide' });
    const el = api.getSceneElements().find((e: any) => e.id === id);
    expect(el.fontSize).toBe(128);
  });

  it('text color contrasts with the page background (white text on dark paper)', () => {
    const { api } = fakeApi([
      frame('dark', 0, 0, 1080, 1350),
      {
        ...member('bg', 'dark', 0, 0, 1080, 1350),
        locked: true,
        backgroundColor: '#1e1e1e',
        customData: { c2: 'pageBackground' },
      },
    ]);
    const id = insertTextPreset(api as any, 'body', { pageId: 'dark' });
    const el = api.getSceneElements().find((e: any) => e.id === id);
    expect(el.strokeColor).toBe('#ffffff');
  });

  it('defaults to dark text on the default white paper', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 1080, 1350)]);
    const id = insertTextPreset(api as any, 'heading', { pageId: 'p1' });
    const el = api.getSceneElements().find((e: any) => e.id === id);
    expect(el.strokeColor).toBe('#1e1e1e');
  });

  it('selects the inserted element so the user can retype immediately', () => {
    const { api, commits } = fakeApi([frame('p1', 0, 0, 1080, 1350)]);
    const id = insertTextPreset(api as any, 'heading', { pageId: 'p1' });
    const last = commits[commits.length - 1];
    expect(last.appState?.selectedElementIds).toEqual({ [id!]: true });
  });

  it('contrastTextColor: luminance threshold', () => {
    expect(contrastTextColor('#ffffff')).toBe('#1e1e1e');
    expect(contrastTextColor('#1e1e1e')).toBe('#ffffff');
    expect(contrastTextColor(null)).toBe('#1e1e1e');
    expect(contrastTextColor('garbage')).toBe('#1e1e1e');
  });

  it('every preset declares a distinct anchor', () => {
    const anchors = TEXT_PRESETS.map((p) => p.anchorY);
    expect(new Set(anchors).size).toBe(anchors.length);
  });
});
