// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { excalMock, fakeApi, frame, member } from './helpers';
import { installKeyRouting, shouldForwardKey } from '../src/ui/editor/keyRouting';

/**
 * Excalidraw solo oye el teclado con el foco dentro de `.excalidraw`. El banco
 * del lienzo lo veía en dos sitios: «con el foco en la tira, Ctrl+Z no hace
 * nada» y «texto nuevo: no se abrió el editor de texto» (la T, recién abierto,
 * con el foco fuera del lienzo).
 */

let engine = fakeApi([]);
/** Lo que oye el contenedor de Excalidraw de mentira. */
let oido: string[] = [];

vi.mock('../src/core/excal', () => ({
  ...excalMock,
  Excalidraw: ({ excalidrawAPI }: { excalidrawAPI: (api: unknown) => void }) => {
    excalidrawAPI(engine.api);
    return (
      <div
        className="excalidraw excalidraw-container"
        tabIndex={0}
        onKeyDown={(e) => oido.push(`${e.ctrlKey ? 'Ctrl+' : ''}${e.key}`)}
      />
    );
  },
}));
const { Canvas2Editor } = await import('../src/ui/editor/Canvas2');

const papel = (id: string, frameId: string, x: number) => ({
  ...member(id, frameId, x, 0, 1080, 1080),
  locked: true,
  customData: { c2: 'pageBackground' },
});
const dosPaginas = () => [
  papel('papel-a', 'a', 0),
  frame('a', 0, 0, 1080, 1080, { name: 'Página 1', customData: { c2page: { index: 0 } } }),
  papel('papel-b', 'b', 1128),
  frame('b', 1128, 0, 1080, 1080, { name: 'Página 2', customData: { c2page: { index: 1 } } }),
];

beforeEach(() => {
  oido = [];
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function abrir() {
  engine = fakeApi(dosPaginas());
  const montado = render(<Canvas2Editor pages initialScene={{ elements: engine.get() } as never} />);
  act(() => engine.notify());
  return montado;
}

describe('el teclado del lienzo con el foco fuera de él', () => {
  it('Ctrl+Z con el foco en una ficha de la tira llega al lienzo', () => {
    const { container } = abrir();
    const ficha = container.querySelector<HTMLElement>('[data-canvas2-pages] div[role="button"]')!;
    expect(ficha).toBeTruthy();
    ficha.focus();
    fireEvent.keyDown(ficha, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(oido).toEqual(['Ctrl+z']);
    // Y el lienzo se queda con el foco, para lo que se pulse después.
    expect(document.activeElement?.classList.contains('excalidraw')).toBe(true);
  });

  it('Ctrl+Y y Ctrl+Mayús+Z desde la tira y desde «+ página» también llegan, como en Canva', () => {
    const { container } = abrir();
    const ficha = container.querySelector<HTMLElement>('[data-canvas2-pages] div[role="button"]')!;
    ficha.focus();
    fireEvent.keyDown(ficha, { key: 'y', code: 'KeyY', ctrlKey: true });
    const mas = container.querySelector<HTMLElement>('[data-testid="canvas2-add-page"]')!;
    expect(mas).toBeTruthy();
    mas.focus();
    fireEvent.keyDown(mas, { key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(mas, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(oido).toEqual(['Ctrl+y', 'Ctrl+Z', 'Ctrl+z']);
  });

  it('la T con el foco en ninguna parte (recién abierto) llega al lienzo', () => {
    abrir();
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT' });
    expect(oido).toEqual(['t']);
  });

  it('lo del lienzo no se repite, y lo que se escribe en un campo no se reenvía', () => {
    const { container } = abrir();
    const lienzo = container.querySelector<HTMLElement>('.excalidraw')!;
    fireEvent.keyDown(lienzo, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(oido).toEqual(['Ctrl+z']);
    const campo = document.createElement('input');
    container.querySelector('[data-canvas2]')!.appendChild(campo);
    fireEvent.keyDown(campo, { key: 't', code: 'KeyT' });
    expect(oido).toEqual(['Ctrl+z']);
  });

  it('Intro y las flechas sobre una ficha son de la ficha', () => {
    const { container } = abrir();
    const ficha = container.querySelector<HTMLElement>('[data-canvas2-pages] div[role="button"]')!;
    for (const key of ['Enter', ' ', 'ArrowRight', 'Delete', 'Tab']) fireEvent.keyDown(ficha, { key });
    expect(oido).toEqual([]);
  });
});

describe('installKeyRouting', () => {
  it('la copia no llega a los atajos de la app en window', () => {
    const scope = document.createElement('div');
    const canvas = document.createElement('div');
    canvas.tabIndex = 0;
    const boton = document.createElement('button');
    scope.append(canvas, boton);
    document.body.appendChild(scope);
    const enLienzo = vi.fn();
    canvas.addEventListener('keydown', enLienzo);
    const quitar = installKeyRouting(window, () => canvas, () => scope);
    const enLaApp = vi.fn();
    window.addEventListener('keydown', enLaApp);
    fireEvent.keyDown(boton, { key: 'y', ctrlKey: true });
    expect(enLienzo).toHaveBeenCalledTimes(1);
    // El original, una vez; la copia, ninguna.
    expect(enLaApp).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', enLaApp);
    quitar();
    scope.remove();
  });

  it('fuera del espacio de trabajo no se reenvía nada', () => {
    const canvas = document.createElement('div');
    const scope = document.createElement('div');
    const ajeno = document.createElement('button');
    scope.appendChild(canvas);
    document.body.append(scope, ajeno);
    const e = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    Object.defineProperty(e, 'target', { value: ajeno });
    expect(shouldForwardKey(e, canvas, scope)).toBe(false);
    scope.remove();
    ajeno.remove();
  });
});
