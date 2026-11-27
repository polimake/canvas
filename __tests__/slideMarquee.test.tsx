// @vitest-environment jsdom
//
// En Presentación, arrastrar desde la franja que rodea la diapositiva dibuja un
// recuadro que coge lo de ESA diapositiva, como en Slides. Antes solo quitaba
// la selección: no había forma de empezar un recuadro desde fuera.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { excalMock, frame, member } from './helpers';

vi.mock('../src/core/excal', () => ({
  ...excalMock,
  // Ventana → escena con el encuadre: (cliente − desplazamiento) / zoom − scroll.
  viewportCoordsToSceneCoords: (
    { clientX, clientY }: { clientX: number; clientY: number },
    s: { zoom: { value: number }; offsetLeft: number; offsetTop: number; scrollX: number; scrollY: number },
  ) => ({ x: (clientX - s.offsetLeft) / s.zoom.value - s.scrollX, y: (clientY - s.offsetTop) / s.zoom.value - s.scrollY }),
}));

const { selectInBox, elementSceneBounds } = await import('../src/core/marquee.js');
const { SlideMask } = await import('../src/ui/workspaces/slides/SlideMask.js');

const scene = [
  frame('p1', 0, 0, 1000, 500),
  member('a', 'p1', 100, 100, 100, 100),
  member('b', 'p1', 600, 100, 100, 100),
  member('fondo', 'p1', 0, 0, 1000, 500, { customData: { c2: 'pageBackground' } }),
  member('fijo', 'p1', 120, 300, 50, 50, { locked: true }),
  member('g1', 'p1', 100, 250, 40, 40, { groupIds: ['grupo'] }),
  member('g2', 'p1', 800, 400, 40, 40, { groupIds: ['grupo'] }),
  frame('p2', 1100, 0, 1000, 500),
  member('vecina', 'p2', 1150, 100, 100, 100),
];

describe('selectInBox', () => {
  it('coge lo que queda entero dentro, solo de la diapositiva activa', () => {
    const { selectedElementIds } = selectInBox(scene as never, 'p1', { x: -50, y: 50, width: 2000, height: 200 });
    expect(Object.keys(selectedElementIds).sort()).toEqual(['a', 'b']);
  });

  it('a medias no cuenta', () => {
    const { selectedElementIds } = selectInBox(scene as never, 'p1', { x: 150, y: 50, width: 600, height: 200 });
    expect(Object.keys(selectedElementIds)).toEqual(['b']);
  });

  it('ni el fondo de la página ni lo bloqueado; un grupo, entero', () => {
    const sel = selectInBox(scene as never, 'p1', { x: -10, y: -10, width: 1020, height: 520 });
    expect(Object.keys(sel.selectedElementIds).sort()).toEqual(['a', 'b', 'g1', 'g2']);
    expect(selectInBox(scene as never, 'p1', { x: -10, y: -10, width: 400, height: 400 }).selectedGroupIds).toEqual({ grupo: true });
    expect(sel.selectedGroupIds).toEqual({ grupo: true });
  });

  it('con Mayúsculas se suma a lo que había', () => {
    const sel = selectInBox(scene as never, 'p1', { x: 550, y: 50, width: 200, height: 200 }, {
      selectedElementIds: { a: true },
      selectedGroupIds: {},
    });
    expect(Object.keys(sel.selectedElementIds).sort()).toEqual(['a', 'b']);
  });

  it('la caja de una línea sale de sus puntos, y la de algo girado, de sus esquinas', () => {
    expect(elementSceneBounds({ x: 10, y: 10, width: 0, height: 0, points: [[0, 0], [-5, 20]] } as never))
      .toEqual({ x: 5, y: 10, width: 5, height: 20 });
    const turned = elementSceneBounds({ x: 0, y: 0, width: 100, height: 20, angle: Math.PI / 2 } as never);
    expect(turned.width).toBeCloseTo(20);
    expect(turned.height).toBeCloseTo(100);
  });
});

describe('SlideMask: el recuadro desde la franja', () => {
  function setup() {
    const updates: Array<Record<string, unknown>> = [];
    let appState: Record<string, unknown> = {
      zoom: { value: 1 }, offsetLeft: 0, offsetTop: 0, scrollX: 100, scrollY: 100,
      selectedElementIds: {}, selectedGroupIds: {},
    };
    const api = {
      getSceneElements: () => scene,
      getAppState: () => appState,
      onScrollChange: () => () => {},
      onChange: () => () => {},
      updateScene: (u: { appState: Record<string, unknown> }) => {
        updates.push(u.appState);
        appState = { ...appState, ...u.appState };
      },
    };
    // La diapositiva p1 cae en pantalla en (100,100)–(1100,600); el hueco es más grande.
    const view = render(
      <SlideMask api={api as never} rootRef={{ current: null }} activePageId="p1"
        stage={{ left: 0, top: 0, width: 1400, height: 800 }} limits={{ top: 0, bottom: 800 }} />,
    );
    const bands = view.container.querySelectorAll<HTMLElement>('.canvas2-slides-mask');
    return { view, bands, updates, state: () => appState };
  }

  it('un clic sin arrastrar solo quita la selección', () => {
    const { bands, updates } = setup();
    fireEvent.pointerDown(bands[0], { button: 0, pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(bands[0], { pointerId: 1, clientX: 51, clientY: 50 });
    expect(updates).toEqual([{ selectedElementIds: {}, selectedGroupIds: {} }]);
  });

  it('arrastrando, dibuja el recuadro y al soltar coge lo de la diapositiva', () => {
    const { view, bands, state } = setup();
    // Franja de arriba, (50,50) → (450,350) de pantalla = (-50,-50) → (350,250) de escena.
    fireEvent.pointerDown(bands[0], { button: 0, pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(bands[0], { pointerId: 1, clientX: 450, clientY: 350 });
    expect(view.container.querySelector('.canvas2-slides-marquee')).not.toBeNull();
    fireEvent.pointerUp(bands[0], { pointerId: 1, clientX: 450, clientY: 350 });
    expect(view.container.querySelector('.canvas2-slides-marquee')).toBeNull();
    expect(Object.keys(state().selectedElementIds as object)).toEqual(['a']);
  });
});

describe('selectionWithoutFrames: las diapositivas son fijas', () => {
  it('quita los marcos de la selección y deja lo demás', async () => {
    const { selectionWithoutFrames } = await import('../src/ui/workspaces/slides/slideCommands.js');
    const elements = [{ id: 'p1', type: 'frame' }, { id: 'a', type: 'rectangle' }];
    expect(selectionWithoutFrames({ p1: true, a: true }, elements)).toEqual({ a: true });
    expect(selectionWithoutFrames({ p1: true }, elements)).toEqual({});
    expect(selectionWithoutFrames({ a: true }, elements)).toBeNull();
    expect(selectionWithoutFrames({}, elements)).toBeNull();
  });
});
