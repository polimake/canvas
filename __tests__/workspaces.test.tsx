// @vitest-environment jsdom
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { excalMock, fakeApi, member } from './helpers';

let engine = fakeApi([member('shape', '', 20, 20, 100, 100)]);
const mounted = vi.fn();
const unmounted = vi.fn();
vi.mock('../src/core/excal', () => ({
  ...excalMock,
  Excalidraw: function Engine({ excalidrawAPI }: { excalidrawAPI: (api: unknown) => void }) {
    useEffect(() => {
      mounted();
      excalidrawAPI(engine.api);
      return unmounted;
    }, []);
    return <div data-testid="engine" />;
  },
}));

const { Canvas2Editor } = await import('../src/ui/editor/Canvas2');

beforeEach(() => {
  engine = fakeApi([member('shape', '', 20, 20, 100, 100)]);
  mounted.mockClear();
  unmounted.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('workspace switching', () => {
  it('preserves the mounted engine, scene, selection and history writes across switches', () => {
    engine.setSelected(['shape']);
    const onChange = vi.fn();
    const onSceneChange = vi.fn();
    const { container } = render(<Canvas2Editor onWorkspaceChange={onChange} onSceneChange={onSceneChange}
      library={<div>Media from host</div>} componentsPanel={<div>Saved components</div>} />);
    const surface = screen.getByTestId('engine');
    const scene = engine.get();
    const state = engine.api.getAppState();
    const history = [...engine.commits];
    fireEvent.change(screen.getByRole('combobox', { name: 'Espacio de trabajo' }), { target: { value: 'advanced' } });
    expect(container.querySelector('[data-workspace="advanced"]')).toBeTruthy();
    expect(screen.getByText('Media from host')).toBeTruthy();
    expect(screen.getByText('Saved components')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'design' } });
    expect(screen.getByTestId('engine')).toBe(surface);
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    expect(engine.get()).toBe(scene);
    expect(engine.api.getAppState()).toBe(state);
    expect(engine.commits).toEqual(history);
    expect(onSceneChange).not.toHaveBeenCalled();
    expect(onChange.mock.calls).toEqual([['advanced'], ['design']]);
  });

  it('lets a controlled host decide when the workspace changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Canvas2Editor workspace="design" onWorkspaceChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'advanced' } });
    expect(onChange).toHaveBeenCalledWith('advanced');
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('design');
    rerender(<Canvas2Editor workspace="advanced" onWorkspaceChange={onChange} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('advanced');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('supports an initial workspace, translated labels and collapsible panels', () => {
    render(<Canvas2Editor defaultWorkspace="advanced" library={<div>Assets</div>}
      labels={{ workspace: { label: 'Workspace', hidePanels: 'Hide', showPanels: 'Show' } }} />);
    expect((screen.getByRole('combobox', { name: 'Workspace' }) as HTMLSelectElement).value).toBe('advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByRole('complementary')).toBeTruthy();
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('keeps editing chrome and host insertion slots out of read-only previews', () => {
    render(<Canvas2Editor viewMode library={<div>Assets</div>} componentsPanel={<div>Components</div>} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByText('Assets')).toBeNull();
    expect(screen.queryByText('Components')).toBeNull();
  });
});
