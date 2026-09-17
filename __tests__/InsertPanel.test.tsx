// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/core/excal', () => excalMock);
const { InsertPanel } = await import('../src/ui/panels/InsertPanel');
afterEach(cleanup);

describe('inserting from the resource panel', () => {
  it('centers and selects a shape on its page in one undoable operation', () => {
    const state = fakeApi([frame('page', 100, 200, 800, 600)]);
    const api = { ...state.api, setActiveTool: vi.fn() };
    render(<InsertPanel api={api as never} pageId="page" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rectángulo' }));
    const added = state.get().find(el => el.type === 'rectangle')!;
    expect(added).toMatchObject({ frameId: 'page', x: 425, y: 425, width: 150, height: 150, roughness: 0 });
    expect(api.getAppState().selectedElementIds).toEqual({ [added.id]: true });
    expect(state.commits).toHaveLength(1);
    expect(state.commits[0].captureUpdate).toBe('IMMEDIATELY');
    expect(api.setActiveTool).toHaveBeenCalledWith({ type: 'selection' });
  });

  it('filters shapes without changing the document', () => {
    const state = fakeApi([]);
    render(<InsertPanel api={state.api as never} pageId={null} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rombo' } });
    expect(screen.getByRole('button', { name: 'Rombo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rectángulo' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
    expect(screen.getByText('No se encontraron elementos.')).toBeTruthy();
    expect(state.commits).toHaveLength(0);
  });

  it('inserts a text preset with page membership and selection', () => {
    const state = fakeApi([frame('page', 0, 0, 1080, 1080)]);
    render(<InsertPanel api={state.api as never} pageId="page" text />);
    fireEvent.click(screen.getByRole('button', { name: 'Título', exact: true }));
    const added = state.get().find(el => el.type === 'text')!;
    expect(added).toMatchObject({ frameId: 'page', text: 'Título' });
    expect(state.api.getAppState().selectedElementIds).toEqual({ [added.id]: true });
    expect(state.commits[0].captureUpdate).toBe('IMMEDIATELY');
  });
});
