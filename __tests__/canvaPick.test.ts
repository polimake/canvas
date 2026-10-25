// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { installCanvaPick } = await import('../src/ui/editor/canvaPick');

/**
 * El banco, de punta a punta: A con B encima, un clic sobre A a 3,5 px de
 * pantalla del borde de B. Un Excalidraw de mentira hace lo que hace el de
 * verdad con ese clic: coge B por su margen (salvo que ya haya algo
 * seleccionado bajo el punto, que arrastra), arrastra lo seleccionado y, si se
 * suelta sin arrastrar, deja seleccionado lo que cogió.
 */
const ZOOM = 0.5;
const escena = () =>
  [
    { ...member('papel', 'p', 0, 0, 1080, 1350), locked: true, customData: { c2: 'pageBackground' } },
    member('A', 'p', 100, 100, 400, 400, { backgroundColor: '#ffcc00' }),
    member('B', 'p', 300, 300, 400, 300, { backgroundColor: '#0066ff' }),
    frame('p', 0, 0, 1080, 1350),
  ] as any[];

function montar() {
  const engine = fakeApi(escena());
  engine.api.updateScene({
    appState: {
      selectedElementIds: {},
      selectedGroupIds: {},
      activeTool: { type: 'selection' },
      zoom: { value: ZOOM },
      offsetLeft: 0,
      offsetTop: 0,
      scrollX: 0,
      scrollY: 0,
      editingTextElement: null,
      croppingElementId: null,
      selectedLinearElement: null,
    },
  });
  const root = document.createElement('div');
  const canvas = document.createElement('canvas');
  canvas.className = 'excalidraw__canvas interactive';
  root.appendChild(canvas);
  document.body.appendChild(root);

  // El Excalidraw de mentira: su manejador va en la raíz, al burbujear (React).
  const sel = () => engine.api.getAppState().selectedElementIds as Record<string, boolean>;
  const select = (ids: Record<string, true>) => engine.api.updateScene({ appState: { selectedElementIds: ids } });
  root.addEventListener('pointerdown', (down: any) => {
    const x = down.clientX / ZOOM;
    const y = down.clientY / ZOOM;
    const m = 8 / ZOOM;
    const caja = (e: any) => x >= e.x - m && x <= e.x + e.width + m && y >= e.y - m && y <= e.y + e.height + m;
    const tocados = engine.get().filter((e) => !e.locked && e.type !== 'frame' && caja(e));
    const cogido = tocados[tocados.length - 1]?.id ?? null; // lo de más arriba, por su margen
    if (!tocados.some((e) => sel()[e.id]) && cogido) select({ [cogido]: true });
    let arrastrado = false;
    let ultimo = { x: down.clientX, y: down.clientY };
    const move = (ev: any) => {
      arrastrado = true;
      const dx = (ev.clientX - ultimo.x) / ZOOM;
      const dy = (ev.clientY - ultimo.y) / ZOOM;
      ultimo = { x: ev.clientX, y: ev.clientY };
      engine.api.updateScene({ elements: engine.get().map((e) => (sel()[e.id] ? { ...e, x: e.x + dx, y: e.y + dy } : e)) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!arrastrado && cogido) select({ [cogido]: true });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  const quitar = installCanvaPick(root, engine.api);
  const ev = (type: string, x: number, y: number, target: EventTarget = canvas) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x * ZOOM, clientY: y * ZOOM }));
  return { engine, root, canvas, quitar, ev, sel };
}

const pausa = () => new Promise<void>((ok) => queueMicrotask(ok));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('coger como Canva, con el gesto entero', () => {
  it('un clic sobre A a 3,5 px de B deja A seleccionada', async () => {
    const { ev, sel, quitar } = montar();
    ev('pointerdown', 293, 400);
    expect(sel()).toEqual({ A: true });
    ev('pointerup', 293, 400, window);
    await pausa();
    await pausa();
    expect(sel()).toEqual({ A: true });
    quitar();
  });

  it('arrastrar desde ahí mueve A y no B', async () => {
    const { ev, engine, quitar } = montar();
    ev('pointerdown', 293, 400);
    ev('pointermove', 343, 440, window);
    ev('pointerup', 343, 440, window);
    await pausa();
    const A = engine.get().find((e) => e.id === 'A');
    const B = engine.get().find((e) => e.id === 'B');
    expect([A.x, A.y]).toEqual([150, 140]);
    expect([B.x, B.y]).toEqual([300, 300]);
    quitar();
  });

  it('dentro de B se coge B, como siempre', async () => {
    const { ev, sel, quitar } = montar();
    ev('pointerdown', 320, 400);
    ev('pointerup', 320, 400, window);
    await pausa();
    expect(sel()).toEqual({ B: true });
    quitar();
  });

  it('con Mayúsculas no se toca: es la selección múltiple de Excalidraw', async () => {
    const { canvas, sel, quitar } = montar();
    canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, shiftKey: true, clientX: 293 * ZOOM, clientY: 400 * ZOOM }));
    expect(sel()).toEqual({ B: true });
    quitar();
  });
});
