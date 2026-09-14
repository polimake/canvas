import { describe, it, expect } from 'vitest';
import { DEFAULT_LABELS, mergeLabels, type Canvas2Labels } from '../src/ui/shared/labels';

describe('mergeLabels', () => {
  it('sin etiquetas del host devuelve las de serie tal cual', () => {
    expect(mergeLabels()).toBe(DEFAULT_LABELS);
    expect(mergeLabels(null)).toBe(DEFAULT_LABELS);
  });

  it('pisa solo lo que llega y conserva el resto', () => {
    const l = mergeLabels({ dock: { layers: 'Layers' } });
    expect(l.dock.layers).toBe('Layers');
    expect(l.dock.brand).toBe(DEFAULT_LABELS.dock.brand);
    expect(l.menu.export).toBe(DEFAULT_LABELS.menu.export);
  });

  it('una traducción a medias NO deja botones sin texto', () => {
    // Es el modo de fallo que importa: un JSON de i18n incompleto devuelve
    // cadenas vacías, y sin esta guarda el editor se queda mudo.
    const l = mergeLabels({ menu: { export: '', size: undefined, apply: 'Apply' } });
    expect(l.menu.export).toBe(DEFAULT_LABELS.menu.export);
    expect(l.menu.size).toBe(DEFAULT_LABELS.menu.size);
    expect(l.menu.apply).toBe('Apply');
  });

  it('no muta las etiquetas de serie', () => {
    const antes = DEFAULT_LABELS.dock.layers;
    mergeLabels({ dock: { layers: 'Layers' } });
    expect(DEFAULT_LABELS.dock.layers).toBe(antes);
  });

  it('admite funciones de etiqueta traducidas', () => {
    const l = mergeLabels({
      brand: { applyToSelection: (c) => `Apply ${c} to selection` },
    });
    expect(l.brand.applyToSelection('#fff')).toBe('Apply #fff to selection');
    // La que no se traduce sigue en español y sigue siendo una función.
    expect(l.brand.applied(2)).toBe('2 elementos');
  });

  it('el plural por defecto distingue uno de varios', () => {
    expect(DEFAULT_LABELS.brand.applied(1)).toBe('1 elemento');
    expect(DEFAULT_LABELS.brand.applied(3)).toBe('3 elementos');
  });

  it('los tamaños se pueden traducir por clave sin perder los demás', () => {
    const l = mergeLabels({ sizes: { square: 'Square 1:1' } });
    expect(l.sizes.square).toBe('Square 1:1');
    expect(l.sizes.story).toBe(DEFAULT_LABELS.sizes.story);
  });

  it('cubre todas las secciones del contrato', () => {
    // Si alguien añade una sección y olvida las de serie, esto lo dice.
    const secciones: (keyof Canvas2Labels)[] = [
      'library',
      'components',
      'menu',
      'video',
      'loose',
      'pages',
      'dock',
      'brand',
      'sizes',
      'workspace',
    ];
    for (const s of secciones) {
      expect(DEFAULT_LABELS[s], `falta la sección ${s}`).toBeTruthy();
      expect(Object.keys(DEFAULT_LABELS[s]).length).toBeGreaterThan(0);
    }
    expect(Object.keys(DEFAULT_LABELS).sort()).toEqual([...secciones].sort());
  });
});
