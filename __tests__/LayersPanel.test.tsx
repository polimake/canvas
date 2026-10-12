// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { LayersPanel } = await import('../src/ui/panels/LayersPanel.js');

afterEach(cleanup);

/** Una página con una capa de cada tipo que el panel sabe nombrar. */
const unaDeCada = () =>
  fakeApi([
    frame('p1', 0, 0, 1080, 1350, { name: 'Portada' }),
    member('img', 'p1', 0, 0, 100, 100, { type: 'image' }),
    member('rect', 'p1', 0, 0, 100, 100),
    member('ell', 'p1', 0, 0, 100, 100, { type: 'ellipse' }),
    member('dia', 'p1', 0, 0, 100, 100, { type: 'diamond' }),
    member('lin', 'p1', 0, 0, 100, 100, { type: 'line' }),
    member('arr', 'p1', 0, 0, 100, 100, { type: 'arrow' }),
    member('draw', 'p1', 0, 0, 100, 100, { type: 'freedraw' }),
    member('txt', 'p1', 0, 0, 100, 40, { type: 'text', text: 'Hola  mundo' }),
    member('vacio', 'p1', 0, 0, 100, 40, { type: 'text', text: '' }),
    member('oculta', 'p1', 0, 0, 100, 100, { opacity: 0, locked: true }),
  ]);

describe('LayersPanel', () => {
  it('sin etiquetas del host, todo sale en español como siempre', () => {
    const { api } = unaDeCada();
    render(<LayersPanel api={api as never} activePageId="p1" />);

    expect(screen.getByText('Capas')).toBeTruthy();
    for (const nombre of ['Imagen', 'Elipse', 'Rombo', 'Línea', 'Flecha', 'Trazo', 'Texto: Hola mundo', 'Texto']) {
      expect(screen.getByText(nombre), nombre).toBeTruthy();
    }
    // El rectángulo y la capa oculta, que también lo es.
    expect(screen.getAllByText('Rectángulo')).toHaveLength(2);

    expect(screen.getAllByLabelText('Usar como fondo')).toHaveLength(1);
    expect(screen.getAllByLabelText('Extender a la página')).toHaveLength(1);
    expect(screen.getAllByLabelText('Ocultar')).toHaveLength(9);
    expect(screen.getAllByLabelText('Mostrar')).toHaveLength(1);
    expect(screen.getAllByLabelText('Bloquear')).toHaveLength(9);
    expect(screen.getAllByLabelText('Desbloquear')).toHaveLength(1);
    expect(screen.getAllByLabelText('Eliminar')).toHaveLength(10);

    for (const alinear of [
      'Alinear a la izquierda',
      'Centrar horizontalmente',
      'Alinear a la derecha',
      'Alinear arriba',
      'Centrar verticalmente',
      'Alinear abajo',
    ]) {
      expect(screen.getByTitle(alinear), alinear).toBeTruthy();
    }
    expect(screen.getByTitle('Doble clic para renombrar la página').textContent).toBe('Portada');
  });

  it('una página vacía y sin nombre lo dice', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 1080, 1350, { name: null })]);
    render(<LayersPanel api={api as never} activePageId="p1" />);
    expect(screen.getByText('Esta página está vacía.')).toBeTruthy();
    expect(screen.getByTitle('Doble clic para renombrar la página').textContent).toBe('Página');
  });

  it('empotrado no repite el rótulo: lo pone la pestaña', () => {
    const { api } = unaDeCada();
    render(<LayersPanel api={api as never} activePageId="p1" embedded />);
    expect(screen.queryByText('Capas')).toBeNull();
  });

  it('empotrado, la fila de alinear lleva su rótulo, y sale de las etiquetas', () => {
    const { api } = unaDeCada();
    const { unmount } = render(<LayersPanel api={api as never} activePageId="p1" embedded />);
    expect(screen.getByText('Alinear')).toBeTruthy();
    unmount();
    render(
      <LayersPanel api={api as never} activePageId="p1" embedded labels={{ layers: { align: 'Align' } }} />,
    );
    expect(screen.getByText('Align')).toBeTruthy();
    expect(screen.queryByText('Alinear')).toBeNull();
  });

  it('usa las etiquetas del host, y lo que no trae sigue en español', () => {
    const { api } = unaDeCada();
    render(
      <LayersPanel
        api={api as never}
        activePageId="p1"
        labels={{
          dock: { layers: 'Layers' },
          layers: {
            image: 'Image',
            ellipse: 'Ellipse',
            textWith: (excerpt) => `Text: ${excerpt}`,
            useAsBackground: 'Use as background',
            hide: 'Hide',
            renameHint: 'Double-click to rename the page',
          },
          align: { left: 'Align left' },
        }}
      />,
    );
    expect(screen.getByText('Layers')).toBeTruthy();
    expect(screen.getByText('Image')).toBeTruthy();
    expect(screen.getByText('Ellipse')).toBeTruthy();
    expect(screen.getByText('Text: Hola mundo')).toBeTruthy();
    expect(screen.getAllByLabelText('Use as background')).toHaveLength(1);
    expect(screen.getAllByLabelText('Hide')).toHaveLength(9);
    expect(screen.getByTitle('Align left')).toBeTruthy();
    expect(screen.getByTitle('Double-click to rename the page')).toBeTruthy();
    // Sin traducir por el host:
    expect(screen.getByText('Rombo')).toBeTruthy();
    expect(screen.getAllByLabelText('Mostrar')).toHaveLength(1);
    expect(screen.getByTitle('Alinear abajo')).toBeTruthy();
  });

  it('una página sin nombre se enseña con el del host', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 1080, 1350, { name: null })]);
    render(
      <LayersPanel
        api={api as never}
        activePageId="p1"
        labels={{ pages: { untitled: 'Page' }, layers: { empty: 'This page is empty.' } }}
      />,
    );
    expect(screen.getByText('This page is empty.')).toBeTruthy();
    expect(screen.getByText('Page')).toBeTruthy();
  });
});
