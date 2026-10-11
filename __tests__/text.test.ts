import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { insertTextPreset, contrastTextColor, TEXT_PRESETS } = await import('../src/core/text.js');
const { DEFAULT_LABELS } = await import('../src/ui/shared/labels.js');

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

  it('escribe el texto de quien llama, y sin él (o vacío) el del preset', () => {
    // Lo que se escribe se guarda con el diseño: lo da quien tiene las etiquetas.
    const { api } = fakeApi([frame('p1', 0, 0, 1080, 1350)]);
    const textoDe = (id: string | null) => api.getSceneElements().find((e: any) => e.id === id).text;

    expect(textoDe(insertTextPreset(api as any, 'heading', { pageId: 'p1', text: 'Heading' }))).toBe('Heading');
    expect(textoDe(insertTextPreset(api as any, 'heading', { pageId: 'p1' }))).toBe('Título');
    expect(textoDe(insertTextPreset(api as any, 'body', { pageId: 'p1', text: '' }))).toBe('Escribe algo…');
  });

  it('las etiquetas de serie dicen lo mismo que los presets', () => {
    // Están escritos dos veces: aquí, que no puede importar de `ui/`, y en las
    // etiquetas, que es lo que pinta e inserta el editor.
    for (const preset of TEXT_PRESETS) {
      expect(DEFAULT_LABELS.text[preset.key], preset.key).toBe(preset.label);
      expect(DEFAULT_LABELS.text[`${preset.key}Text` as const], preset.key).toBe(preset.text);
    }
  });
});
