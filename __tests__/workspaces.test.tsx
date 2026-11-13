// @vitest-environment jsdom
import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { excalMock, fakeApi, member, frame } from './helpers';
import { WORKSPACE_STORAGE_KEY } from '../src/ui/workspaces/preference';

let engine = fakeApi([member('shape', '', 20, 20, 100, 100)]);
const mounted = vi.fn();
const unmounted = vi.fn();
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
  Excalidraw: function Engine({ excalidrawAPI, children, gridModeEnabled, theme }: { excalidrawAPI: (api: unknown) => void; children: ReactNode; gridModeEnabled?: boolean; theme?: string }) {
    useEffect(() => {
      mounted();
      excalidrawAPI(engine.api);
      return unmounted;
    }, []);
    return <div data-testid="engine" data-grid={gridModeEnabled} data-theme={theme}>{children}</div>;
  },
}));
const { Canvas2Editor } = await import('../src/ui/editor/Canvas2');
const choose = (name: string) => fireEvent.click(screen.getByRole('menuitemradio', { name }));
const checked = (name: string) => screen.getByRole('menuitemradio', { name }).getAttribute('aria-checked');

beforeEach(() => {
  localStorage.clear();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  engine = fakeApi([member('shape', '', 20, 20, 100, 100)]);
  mounted.mockClear();
  unmounted.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('workspace switching', () => {
  it('preserves the engine, scene, selection and history across menu choices', () => {
    engine.setSelected(['shape']);
    const onChange = vi.fn();
    const onSceneChange = vi.fn();
    const { container } = render(<Canvas2Editor onWorkspaceChange={onChange} onSceneChange={onSceneChange}
      library={<div>Media from host</div>} componentsPanel={<div>Saved components</div>} />);
    const surface = screen.getByTestId('engine');
    const scene = engine.get();
    const state = engine.api.getAppState();
    const history = [...engine.commits];
    choose('Experta');
    expect(container.querySelector('[data-workspace="advanced"]')).toBeTruthy();
    expect(screen.getByText('Saved components')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Archivos' }));
    expect(screen.getByText('Media from host')).toBeTruthy();
    expect(surface.getAttribute('data-grid')).toBe('false');
    choose('Canva');
    expect(surface.hasAttribute('data-grid')).toBe(false);
    choose('Excalidraw');
    expect(container.querySelector('[data-workspace="excalidraw"]')).toBeTruthy();
    expect(screen.getByTestId('engine')).toBe(surface);
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    expect(engine.get()).toBe(scene);
    expect(engine.api.getAppState()).toBe(state);
    expect(engine.commits).toEqual(history);
    expect(onSceneChange).not.toHaveBeenCalled();
    expect(onChange.mock.calls).toEqual([['advanced'], ['design'], ['excalidraw']]);
  });

  it('lets a controlled host accept a choice before persisting it', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Canvas2Editor workspace="design" onWorkspaceChange={onChange} />);
    choose('Experta');
    expect(onChange).toHaveBeenCalledWith('advanced');
    expect(checked('Canva')).toBe('true');
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe('design');
    rerender(<Canvas2Editor workspace="advanced" onWorkspaceChange={onChange} />);
    expect(checked('Experta')).toBe('true');
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe('advanced');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('keeps translated choices in the menu without a toolbar or hide button', () => {
    const { container } = render(<Canvas2Editor defaultWorkspace="advanced" library={<div>Assets</div>}
      labels={{ workspace: { label: 'Workspace', advanced: 'Advanced', hidePanels: 'Hide', showPanels: 'Show' } }} />);
    expect(screen.getByRole('group', { name: 'Workspace' })).toBeTruthy();
    expect(checked('Advanced')).toBe('true');
    expect(container.querySelector('.canvas2-workspace-header')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show' })).toBeNull();
    expect(screen.getByRole('complementary')).toBeTruthy();
  });

  // Excalidraw's Spanish has no string for its frame tool, so the menu entry read
  // "Frame tool" in a Spanish editor. The stylesheet paints the editor's own label
  // over it, and reads it from this custom property.
  it('hands the frame tool label to the stylesheet in the editor language', () => {
    const { container, rerender } = render(<Canvas2Editor />);
    const root = () => container.querySelector('[data-canvas2]') as HTMLElement;
    expect(root().style.getPropertyValue('--c2-frame-tool')).toBe('"Marco"');
    expect(root().style.getPropertyValue('--c2-find-on-canvas')).toBe('"Buscar en el lienzo"');
    rerender(<Canvas2Editor labels={{ workspace: { frameTool: 'Frame tool', findOnCanvas: 'Find on canvas' } }} />);
    expect(root().style.getPropertyValue('--c2-frame-tool')).toBe('"Frame tool"');
    expect(root().style.getPropertyValue('--c2-find-on-canvas')).toBe('"Find on canvas"');
  });

  it('keeps workspace choices and host insertion slots out of read-only previews', () => {
    render(<Canvas2Editor viewMode library={<div>Assets</div>} componentsPanel={<div>Components</div>}
      agentPanel={<div>Agent conversation</div>} />);
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByText('Assets')).toBeNull();
    expect(screen.queryByText('Components')).toBeNull();
    expect(screen.queryByText('Agent conversation')).toBeNull();
  });

  it('offers the host agent in both workspaces without remounting the editor', () => {
    render(<Canvas2Editor library={<div>Assets</div>} agentPanel={<div>Agent conversation</div>}
      labels={{ dock: { agent: 'Assistant' } }} />);
    expect(screen.queryByText('Agent conversation')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }));
    expect(screen.getByRole('region', { name: 'Assistant' }).textContent).toContain('Agent conversation');
    choose('Experta');
    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }));
    expect(screen.getByText('Agent conversation')).toBeTruthy();
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  });

  it.each([undefined, 'invalid'])('defaults to Excalidraw for a missing or invalid preference (%s)', (saved) => {
    if (saved) localStorage.setItem(WORKSPACE_STORAGE_KEY, saved);
    render(<Canvas2Editor />);
    expect(checked('Excalidraw')).toBe('true');
  });

  it('remembers the selection on remount, including the page editor', () => {
    const { unmount } = render(<Canvas2Editor />);
    choose('Experta');
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe('advanced');
    unmount();
    render(<Canvas2Editor pages />);
    expect(checked('Experta')).toBe('true');
    choose('Canva');
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe('design');
  });

  it('still switches when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<Canvas2Editor />);
    choose('Experta');
    expect(checked('Experta')).toBe('true');
  });
});


it('waits for hydration and opens the page selected in the preview', () => {
  const frames = [frame('p1', 0, 0, 300, 400), frame('p2', 420, 0, 300, 400), frame('p3', 840, 0, 300, 400)];
  engine = fakeApi([]);
  const scroll = vi.spyOn(engine.api, 'scrollToContent');
  const active = vi.fn();
  render(<Canvas2Editor pages initialScene={{ elements: frames as never }} initialPageIndex={2} onActivePageChange={active} />);
  expect(scroll).not.toHaveBeenCalled();
  expect(engine.get()).toEqual([]);
  act(() => { engine.api.updateScene({ elements: frames }); });
  expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ id: 'p3' }), expect.anything());
  expect(active).toHaveBeenLastCalledWith('p3');
  expect(engine.get().filter((element) => element.type === 'frame')).toHaveLength(3);
});

it('clamps a preview page that was removed before entering the editor', () => {
  engine = fakeApi([frame('p1', 0, 0, 300, 400), frame('p2', 420, 0, 300, 400)]);
  const active = vi.fn();
  render(<Canvas2Editor pages initialPageIndex={8} onActivePageChange={active} />);
  act(() => { engine.api.updateScene({ elements: engine.get() }); });
  expect(active).toHaveBeenLastCalledWith('p2');
});

describe('dark theme', () => {
  it('keeps a page design in its real colours: dark chrome, light scene', () => {
    const { container, unmount } = render(<Canvas2Editor theme="dark" pages />);
    // El oscuro de Excalidraw invierte el lienzo: un diseño rojo salía rosa.
    expect(screen.getByTestId('engine').getAttribute('data-theme')).toBe('light');
    expect(container.querySelector('[data-canvas2]')?.getAttribute('data-canvas2-theme')).toBe('dark');
    unmount();
    // Una pizarra sin páginas conserva el modo noche nativo.
    render(<Canvas2Editor theme="dark" />);
    expect(screen.getByTestId('engine').getAttribute('data-theme')).toBe('dark');
  });
});
