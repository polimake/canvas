import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LABELS,
  EN_LABELS,
  labelsFor,
  mergeLabels,
  textPresetLabel,
  type Canvas2Labels,
} from '../src/ui/shared/labels';
import { DEFAULT_PAGE_NAMES, isDefaultPageName } from '../src/core/pageNames';

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
      'layers',
      'align',
      'text',
      'dock',
      'brand',
      'sizes',
      'workspace',
      'mode',
    ];
    for (const s of secciones) {
      expect(DEFAULT_LABELS[s], `falta la sección ${s}`).toBeTruthy();
      expect(Object.keys(DEFAULT_LABELS[s]).length).toBeGreaterThan(0);
    }
    expect(Object.keys(DEFAULT_LABELS).sort()).toEqual([...secciones].sort());
  });

  it('los nombres de página de serie son los mismos que pone el motor sin etiquetas', () => {
    // Están escritos dos veces —aquí, para el host, y en `core/pageNames.ts`,
    // que no puede importar de `ui/`—. Si se separan, una página creada desde
    // un panel se llamaría distinto que una creada por el motor.
    expect(DEFAULT_LABELS.pages.defaultName(3)).toBe(DEFAULT_PAGE_NAMES.defaultName(3));
    expect(DEFAULT_LABELS.pages.untitled).toBe(DEFAULT_PAGE_NAMES.untitled);
    expect(DEFAULT_LABELS.pages.copyName('Portada')).toBe(DEFAULT_PAGE_NAMES.copyName('Portada'));
  });

  it('el nombre de serie de las etiquetas se reconoce como de serie', () => {
    // Si no, las páginas nuevas nacerían con un nombre que ya no se renumera.
    expect(isDefaultPageName(DEFAULT_LABELS.pages.defaultName(7))).toBe(true);
  });

  it('el rótulo de un texto sale de `text`, salvo que el host lo traduzca en `sizes`', () => {
    expect(textPresetLabel(DEFAULT_LABELS, 'heading')).toBe('Título');
    expect(textPresetLabel(mergeLabels({ text: { heading: 'Heading' } }), 'heading')).toBe('Heading');
    // La vía de antes, que sigue mandando para no dejar sin traducción a nadie.
    expect(
      textPresetLabel(mergeLabels({ sizes: { heading: 'Big' }, text: { heading: 'Heading' } }), 'heading'),
    ).toBe('Big');
  });
});

describe('los textos de serie en inglés', () => {
  it('cubren exactamente las mismas claves que los españoles', () => {
    expect(Object.keys(EN_LABELS).sort()).toEqual(Object.keys(DEFAULT_LABELS).sort());
    for (const s of Object.keys(DEFAULT_LABELS) as (keyof Canvas2Labels)[]) {
      expect(Object.keys(EN_LABELS[s]).sort(), s).toEqual(Object.keys(DEFAULT_LABELS[s]).sort());
      for (const [k, v] of Object.entries(EN_LABELS[s])) {
        expect(typeof v, `${s}.${k}`).toBe(typeof (DEFAULT_LABELS[s] as Record<string, unknown>)[k]);
      }
    }
  });

  it('no llevan nada escrito en español', () => {
    for (const s of Object.keys(EN_LABELS) as (keyof Canvas2Labels)[]) {
      for (const [k, v] of Object.entries(EN_LABELS[s])) {
        const texto = typeof v === 'function' ? (v as (x: unknown) => string)(k === 'textWith' || k === 'copyName' || k === 'insertLogo' || k === 'applyToSelection' ? 'Logo' : 2) : String(v);
        expect(texto, `${s}.${k}`).not.toMatch(/[áéíóúñ¿¡]/i);
      }
    }
  });

  it('se eligen por el idioma de Excalidraw; lo demás sigue en español', () => {
    expect(labelsFor('en')).toBe(EN_LABELS);
    expect(labelsFor('en-GB')).toBe(EN_LABELS);
    expect(labelsFor('es-ES')).toBe(DEFAULT_LABELS);
    expect(labelsFor('de-DE')).toBe(DEFAULT_LABELS);
    expect(labelsFor(undefined)).toBe(DEFAULT_LABELS);
    // «en» tiene que ser el idioma, no el principio de otro código.
    expect(labelsFor('eu-ES')).toBe(DEFAULT_LABELS);
  });

  it('lo que el host no traduce cae al inglés, no al español', () => {
    const l = mergeLabels({ dock: { layers: 'Capas del host' } }, 'en');
    expect(l.dock.layers).toBe('Capas del host');
    expect(l.dock.brand).toBe('Brand');
    expect(l.layers.empty).toBe(EN_LABELS.layers.empty);
    expect(mergeLabels(null, 'en')).toBe(EN_LABELS);
  });

  it('las páginas nuevas en inglés se siguen renumerando', () => {
    expect(EN_LABELS.pages.defaultName(3)).toBe('Page 3');
    expect(isDefaultPageName(EN_LABELS.pages.defaultName(3))).toBe(true);
  });
});
