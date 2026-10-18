import { describe, it, expect, vi } from 'vitest';
import { excalMock, frame, member } from './helpers';

vi.mock('../src/core/excal', () => ({ ...excalMock, useI18n: () => ({ t: (k: string) => k }) }));

import {
  SHIFT_NUDGE_PX,
  dropSelectionOnlyTail,
  hasRealEntry,
  isSelectionOnlyEntry,
  nudgeSelection,
  performHistory,
} from '../src/core/gestures';
import { canvaGestureActions, installCanvaGestures, isRedoKey, isUndoKey } from '../src/ui/editor/canvaGestures';

// Entradas con la misma forma que las `HistoryEntry` de Excalidraw 0.18.
const entry = (elementsChanged: boolean, deleted: object, inserted: object = deleted) => ({
  elementsChange: { isEmpty: () => !elementsChanged },
  appStateChange: { delta: { deleted, inserted } },
});
const selection = (id: string) => entry(false, { selectedElementIds: { [id]: true } }, {});
const move = () => entry(true, { selectedElementIds: { a: true } }, {});

/** Una `History` de mentira: `undo` aplica la entrada de la cima y la pasa a rehacer. */
function fakeHistory(undoStack: any[]) {
  const applied: any[] = [];
  const pass = (from: any[], to: any[]) => (elements: Map<string, any>, appState: any) => {
    const e = from.pop();
    if (!e) return undefined;
    applied.push(e);
    to.push(e);
    return [elements, { ...appState, applied: e }] as [Map<string, any>, any];
  };
  const history: any = { undoStack, redoStack: [] as any[] };
  history.undo = pass(history.undoStack, history.redoStack);
  history.redo = pass(history.redoStack, history.undoStack);
  return { app: { history, store: { snapshot: {} } }, history, applied };
}

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods }) as KeyboardEvent;

describe('deshacer como en Canva: seleccionar no es un paso', () => {
  it('reconoce una entrada que solo cambia la selección', () => {
    expect(isSelectionOnlyEntry(selection('a'))).toBe(true);
    expect(isSelectionOnlyEntry(entry(false, { selectedGroupIds: { g: true }, editingGroupId: 'g' }))).toBe(true);
    expect(isSelectionOnlyEntry(move())).toBe(false);
    // El fondo y el nombre también los observa la historia, y son cambios de verdad.
    expect(isSelectionOnlyEntry(entry(false, { viewBackgroundColor: '#000' }))).toBe(false);
    expect(isSelectionOnlyEntry(entry(false, { name: 'x' }))).toBe(false);
  });

  it('solo quita las de la cima, y apaga el botón si no queda nada real', () => {
    const stack = [move(), selection('b'), selection('a')];
    expect(dropSelectionOnlyTail(stack)).toBe(2);
    expect(stack).toHaveLength(1);
    expect(hasRealEntry([selection('a')])).toBe(false);
    expect(hasRealEntry([move(), selection('a')])).toBe(true);
  });

  it('mover, seleccionar y Ctrl+Z deshace el movimiento a la primera', () => {
    const real = move();
    const { app, applied } = fakeHistory([real, selection('b'), selection('a')]);
    const result = performHistory('undo', [], {}, app);
    expect(result).not.toBeNull();
    expect(applied).toEqual([real]);
  });

  it('rehacer también salta lo que es solo selección', () => {
    const real = move();
    const { app, history, applied } = fakeHistory([]);
    history.redoStack.push(real, selection('a'));
    performHistory('redo', [], {}, app);
    expect(applied).toEqual([real]);
  });

  it('con solo selecciones en la pila no deshace nada', () => {
    const { app, history, applied } = fakeHistory([selection('a')]);
    expect(performHistory('undo', [], {}, app)).toBeNull();
    expect(applied).toEqual([]);
    expect(history.undoStack).toEqual([]);
  });

  it('con un gesto a medias no toca la historia', () => {
    const { app, applied } = fakeHistory([move()]);
    expect(performHistory('undo', [], { editingTextElement: {} }, app)).toBeNull();
    expect(applied).toEqual([]);
  });

  it('la acción sustituye por nombre a undo y redo y no deja la historia como cambio nuevo', () => {
    const { app } = fakeHistory([move(), selection('a')]);
    const [undo, redo] = canvaGestureActions() as any[];
    expect(undo.name).toBe('undo');
    expect(redo.name).toBe('redo');
    expect(undo.perform([], {}, null, app).captureUpdate).toBe('NEVER');
    expect(undo.perform([], {}, null, app).captureUpdate).toBe('EVENTUALLY');
  });

  it('Ctrl+Z deshace; Ctrl+Y y Ctrl+Mayús+Z rehacen', () => {
    expect(isUndoKey(key('z', { ctrlKey: true }))).toBe(true);
    expect(isUndoKey(key('Z', { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isRedoKey(key('Z', { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isRedoKey(key('y', { ctrlKey: true }))).toBe(true);
    // Teclado no latino: manda la tecla física.
    expect(isUndoKey(key('я', { ctrlKey: true, code: 'KeyZ' } as any))).toBe(true);
  });
});

describe('Mayúsculas+flecha mueve 10 px', () => {
  const scene = () => [
    frame('p1', 0, 0, 1080, 1350),
    member('a', 'p1', 100, 100, 50, 50),
    member('b', 'p1', 300, 300, 50, 50),
    { id: 't', type: 'text', x: 110, y: 110, width: 20, height: 10, containerId: 'a', frameId: 'p1', version: 0 },
  ] as any[];

  it('el paso es 10', () => {
    expect(SHIFT_NUDGE_PX).toBe(10);
  });

  it('mueve lo seleccionado y su texto, y nada más', () => {
    const next = nudgeSelection(scene(), { a: true }, SHIFT_NUDGE_PX, 0)!;
    const at = (id: string) => next.find((e) => e.id === id)!;
    expect([at('a').x, at('a').y]).toEqual([110, 100]);
    expect(at('t').x).toBe(120);
    expect(at('b').x).toBe(300);
    expect(at('p1').x).toBe(0);
    // Sigue en su página aunque se salga: la pertenencia no se toca.
    expect(at('a').frameId).toBe('p1');
  });

  it('una página seleccionada se lleva lo que tiene dentro', () => {
    const next = nudgeSelection(scene(), { p1: true }, 0, -SHIFT_NUDGE_PX)!;
    expect(next.map((e) => e.y)).toEqual([-10, 90, 290, 100]);
  });

  it('sin selección no hace nada', () => {
    expect(nudgeSelection(scene(), {}, 10, 0)).toBeNull();
  });

  it('la acción responde a Mayúsculas+flecha, no a la flecha sola ni con la cuadrícula', () => {
    const actions = canvaGestureActions() as any[];
    const right = actions.find((a) => a.name === 'canvas2:shiftNudgeArrowRight');
    const appState = { selectedElementIds: { a: true } };
    expect(right.keyTest(key('ArrowRight', { shiftKey: true }), appState, [], {})).toBe(true);
    expect(right.keyTest(key('ArrowRight'), appState, [], {})).toBe(false);
    expect(right.keyTest(key('ArrowRight', { shiftKey: true, ctrlKey: true }), appState, [], {})).toBe(false);
    expect(right.keyTest(key('ArrowRight', { shiftKey: true }), appState, [], { getEffectiveGridSize: () => 20 })).toBe(false);
    expect(right.keyTest(key('ArrowRight', { shiftKey: true }), { selectedElementIds: {} }, [], {})).toBe(false);
    const result = right.perform(scene(), appState);
    expect(result.captureUpdate).toBe('IMMEDIATELY');
    expect(result.elements.find((e: any) => e.id === 'a').x).toBe(110);
  });

  it('se registran por la API imperativa', () => {
    const registerAction = vi.fn();
    installCanvaGestures({ registerAction } as any);
    expect(registerAction.mock.calls.map(([a]) => a.name)).toEqual([
      'undo', 'redo',
      'canvas2:shiftNudgeArrowLeft', 'canvas2:shiftNudgeArrowRight',
      'canvas2:shiftNudgeArrowUp', 'canvas2:shiftNudgeArrowDown',
    ]);
  });
});
