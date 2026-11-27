// @vitest-environment jsdom
import { Component } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { excalMock, fakeApi, frame, member } from './helpers';

/**
 * El Ctrl+D de Excalidraw y el índice repetido (banco del lienzo, nightly del
 * 8/11, semilla 1122 paso 10 y semilla 103 paso 26).
 *
 * `actionDuplicateSelection` de Excalidraw 0.18.1 mete la copia detrás del
 * original con su MISMO `index` (y su misma versión y nonce: `duplicateElement`
 * no los toca) y no la recoloca. `Scene.replaceAllElements` la arreglaría con
 * `syncInvalidIndices`, pero antes la valida y, en la build de desarrollo,
 * lanza: el Ctrl+D que cae en esa ventana (una vez por minuto) no duplica nada.
 */

let engine = fakeApi([]);
/** Las props con las que el lienzo monta Excalidraw. */
let props: Record<string, any> = {};

vi.mock('../src/core/excal', () => ({
  ...excalMock,
  Excalidraw: class Engine extends Component<Record<string, any>> {
    componentDidMount() {
      this.props.excalidrawAPI(engine.api);
    }
    render() {
      props = this.props;
      return <div data-testid="engine" />;
    }
  },
}));
const { Canvas2Editor } = await import('../src/ui/editor/Canvas2');
const { indexDuplicates } = await import('../src/core/duplicate');

/** `isValidFractionalIndex` de Excalidraw, sobre toda la escena. */
function invalidIndices(elements: readonly any[]): string[] {
  return elements.flatMap((el, i) => {
    const lower = elements[i - 1]?.index;
    const upper = elements[i + 1]?.index;
    const ok = !!el.index && (!lower || lower < el.index) && (!upper || el.index < upper);
    return ok ? [] : [`${el.index}:${el.id}`];
  });
}

/** Una clave válida de `fractional-indexing` con entero `a?`: una fracción, si la hay, que no acaba en 0. */
const KEY = /^a[0-9A-Za-z]([0-9A-Za-z]*[1-9A-Za-z])?$/;

/** Lo que devuelve el `duplicateElement` de Excalidraw: id nuevo, todo lo demás igual. */
const copia = (el: any, id: string) => ({ ...el, id, x: el.x + 10, y: el.y + 10 });

/** La página 1 del banco con sus índices, como estaba en el paso 10 de la semilla 1122. */
function escena() {
  return [
    { ...member('banco-foto-1', 'p1', 40, 40, 300, 300, { type: 'image' }), index: 'a4', version: 12 },
    { ...member('uXn0SNrZAKnrZ5poNoO7c', 'p1', 60, 60, 300, 300, { type: 'image' }), index: 'a4V', version: 8, versionNonce: 997765641 },
    { ...member('banco-texto-1', 'p1', 80, 400, 300, 40, { type: 'text' }), index: 'a5' },
    { ...frame('p1', 0, 0, 1080, 1350), index: 'a6' },
  ];
}

beforeEach(() => {
  props = {};
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Ctrl+D: la copia no hereda el índice del original', () => {
  it('el lienzo le pasa a Excalidraw un onDuplicate que deja la escena con índices válidos', () => {
    engine = fakeApi(escena());
    render(<Canvas2Editor initialScene={{ elements: engine.get() } as never} />);
    const prev = escena();
    const original = prev[1];
    // Lo que arma `actionDuplicateSelection`: la copia justo detrás del original.
    const next = [prev[0], original, copia(original, 'HQVPvwPesbOphgpiwU9lI'), prev[2], prev[3]];
    expect(invalidIndices(next)).toEqual(['a4V:uXn0SNrZAKnrZ5poNoO7c', 'a4V:HQVPvwPesbOphgpiwU9lI']);

    expect(typeof props.onDuplicate).toBe('function');
    const out = props.onDuplicate(next, prev) ?? next;
    expect(invalidIndices(out)).toEqual([]);
    // Lo que ya estaba es el mismo objeto: ni índice ni versión nuevos.
    [0, 1, 3, 4].forEach((i) => expect(out[i]).toBe(next[i]));
    expect(out[2].index > 'a4V' && out[2].index < 'a5').toBe(true);
    expect(out[2].index).toMatch(KEY);
  });
});

describe('indexDuplicates', () => {
  it('varias copias seguidas, también al final de la escena', () => {
    const prev = escena();
    const next = [...prev, copia(prev[3], 'c1'), copia(prev[3], 'c2')];
    const out = indexDuplicates(next as any, prev as any);
    expect(invalidIndices(out)).toEqual([]);
    out.forEach((el: any) => expect(el.index).toMatch(KEY));
  });

  it('cabe aunque el de después sea el de antes alargado', () => {
    const prev = [
      { ...member('a', 'p', 0, 0, 1, 1), index: 'a4' },
      { ...member('b', 'p', 0, 0, 1, 1), index: 'a40V' },
    ];
    const next = [prev[0], copia(prev[0], 'c1'), copia(prev[0], 'c2'), prev[1]];
    const out = indexDuplicates(next as any, prev as any);
    expect(invalidIndices(out)).toEqual([]);
    out.forEach((el: any) => expect(el.index).toMatch(KEY));
  });

  it('una copia cuyo índice ya vale no se toca (Alt+arrastrar deja la copia en el hueco del original)', () => {
    const prev = escena();
    const next = [prev[0], copia(prev[1], 'c1'), prev[2], prev[3], prev[1]];
    const out = indexDuplicates(next as any, prev as any);
    expect(out[1]).toBe(next[1]);
  });
});
