// @vitest-environment jsdom
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { excalMock, fakeApi, frame, member } from './helpers';

/**
 * El lienzo montado en inglés no enseña nada en español.
 *
 * Excalidraw va falso (no carga en jsdom): de él se comprueba que recibe el
 * idioma, que es con lo que traduce lo suyo (barra, propiedades, menú
 * contextual). Lo que pinta canvas2 —tira de páginas, paneles, menú principal,
 * selector de modo— se recorre entero, abriendo cada panel, y se busca en el
 * texto y en los rótulos (`title`, `aria-label`, `placeholder`) cada texto de
 * serie en español que no se escribe igual en inglés.
 */

let engine = fakeApi([]);
vi.mock('../src/core/excal', () => ({
  ...excalMock,
  MainMenu: Object.assign(({ children }: { children: ReactNode }) => <nav>{children}</nav>, {
    Group: ({ title, children }: { title: string; children: ReactNode }) => <div role="group" aria-label={title}>{children}</div>,
    Item: ({ onSelect, selected: _selected, shortcut: _shortcut, textStyle: _textStyle, ...props }:
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> & { onSelect?: () => void; selected?: boolean; shortcut?: string; textStyle?: unknown }) =>
      <button {...props} onClick={() => onSelect?.()} />,
    Separator: () => null,
    DefaultItems: Object.fromEntries(['LoadScene', 'SaveToActiveFile', 'Export', 'SaveAsImage', 'ClearCanvas', 'SearchMenu', 'ToggleTheme', 'Help'].map(name => [name, () => null])),
  }),
  Excalidraw: function Engine({ excalidrawAPI, children, langCode }: { excalidrawAPI: (api: unknown) => void; children: ReactNode; langCode?: string }) {
    useEffect(() => { excalidrawAPI(engine.api); }, []);
    return <div data-testid="engine" data-lang={langCode}>{children}</div>;
  },
}));
const { Canvas2Editor } = await import('../src/ui/editor/Canvas2');
const { DEFAULT_LABELS, EN_LABELS } = await import('../src/ui/shared/labels');

const papel = (id: string, frameId: string, x: number) => ({
  ...member(id, frameId, x, 0, 1080, 1080),
  locked: true,
  customData: { c2: 'pageBackground' },
});

/** Dos páginas guardadas en español, como las que se vieron en producción. */
const escena = () => [
  papel('papel-a', 'a', 0),
  member('caja', 'a', 40, 40, 200, 200),
  { ...member('rotulo', 'a', 40, 300, 400, 80), type: 'text', text: 'Hola' },
  frame('a', 0, 0, 1080, 1080, { name: 'Página 1', customData: { c2page: { index: 0 } } }),
  papel('papel-b', 'b', 1128),
  member('caja-b', 'b', 1168, 40, 200, 200),
  frame('b', 1128, 0, 1080, 1080, { name: 'Página 2', customData: { c2page: { index: 1 } } }),
];

/** Las etiquetas con dato que reciben un texto; las demás, un número. */
const CON_TEXTO = new Set(['textWith', 'copyName', 'insertLogo', 'applyToSelection']);

/** Todos los textos de serie, funciones incluidas, con un dato de ejemplo. */
function textos(labels: typeof DEFAULT_LABELS): Map<string, string> {
  const out = new Map<string, string>();
  for (const [seccion, claves] of Object.entries(labels)) {
    for (const [clave, valor] of Object.entries(claves as Record<string, unknown>)) {
      const texto = typeof valor === 'function' ? (valor as (x: unknown) => string)(CON_TEXTO.has(clave) ? 'Logo' : 2) : valor;
      if (typeof texto === 'string') out.set(`${seccion}.${clave}`, texto);
    }
  }
  return out;
}

/** Los textos en español que delatarían el lienzo: los que el inglés escribe distinto. */
const enEspanol = (() => {
  const es = textos(DEFAULT_LABELS);
  const en = textos(EN_LABELS);
  return [...es].filter(([clave, texto]) => texto !== en.get(clave)).map(([, texto]) => texto);
})();

/** Lo que se lee en pantalla: el texto y los rótulos de cada elemento. */
function loQueSeVe(): string {
  const partes = [document.body.textContent ?? ''];
  for (const el of document.body.querySelectorAll('*')) {
    for (const attr of ['title', 'aria-label', 'placeholder', 'alt']) {
      const v = el.getAttribute(attr);
      if (v) partes.push(v);
    }
  }
  return partes.join('\n');
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Coincidencia de palabra entera: «Ver» no es «Very», ni «Alto» parte de otra. */
const aparece = (visto: string, texto: string) =>
  new RegExp(`(^|[^\\p{L}])${escapar(texto)}($|[^\\p{L}])`, 'u').test(visto);

/**
 * Monta el lienzo como la ficha de una pieza (páginas, capas, miniaturas,
 * selector de modo) y lo recorre: cada botón que haya en pantalla se pulsa una
 * vez, para que se abran sus paneles y menús, y se apunta lo que se ve.
 */
function montar(langCode?: string) {
  engine = fakeApi(escena());
  engine.setSelected(['caja']);
  render(
    <Canvas2Editor
      pages
      layers
      pageThumbnails
      langCode={langCode}
      initialScene={{ elements: engine.get() } as never}
      modeControl={{ modes: ['view', 'comment', 'edit'], mode: 'edit', onChange: () => {} }}
      componentsPanel={<div />}
      onSaveComponent={() => {}}
    />,
  );
  act(() => engine.notify());
}

function recorrer(langCode?: string): string {
  montar(langCode);
  const visto = [loQueSeVe()];
  const pulsados = new Set<Element>();
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    for (const boton of [...document.body.querySelectorAll('button, [role="button"], [role="tab"]')]) {
      if (pulsados.has(boton) || !boton.isConnected) continue;
      pulsados.add(boton);
      act(() => { fireEvent.click(boton); });
      visto.push(loQueSeVe());
    }
  }
  return visto.join('\n');
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('el lienzo en inglés', () => {
  it('le pasa el idioma a Excalidraw', () => {
    recorrer('en');
    expect(screen.getByTestId('engine').getAttribute('data-lang')).toBe('en');
  });

  it('no enseña ninguno de sus textos en español, tampoco «Página 1/2»', () => {
    const visto = recorrer('en');
    // El recorrido llega a los paneles: si no, no probaría nada.
    for (const texto of [EN_LABELS.dock.layers, EN_LABELS.pages.fitAll, EN_LABELS.mode.edit, 'Page 1', 'Page 2']) {
      expect(visto, texto).toContain(texto);
    }
    expect(enEspanol.filter((texto) => aparece(visto, texto))).toEqual([]);
    expect(visto).not.toMatch(/Página/);
  });

  it('no le cambia el nombre guardado a las páginas: solo cómo se lee', () => {
    montar('en');
    expect(screen.getByTitle('Page 2')).toBeTruthy();
    expect(engine.get().filter((e) => e.type === 'frame').map((e) => e.name)).toEqual(['Página 1', 'Página 2']);
  });

  it('sin idioma sigue en español, como siempre', () => {
    const visto = recorrer();
    expect(screen.getByTestId('engine').getAttribute('data-lang')).toBe('es-ES');
    for (const texto of [DEFAULT_LABELS.dock.layers, DEFAULT_LABELS.pages.fitAll, 'Página 1']) {
      expect(visto, texto).toContain(texto);
    }
  });
});
