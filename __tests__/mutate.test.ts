import { describe, expect, it, vi } from 'vitest';
import { excalMock } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { commitElements, detachMoved } = await import('../src/core/mutate.js');

const el = (id: string, index: string | null, version = 1) => ({ id, index, version, type: 'rectangle' }) as any;

/**
 * Un `updateScene` que hace lo que hace el de Excalidraw con el orden: da
 * índice nuevo, MUTANDO el objeto, a lo que ha quedado fuera de orden
 * (`syncInvalidIndices`). Aquí, para no reimplementar su algoritmo, a todo lo
 * que no está estrictamente detrás del anterior.
 */
function escena(inicial: any[]) {
  let elements = inicial;
  const api = {
    getSceneElements: () => elements,
    getSceneElementsIncludingDeleted: () => elements,
    updateScene: ({ elements: next }: { elements: any[] }) => {
      let prev = '';
      next.forEach((e, i) => {
        if (e.index === null || e.index <= prev) {
          e.index = `${prev}${i}`;
          e.version += 1;
        }
        prev = e.index;
      });
      elements = next;
    },
  };
  return { api, get: () => elements };
}

describe('commitElements y el orden', () => {
  it('lo que cambia de sitio llega como copia: la escena no sube de versión por debajo del store', () => {
    // Si la mutación cae en el objeto de la escena, el store de Excalidraw ve
    // una versión que no ha pasado por él, no graba el cambio de orden en su
    // commit, y se cuela en la siguiente entrada del historial como un paso
    // que no se ve («Ctrl+Z necesita 2 pulsaciones»).
    const a = el('a', 'a0');
    const b = el('b', 'a1');
    const c = el('c', 'a2');
    const { api, get } = escena([a, b, c]);
    commitElements(api as any, [a, c, b], 'never');
    expect([a.version, b.version, c.version]).toEqual([1, 1, 1]);
    expect([a.index, b.index, c.index]).toEqual(['a0', 'a1', 'a2']);
    expect(get().map((e: any) => e.id)).toEqual(['a', 'c', 'b']);
    // Lo que no se movió sigue siendo el mismo objeto.
    expect(get()[0]).toBe(a);
  });

  it('sin cambios de orden no copia nada', () => {
    const a = el('a', 'a0');
    const b = el('b', 'a1');
    const next = [a, b];
    expect(detachMoved([a, b], next)).toBe(next);
  });

  it('solo copia el tramo que cambia', () => {
    const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map((id, i) => el(id, `a${i}`));
    const out = detachMoved([a, b, c, d, e], [a, c, b, d, e]);
    expect(out[0]).toBe(a);
    expect(out[1]).not.toBe(c);
    expect(out[2]).not.toBe(b);
    expect(out[3]).toBe(d);
    expect(out[4]).toBe(e);
  });
});
