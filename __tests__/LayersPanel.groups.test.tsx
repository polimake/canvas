// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { LayersPanel, layerItems, groupName } = await import('../src/ui/panels/LayersPanel.js');
const { DEFAULT_LABELS } = await import('../src/ui/shared/labels.js');

afterEach(cleanup);

/** Una opción de encuesta (cinta + texto, agrupadas) y una elipse suelta. */
const encuesta = () =>
  fakeApi([
    frame('p1', 0, 0, 1080, 1920, { name: 'Encuesta' }),
    member('cinta', 'p1', 0, 0, 100, 40, { groupIds: ['g-opcion'] }),
    member('texto', 'p1', 0, 0, 100, 40, { type: 'text', text: 'Bordado', groupIds: ['g-opcion'] }),
    member('adorno', 'p1', 0, 0, 10, 10, { type: 'ellipse' }),
  ]);

describe('Capas: grupos', () => {
  it('un grupo sale UNA vez, plegado, y se llama como su primer texto', () => {
    const { api } = encuesta();
    render(<LayersPanel api={api as never} activePageId="p1" embedded />);
    expect(screen.getByText('Bordado')).toBeTruthy();
    expect(screen.getByText('2 capas')).toBeTruthy();
    // Plegado: sus capas no salen sueltas.
    expect(screen.queryByText('Rectángulo')).toBeNull();
    expect(screen.getByText('Elipse')).toBeTruthy();
  });

  it('desplegado, sus capas salen debajo; un clic en el grupo lo elige entero', () => {
    const { api } = encuesta();
    render(<LayersPanel api={api as never} activePageId="p1" embedded />);
    fireEvent.click(screen.getByLabelText('Ver lo que hay dentro'));
    expect(screen.getByText('Rectángulo')).toBeTruthy();
    expect(screen.getByText('Texto: Bordado')).toBeTruthy();

    fireEvent.click(screen.getByText('Bordado'));
    const state = api.getAppState() as { selectedElementIds: Record<string, boolean>; selectedGroupIds?: Record<string, boolean> };
    expect(state.selectedElementIds).toEqual({ cinta: true, texto: true });
    expect(state.selectedGroupIds).toEqual({ 'g-opcion': true });
  });

  it('el orden: el grupo va donde su capa más alta; un grupo de una sola capa es una capa', () => {
    const rows = [
      { id: 'a', type: 'rectangle', groupIds: ['g1'] },
      { id: 'b', type: 'ellipse' },
      { id: 'c', type: 'line', groupIds: ['g1'] },
      { id: 'd', type: 'line', groupIds: ['solo'] },
    ] as never[];
    expect(layerItems(rows, new Set()).map((i) => (i.kind === 'group' ? `G:${i.id}` : i.el.id))).toEqual(['G:g1', 'b', 'd']);
    expect(layerItems(rows, new Set(['g1'])).map((i) => (i.kind === 'group' ? `G:${i.id}` : `${i.el.id}@${i.depth}`))).toEqual([
      'G:g1', 'a@1', 'c@1', 'b@0', 'd@0',
    ]);
  });

  it('sin texto dentro, «Grupo»', () => {
    expect(groupName([{ id: 'x', type: 'line' }] as never[], DEFAULT_LABELS.layers)).toBe('Grupo');
  });
});
