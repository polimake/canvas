// @vitest-environment jsdom
import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { excalMock, fakeApi, frame } from './helpers';

let engine = fakeApi([]);
const mounted = vi.fn();
vi.mock('../src/core/excal', () => ({
  ...excalMock,
  MainMenu: Object.assign(({ children }: { children: ReactNode }) => <nav>{children}</nav>, {
    Group: ({ title, children }: { title: string; children: ReactNode }) => <div role="group" aria-label={title}>{children}</div>,
    Item: ({ onSelect, selected: _s, shortcut: _sh, textStyle: _t, ...props }:
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> & { onSelect?: () => void; selected?: boolean; shortcut?: string; textStyle?: unknown }) =>
      <button {...props} onClick={() => onSelect?.()} />,
    Separator: () => null,
    DefaultItems: Object.fromEntries(['LoadScene', 'SaveToActiveFile', 'Export', 'SaveAsImage', 'ClearCanvas', 'SearchMenu', 'ToggleTheme', 'Help'].map(name => [name, () => null])),
  }),
  Excalidraw: function Engine({ excalidrawAPI, children }: { excalidrawAPI: (api: unknown) => void; children: ReactNode }) {
    useEffect(() => { mounted(); excalidrawAPI(engine.api); }, []);
    return <div data-testid="engine" className="excalidraw">{children}</div>;
  },
}));
const { Canvas2Editor } = await import('../src/ui/editor/Canvas2');
const { WORKSPACE_STORAGE_KEY } = await import('../src/ui/workspaces/preference');

const strip = () => screen.getByRole('complementary', { name: 'Diapositivas' });
const thumbs = () => within(strip()).getAllByRole('button', { name: /^Diapositiva \d/ });
const current = () => thumbs().findIndex((b) => b.getAttribute('aria-current') === 'true') + 1;
const openMenu = (name: string) => fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name }));
const frames = () => engine.get().filter((e) => e.type === 'frame' && !e.isDeleted);

function mount(props: Partial<Parameters<typeof Canvas2Editor>[0]> = {}) {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, 'slides');
  engine = fakeApi([
    frame('p1', 0, 0, 1920, 1080, { customData: { c2page: { index: 0 } } }),
    frame('p2', 1968, 0, 1920, 1080, { customData: { c2page: { index: 1 } } }),
    frame('p3', 3936, 0, 1920, 1080, { customData: { c2page: { index: 2 } } }),
  ]);
  Object.assign(engine.api, { setActiveTool: vi.fn(), toggleSidebar: vi.fn() });
  const view = render(<Canvas2Editor pages onWorkspaceChange={vi.fn()} {...props} />);
  act(() => { engine.api.updateScene({ elements: engine.get() }); });
  return view;
}

beforeEach(() => {
  localStorage.clear();
  mounted.mockClear();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  // Escritorio: a menos de 861 px el espacio cae a Diseño.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 1600, bottom: 900, width: 1600, height: 900, toJSON: () => ({}) } as DOMRect,
  );
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('espacio Presentación', () => {
  it('abre en la primera diapositiva, con la tira y sin la tira de páginas de los otros espacios', () => {
    const { container } = mount();
    expect(container.querySelector('[data-workspace="slides"]')).toBeTruthy();
    expect(thumbs()).toHaveLength(3);
    expect(current()).toBe(1);
    expect(container.querySelector('[data-canvas2-pages]')).toBeNull();
  });

  it('borrar la activa desde la tira deja activa la de su sitio', () => {
    mount();
    fireEvent.click(thumbs()[1]);
    expect(current()).toBe(2);
    fireEvent.keyDown(thumbs()[1], { key: 'Delete' });
    expect(frames().map((f) => f.id)).toEqual(['p1', 'p3']);
    expect(thumbs()).toHaveLength(2);
    expect(current()).toBe(2);
  });

  it('Supr seguidos en la tira siguen borrando: el foco pasa a la que queda', () => {
    mount();
    fireEvent.click(thumbs()[0]);
    thumbs()[0].focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Delete' });
    expect(document.activeElement?.getAttribute('aria-current')).toBe('true');
    fireEvent.keyDown(document.activeElement!, { key: 'Delete' });
    expect(frames()).toHaveLength(1);
    // La última no se borra nunca.
    fireEvent.keyDown(document.activeElement!, { key: 'Delete' });
    expect(frames()).toHaveLength(1);
  });

  it('flechas seguidas recorren la tira sin atascarse', () => {
    mount();
    thumbs()[0].focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(current()).toBe(3);
    expect(document.activeElement).toBe(thumbs()[2]);
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(current()).toBe(1);
  });

  it('si la activa desaparece por fuera (deshacer, otra versión), se elige la que queda en su sitio', () => {
    mount();
    fireEvent.click(thumbs()[2]);
    act(() => { engine.api.updateScene({ elements: engine.get().filter((e) => e.id !== 'p3') }); });
    expect(thumbs()).toHaveLength(2);
    expect(current()).toBe(2);
  });

  it('Ctrl+M crea una diapositiva detrás de la activa, pero no mientras se escriben las notas', () => {
    mount();
    fireEvent.keyDown(document.body, { key: 'm', ctrlKey: true });
    expect(frames()).toHaveLength(4);
    expect(current()).toBe(2);
    const notes = screen.getByRole('textbox', { name: 'Notas del orador' });
    notes.focus();
    fireEvent.keyDown(notes, { key: 'm', ctrlKey: true });
    expect(frames()).toHaveLength(4);
  });

  it('las notas a medio escribir se guardan en SU diapositiva al cambiar de diapositiva', () => {
    mount();
    const notes = screen.getByRole('textbox', { name: 'Notas del orador' });
    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: 'Para la 1' } });
    fireEvent.click(thumbs()[1]);
    expect(engine.get().find((e) => e.id === 'p1')?.customData?.c2notes).toBe('Para la 1');
    expect(engine.get().find((e) => e.id === 'p2')?.customData?.c2notes).toBeUndefined();
    expect((screen.getByRole('textbox', { name: 'Notas del orador' }) as HTMLTextAreaElement).value).toBe('');
  });

  it('deshacer las notas (con la caja sin foco) se ve en la caja', () => {
    mount();
    const notes = screen.getByRole('textbox', { name: 'Notas del orador' }) as HTMLTextAreaElement;
    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: 'Hola' } });
    fireEvent.blur(notes);
    act(() => {
      engine.api.updateScene({ elements: engine.get().map((e) => (e.id === 'p1' ? { ...e, customData: { c2page: { index: 0 } } } : e)) });
    });
    expect(notes.value).toBe('');
  });

  it('con una herramienta de dibujo, Fondo · Componentes · Tema dejan sitio a las opciones de formato', () => {
    mount({ brandKit: { mainColor: '#3a39f5' } });
    expect(screen.getByRole('button', { name: 'Tema' })).toBeTruthy();
    act(() => { engine.api.updateScene({ appState: { activeTool: { type: 'rectangle' } } }); });
    expect(screen.queryByRole('button', { name: 'Tema' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fondo' })).toBeNull();
    act(() => { engine.api.updateScene({ appState: { activeTool: { type: 'selection' } } }); });
    expect(screen.getByRole('button', { name: 'Tema' })).toBeTruthy();
    act(() => { engine.setSelected(['p1']); });
    expect(screen.queryByRole('button', { name: 'Tema' })).toBeNull();
  });

  it('las herramientas van al motor; la imagen abre la biblioteca del host', () => {
    mount({ library: <p>Biblioteca del proyecto</p> });
    fireEvent.click(screen.getByRole('button', { name: 'Cuadro de texto' }));
    expect(engine.api.setActiveTool).toHaveBeenLastCalledWith({ type: 'text' });
    fireEvent.click(screen.getByRole('button', { name: 'Imagen de la biblioteca' }));
    expect(screen.getByText('Biblioteca del proyecto')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en la presentación' }));
    expect(engine.api.toggleSidebar).toHaveBeenCalledWith({ name: 'default', tab: 'search' });
  });

  it('Diapositiva › Saltar marca la diapositiva en la tira', () => {
    mount();
    openMenu('Diapositiva');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Saltar diapositiva' }));
    expect(within(strip()).getByRole('button', { name: 'Diapositiva 1 · Se salta al presentar' })).toBeTruthy();
    expect(engine.get().find((e) => e.id === 'p1')?.customData?.c2skip).toBe(true);
  });

  it('Ver: notas, tira y cuadrícula se encienden y se apagan', () => {
    mount();
    openMenu('Ver');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Notas del orador' }));
    expect(screen.queryByRole('textbox', { name: 'Notas del orador' })).toBeNull();
    openMenu('Ver');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Mostrar la tira' }));
    expect(screen.queryByRole('complementary', { name: 'Diapositivas' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar la tira' }));
    expect(strip()).toBeTruthy();
    fireEvent.click(within(strip()).getByRole('button', { name: 'Vista de cuadrícula' }));
    const grid = screen.getByRole('region', { name: 'Vista de cuadrícula' });
    expect(within(grid).getByRole('heading', { name: '3 diapositivas' })).toBeTruthy();
    fireEvent.keyDown(within(grid).getByRole('button', { name: 'Diapositiva 3' }), { key: 'Enter' });
    expect(screen.queryByRole('region', { name: 'Vista de cuadrícula' })).toBeNull();
    expect(current()).toBe(3);
  });

  it('en lectura: sin editar, sin «Haz clic para añadir» y sin nueva diapositiva', () => {
    mount({ viewMode: true });
    const bar = screen.getByRole('menubar');
    expect(within(bar).queryByRole('menuitem', { name: 'Editar' })).toBeNull();
    expect(within(bar).getByRole('menuitem', { name: 'Ver' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nueva diapositiva' })).toBeNull();
    const notes = screen.getByRole('textbox', { name: 'Notas del orador' }) as HTMLTextAreaElement;
    expect(notes.readOnly).toBe(true);
    expect(notes.placeholder).toBe('');
    fireEvent.keyDown(document.body, { key: 'm', ctrlKey: true });
    expect(frames()).toHaveLength(3);
  });

  it('cambiar a otro espacio quita el cromo y sus variables, con el MISMO motor', () => {
    const { container } = mount();
    const root = container.querySelector<HTMLElement>('[data-canvas2]')!;
    expect(root.style.getPropertyValue('--slides-top')).not.toBe('');
    openMenu('Ver');
    fireEvent.pointerEnter(screen.getByRole('menuitem', { name: 'Espacio de trabajo' }).parentElement!);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Excalidraw' }));
    expect(container.querySelector('[data-workspace="excalidraw"]')).toBeTruthy();
    expect(screen.queryByRole('menubar')).toBeNull();
    expect(root.style.getPropertyValue('--slides-top')).toBe('');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('el contenido del host para el escenario va en su capa, sobre el hueco de la diapositiva', () => {
    const { container } = mount({ stageOverlay: <p>Trae tu material</p> });
    const overlay = container.querySelector('[data-canvas2] > .canvas2-stage-overlay');
    expect(overlay?.textContent).toBe('Trae tu material');
    const root = container.querySelector<HTMLElement>('[data-canvas2]')!;
    for (const v of ['--slides-top', '--slides-left', '--slides-right', '--slides-bottom']) {
      expect(root.style.getPropertyValue(v), v).not.toBe('');
    }
  });

  it('el host añade título y «Detalles»', () => {
    const onDetails = vi.fn();
    mount({ slides: { title: 'Polimake · deck ES', onDetails } });
    expect(screen.getByText('Polimake · deck ES')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Detalles' }));
    expect(onDetails).toHaveBeenCalled();
  });
});
