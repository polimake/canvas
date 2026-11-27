// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { excalMock, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { installCanvaDrag, edgeVelocity, restoreElements, EDGE_MAX_SPEED } = await import('../src/ui/editor/canvaDrag');

/**
 * Un Excalidraw de mentira que arrastra como el de verdad: al pulsar dispara
 * `onPointerDown` con su `pointerDownState` y DESPUÉS registra su `pointermove`
 * y su `pointerup` en `window`; al mover, lo seleccionado va a donde está el
 * puntero en escena (con la vista de ese momento) menos donde se pulsó; al
 * soltar, mete lo soltado en la página bajo el puntero y, si la escena no es la
 * de la última foto del historial, apunta un paso.
 */
function montar() {
  let elements: any[] = [
    member('papel-a', 'a', 0, 0, 1000, 1000, { locked: true, customData: { c2: 'pageBackground' } }),
    member('caja', 'a', 100, 100, 200, 200),
    frame('a', 0, 0, 1000, 1000),
    member('papel-b', 'b', 1048, 0, 1000, 1000, { locked: true, customData: { c2: 'pageBackground' } }),
    frame('b', 1048, 0, 1000, 1000),
  ];
  let appState: any = {
    selectedElementIds: {},
    selectedGroupIds: {},
    zoom: { value: 1 },
    scrollX: 0,
    scrollY: 0,
    offsetLeft: 0,
    offsetTop: 0,
    width: 800,
    height: 600,
    selectedElementsAreBeingDragged: false,
    editingTextElement: null,
    croppingElementId: null,
    viewModeEnabled: false,
  };
  const pasos: string[] = [];
  const clave = (els: any[]) => JSON.stringify(els.map(({ version: _v, versionNonce: _n, updated: _u, ...e }) => e));
  let foto = clave(elements);
  const down = new Set<(...a: any[]) => void>();
  const api = {
    getAppState: () => appState,
    getSceneElementsIncludingDeleted: () => elements,
    updateScene: (p: any) => {
      if (p.elements) elements = p.elements;
      if (p.appState) appState = { ...appState, ...p.appState };
    },
    onPointerDown: (cb: any) => {
      down.add(cb);
      return () => down.delete(cb);
    },
  };
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const scene = (e: { clientX: number; clientY: number }) => ({
    x: (e.clientX - appState.offsetLeft) / appState.zoom.value - appState.scrollX,
    y: (e.clientY - appState.offsetTop) / appState.zoom.value - appState.scrollY,
  });

  const pulsar = (clientX: number, clientY: number, id = 'caja') => {
    appState = { ...appState, selectedElementIds: { [id]: true } };
    const origin = scene({ clientX, clientY });
    const originales = new Map(elements.map((e) => [e.id, { ...e }]));
    const pds: any = {
      origin,
      drag: { hasOccurred: false },
      resize: { isResizing: false },
      eventListeners: { onMove: null, onUp: null },
    };
    const onMove = Object.assign(
      (ev: PointerEvent) => {
        const p = scene(ev);
        pds.drag.hasOccurred = true;
        appState = { ...appState, selectedElementsAreBeingDragged: true };
        elements = elements.map((e) =>
          appState.selectedElementIds[e.id]
            ? { ...e, x: originales.get(e.id)!.x + p.x - origin.x, y: originales.get(e.id)!.y + p.y - origin.y, version: e.version + 1 }
            : e,
        );
      },
      { cancel: vi.fn() },
    );
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      appState = { ...appState, selectedElementsAreBeingDragged: false };
      if (pds.drag.hasOccurred) {
        const p = scene(ev);
        const pagina = elements.find((e) => e.type === 'frame' && p.x >= e.x && p.x <= e.x + e.width && p.y >= e.y && p.y <= e.y + e.height);
        elements = elements.map((e) => (appState.selectedElementIds[e.id] && pagina && e.frameId !== pagina.id ? { ...e, frameId: pagina.id } : e));
        const ahora = clave(elements);
        if (ahora !== foto) pasos.push('arrastre');
        foto = ahora;
      }
    };
    pds.eventListeners.onMove = onMove;
    pds.eventListeners.onUp = onUp;
    const ev = new MouseEvent('pointerdown', { clientX, clientY, bubbles: true });
    Object.defineProperty(ev, 'target', { value: canvas });
    for (const cb of down) cb({ type: 'selection' }, pds, ev);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return pds;
  };
  const mover = (clientX: number, clientY: number) =>
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY, bubbles: true, buttons: 1 }));
  const soltar = (clientX: number, clientY: number) =>
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX, clientY, bubbles: true }));
  const escape = () => {
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    return e;
  };
  const caja = () => elements.find((e) => e.id === 'caja');
  const quitar = installCanvaDrag(api as any, window);
  return { api, pulsar, mover, soltar, escape, caja, pasos, elements: () => elements, appState: () => appState, quitar, canvas };
}

let frames: FrameRequestCallback[] = [];
let reloj = 0;
const fotograma = (ms = 16) => {
  reloj += ms;
  const ahora = frames;
  frames = [];
  for (const cb of ahora) cb(reloj);
};

beforeEach(() => {
  frames = [];
  reloj = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Escape a mitad de un arrastre, como en Canva', () => {
  it('lo devuelve a donde estaba, sigue seleccionado y no deja paso de deshacer', () => {
    const t = montar();
    const pds = t.pulsar(150, 150);
    t.mover(400, 300);
    expect(t.caja()).toMatchObject({ x: 350, y: 250 });
    const e = t.escape();
    expect(e.defaultPrevented).toBe(true);
    expect(t.caja()).toMatchObject({ x: 100, y: 100, frameId: 'a' });
    expect(t.appState().selectedElementIds).toEqual({ caja: true });
    expect(t.appState().selectedElementsAreBeingDragged).toBe(false);
    expect(pds.eventListeners.onMove.cancel).toHaveBeenCalled();
    expect(t.pasos).toEqual([]);
    // Lo que se mueva después con el botón aún pulsado ya no arrastra.
    t.mover(600, 500);
    t.soltar(600, 500);
    expect(t.caja()).toMatchObject({ x: 100, y: 100 });
    expect(t.pasos).toEqual([]);
    t.quitar();
  });

  it('soltado sobre otra página, vuelve a la suya', () => {
    const t = montar();
    t.pulsar(150, 150);
    t.mover(1200, 150); // encima de la página b
    t.escape();
    expect(t.caja()).toMatchObject({ x: 100, y: 100, frameId: 'a' });
    expect(t.pasos).toEqual([]);
  });

  it('sin arrastre, Escape es de Excalidraw y de la app', () => {
    const t = montar();
    t.pulsar(150, 150);
    const e = t.escape();
    expect(e.defaultPrevented).toBe(false);
    t.soltar(150, 150);
    // Y tras soltar, tampoco.
    expect(t.escape().defaultPrevented).toBe(false);
  });

  it('un arrastre normal sigue siendo un paso', () => {
    const t = montar();
    t.pulsar(150, 150);
    t.mover(250, 250);
    t.soltar(250, 250);
    expect(t.caja()).toMatchObject({ x: 200, y: 200 });
    expect(t.pasos).toEqual(['arrastre']);
  });

  it('las copias de Alt+arrastrar se van', () => {
    const now = [member('a', null as never, 0, 0, 10, 10), { ...member('copia', null as never, 5, 5, 10, 10) }];
    const before = [{ ...now[0], x: 50 }];
    const next = restoreElements(now as never, before as never)!;
    expect(next.map((e) => e.id)).toEqual(['a']);
    expect(next[0]).toMatchObject({ x: 50, version: 1 });
    expect(restoreElements(before as never, before as never)).toBeNull();
  });
});

describe('arrastrar hasta el borde desplaza la vista, como en Canva', () => {
  it('la velocidad crece hacia el borde y es cero lejos de él', () => {
    const box = { left: 0, top: 0, width: 800, height: 600 };
    expect(edgeVelocity({ x: 400, y: 300 }, box)).toEqual({ vx: 0, vy: 0 });
    const cerca = edgeVelocity({ x: 790, y: 300 }, box).vx;
    const medio = edgeVelocity({ x: 770, y: 300 }, box).vx;
    expect(cerca).toBeGreaterThan(medio);
    expect(medio).toBeGreaterThan(0);
    expect(edgeVelocity({ x: 900, y: 300 }, box).vx).toBe(EDGE_MAX_SPEED);
    expect(edgeVelocity({ x: 400, y: 2 }, box).vy).toBeLessThan(0);
  });

  it('con el puntero quieto en el borde la vista corre y lo arrastrado la sigue; al soltar, para', () => {
    const t = montar();
    t.pulsar(150, 150);
    t.mover(795, 150);
    const x0 = t.caja().x;
    for (let i = 0; i < 20; i++) fotograma();
    expect(t.appState().scrollX).toBeLessThan(0);
    // Lo arrastrado sigue bajo el puntero, que no se ha movido.
    expect(t.caja().x).toBeCloseTo(x0 - t.appState().scrollX, 5);
    // Tras 150 ms en el borde, ~14 px por fotograma a 5 px de él: ni a saltos ni parado.
    expect(-t.appState().scrollX).toBeGreaterThan(50);
    expect(-t.appState().scrollX).toBeLessThan(200);
    t.soltar(795, 150);
    const s = t.appState().scrollX;
    for (let i = 0; i < 5; i++) fotograma();
    expect(t.appState().scrollX).toBe(s);
    expect(frames).toEqual([]);
  });

  it('pasar por el borde de camino no mueve la vista', () => {
    const t = montar();
    t.pulsar(150, 150);
    t.mover(795, 150);
    for (let i = 0; i < 5; i++) fotograma(); // 80 ms
    t.mover(400, 150);
    for (let i = 0; i < 20; i++) fotograma();
    expect(t.appState().scrollX).toBe(0);
    t.soltar(400, 150);
  });

  it('apartarse del borde lo para, y no pasa del final del diseño', () => {
    const t = montar();
    t.pulsar(150, 150);
    t.mover(795, 150);
    for (let i = 0; i < 15; i++) fotograma();
    expect(t.appState().scrollX).toBeLessThan(0);
    t.mover(400, 150);
    const s = t.appState().scrollX;
    fotograma();
    fotograma();
    expect(t.appState().scrollX).toBe(s);
    // Hacia la derecha hasta el final: el diseño acaba en x = 2048.
    t.mover(799, 150);
    for (let i = 0; i < 2000 && frames.length; i++) fotograma(50);
    const visibleRight = -t.appState().scrollX + 800;
    expect(visibleRight).toBeLessThan(2048 + 800 / 2 + 50);
    expect(frames).toEqual([]);
    t.soltar(799, 150);
  });

  it('Escape tras desplazar devuelve también lo arrastrado', () => {
    const t = montar();
    t.pulsar(150, 150);
    t.mover(795, 150);
    for (let i = 0; i < 20; i++) fotograma();
    t.escape();
    expect(t.caja()).toMatchObject({ x: 100, y: 100, frameId: 'a' });
    expect(t.pasos).toEqual([]);
  });
});
