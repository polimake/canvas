// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { excalMock, fakeApi, frame } from './helpers';

// Un SVG de verdad para presentar: el exportador de Excalidraw no corre en node.
vi.mock('../src/core/excal', () => ({
  ...excalMock,
  exportToSvg: vi.fn(async () => document.createElementNS('http://www.w3.org/2000/svg', 'svg')),
}));

const { Filmstrip } = await import('../src/ui/workspaces/slides/Filmstrip');
const { SlidesMenu } = await import('../src/ui/workspaces/slides/SlidesMenu');
const { PresentMode } = await import('../src/ui/workspaces/slides/PresentMode');
const { DEFAULT_LABELS } = await import('../src/ui/shared/labels');

const slide = (id: string, skipped = false) => ({ id, name: id, index: 0, width: 1920, height: 1080, locked: false, x: 0, y: 0, skipped });

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function strip(extra: Partial<Parameters<typeof Filmstrip>[0]> = {}) {
  const handlers = {
    onSelect: vi.fn(), onContextMenu: vi.fn(), onMove: vi.fn(), onNewAfter: vi.fn(), onDuplicate: vi.fn(),
    onDelete: vi.fn(), onMoveBy: vi.fn(), onGrid: vi.fn(), onCollapse: vi.fn(),
  };
  render(<Filmstrip slides={[slide('a'), slide('b'), slide('c', true)]} activeId="b" thumbs={{}}
    labels={DEFAULT_LABELS} {...handlers} {...extra} />);
  return handlers;
}

/** Arrastra con el puntero; jsdom no mide, así que cada fila dice dónde está (100 px de alto). */
function arrastrar(desde: HTMLElement, hastaY: number) {
  document.querySelectorAll<HTMLElement>('[data-slide-id]').forEach((li, i) => {
    li.getBoundingClientRect = () =>
      ({ top: i * 100, left: 0, height: 100, width: 160, bottom: i * 100 + 100, right: 160, x: 0, y: i * 100 }) as DOMRect;
  });
  fireEvent.pointerDown(desde, { button: 0, pointerId: 1, clientX: 50, clientY: 50 });
  const mover = (tipo: string, y: number) => {
    const ev = new MouseEvent(tipo, { clientX: 50, clientY: y, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerId', { value: 1 });
    act(() => { window.dispatchEvent(ev); });
  };
  mover('pointermove', 80);
  mover('pointermove', hastaY);
  mover('pointerup', hastaY);
  // El navegador manda un clic tras el `pointerup`: el arrastre se lo traga.
  act(() => desde.click());
}

describe('tira de diapositivas', () => {
  it('marca la activa y la que se salta', () => {
    strip();
    expect(screen.getByRole('button', { name: 'Diapositiva 2' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Diapositiva 3 · Se salta al presentar' })).toBeTruthy();
  });

  it('flechas para moverse; Ctrl+D, Ctrl+M, Supr y Ctrl+Mayús+flecha actúan sobre ESA diapositiva', () => {
    const h = strip();
    const b = screen.getByRole('button', { name: 'Diapositiva 2' });
    fireEvent.keyDown(b, { key: 'ArrowDown' });
    expect(h.onSelect).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(b, { key: 'ArrowUp' });
    expect(h.onSelect).toHaveBeenLastCalledWith('a');
    fireEvent.keyDown(b, { key: 'd', ctrlKey: true });
    expect(h.onDuplicate).toHaveBeenCalledWith('b');
    fireEvent.keyDown(b, { key: 'm', ctrlKey: true });
    expect(h.onNewAfter).toHaveBeenCalledWith('b');
    fireEvent.keyDown(b, { key: 'Delete' });
    expect(h.onDelete).toHaveBeenCalledWith('b');
    fireEvent.keyDown(b, { key: 'ArrowUp', ctrlKey: true, shiftKey: true });
    expect(h.onMoveBy).toHaveBeenCalledWith('b', 'up');
  });

  it('las teclas que maneja no siguen hasta el lienzo (Ctrl+D duplicaría la SELECCIÓN)', () => {
    strip();
    const seen = vi.fn();
    window.addEventListener('keydown', seen);
    const b = screen.getByRole('button', { name: 'Diapositiva 2' });
    const ev = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true });
    b.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(seen).not.toHaveBeenCalled();
    window.removeEventListener('keydown', seen);
  });

  it('en lectura no se borra, duplica ni arrastra', () => {
    const h = strip({ viewMode: true });
    const b = screen.getByRole('button', { name: 'Diapositiva 2' });
    fireEvent.keyDown(b, { key: 'Delete' });
    fireEvent.keyDown(b, { key: 'd', ctrlKey: true });
    fireEvent.contextMenu(b);
    expect(h.onDelete).not.toHaveBeenCalled();
    expect(h.onDuplicate).not.toHaveBeenCalled();
    expect(h.onContextMenu).not.toHaveBeenCalled();
    arrastrar(b, 290);
    expect(h.onMove).not.toHaveBeenCalled();
  });

  it('arrastrar con el puntero reordena (también en el escritorio, desktop#371)', () => {
    const h = strip();
    arrastrar(screen.getByRole('button', { name: 'Diapositiva 1' }), 290);
    expect(h.onMove).toHaveBeenCalledWith('a', 2);
    // Y soltar no la selecciona de paso.
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  it('un clic sin arrastrar sigue eligiendo', () => {
    const h = strip();
    const b = screen.getByRole('button', { name: 'Diapositiva 3 · Se salta al presentar' });
    fireEvent.pointerDown(b, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    fireEvent.click(b);
    expect(h.onSelect).toHaveBeenCalledWith('c');
    expect(h.onMove).not.toHaveBeenCalled();
  });

  it('clic derecho elige la diapositiva y pide su menú', () => {
    const h = strip();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Diapositiva 1' }), { clientX: 50, clientY: 60 });
    expect(h.onSelect).toHaveBeenCalledWith('a');
    expect(h.onContextMenu).toHaveBeenCalledWith('a', { x: 50, y: 60 });
  });
});

describe('menú desplegable', () => {
  const items = (onSelect = vi.fn()) => [
    { label: 'Uno', onSelect },
    { label: 'Dos', onSelect, disabled: true },
    { kind: 'separator' as const },
    { label: 'Tres', onSelect, checked: true },
    { kind: 'submenu' as const, label: 'Más', items: [{ label: 'Cuatro', onSelect }] },
  ];

  it('flechas saltan lo desactivado, Esc cierra, elegir cierra y ejecuta', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(<SlidesMenu label="Menú" items={items(onSelect)} onClose={onClose} style={{}} />);
    const uno = screen.getByRole('menuitem', { name: 'Uno' });
    expect(document.activeElement).toBe(uno);
    fireEvent.keyDown(uno, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: 'Tres' }));
    expect(screen.getByRole('menuitem', { name: 'Dos' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Tres' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(uno, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('submenú con la flecha derecha y vuelta con la izquierda', () => {
    const onSelect = vi.fn();
    render(<SlidesMenu label="Menú" items={items(onSelect)} onClose={vi.fn()} style={{}} />);
    const mas = screen.getByRole('menuitem', { name: 'Más' });
    fireEvent.keyDown(mas, { key: 'ArrowRight' });
    const cuatro = screen.getByRole('menuitem', { name: 'Cuatro' });
    expect(document.activeElement).toBe(cuatro);
    fireEvent.keyDown(cuatro, { key: 'ArrowLeft' });
    expect(screen.queryByRole('menuitem', { name: 'Cuatro' })).toBeNull();
  });

  it('pulsar fuera cierra, salvo en la barra que lo abrió', () => {
    const onClose = vi.fn();
    const bar = document.createElement('div');
    document.body.appendChild(bar);
    render(<SlidesMenu label="Menú" items={items()} onClose={onClose} style={{}} keepOpenWithin={() => bar} />);
    fireEvent.pointerDown(bar);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
    bar.remove();
  });
});

describe('presentar', () => {
  const setup = (startId = 'a') => {
    const fx = fakeApi([frame('a', 0, 0, 1920, 1080), frame('b', 2000, 0, 1920, 1080), frame('c', 4000, 0, 1920, 1080)]);
    const onExit = vi.fn();
    render(<PresentMode api={fx.api} slides={[slide('a'), slide('b', true), slide('c')]} startId={startId}
      labels={DEFAULT_LABELS} onExit={onExit} />);
    return { fx, onExit };
  };

  it('las que se saltan no salen, y las flechas avanzan y retroceden', async () => {
    setup();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    await act(async () => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });
    expect(screen.getByText('2 / 2')).toBeTruthy();
    await act(async () => { fireEvent.keyDown(window, { key: 'ArrowLeft' }); });
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('pasada la última, «Fin de la presentación»; Esc sale y devuelve dónde se estaba', async () => {
    const { onExit } = setup('c');
    await act(async () => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });
    expect(screen.getByText('Fin de la presentación')).toBeTruthy();
    await act(async () => { fireEvent.keyDown(window, { key: 'ArrowLeft' }); });
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }); });
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }); });
    // Una sola salida aunque llegue dos veces (Esc y el fin de la pantalla completa).
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith('c');
  });

  it('ninguna tecla llega al editor mientras se presenta (Supr borraría la selección)', async () => {
    setup();
    const editor = vi.fn();
    document.body.addEventListener('keydown', editor);
    await act(async () => { fireEvent.keyDown(document.body, { key: 'Delete' }); });
    await act(async () => { fireEvent.keyDown(document.body, { key: 'r' }); });
    expect(editor).not.toHaveBeenCalled();
    document.body.removeEventListener('keydown', editor);
  });

  it('va en <body>, fuera del editor, y empieza donde se pidió', () => {
    setup('c');
    const dialog = screen.getByRole('dialog', { name: 'Presentación' });
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });
});
