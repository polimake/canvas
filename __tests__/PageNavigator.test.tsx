// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/excal', () => excalMock);
// Rasterizar necesita un canvas real; aquí solo importa la tira, no la imagen.
vi.mock('../src/pageThumbnails', () => ({ usePageThumbnails: () => ({}) }));

const { PageNavigator } = await import('../src/PageNavigator.js');

beforeEach(() => {
  // jsdom no implementa ninguna de las dos.
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
});

// Sin `globals: true` en la config, testing-library NO registra su limpieza
// automática: los renders se acumularían en el body y las consultas empezarían
// a encontrar elementos de tests anteriores.
afterEach(cleanup);

const tresPaginas = () =>
  fakeApi([
    frame('a', 0, 0, 1080, 1350, { name: 'Portada' }),
    frame('b', 1128, 0, 1080, 1350, { name: 'Página 2' }),
    frame('c', 2256, 0, 1080, 1350, { name: 'Página 3' }),
  ]);

/** El `dataTransfer` que jsdom no trae. */
function dt() {
  const store: Record<string, string> = {};
  return {
    setData: (t: string, v: string) => {
      store[t] = v;
    },
    getData: (t: string) => store[t] ?? '',
    setDragImage: vi.fn(),
    get types() {
      return Object.keys(store);
    },
    effectAllowed: '',
    dropEffect: '',
  };
}

describe('PageNavigator', () => {
  it('pinta una tarjeta por página, numeradas', () => {
    const { api } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('el nombre de la página va en el title, no como texto visible', () => {
    // Abajo SOLO van páginas: miniatura y número. El nombre se consulta.
    const { api } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    expect(screen.getByTitle('Portada')).toBeTruthy();
    expect(screen.queryByText('Portada')).toBeNull();
  });

  it('al hacer clic avisa al host de la página activa', () => {
    const { api } = tresPaginas();
    const onActiveChange = vi.fn();
    render(<PageNavigator api={api as never} onActiveChange={onActiveChange} />);
    fireEvent.click(screen.getByTitle('Página 3'));
    expect(onActiveChange).toHaveBeenCalledWith('c');
  });

  it('arrastrar y soltar reordena de verdad la escena', () => {
    const { api, get } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    const transfer = dt();

    fireEvent.dragStart(screen.getByTitle('Página 3'), { dataTransfer: transfer });
    fireEvent.dragOver(screen.getByTitle('Portada'), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTitle('Portada'), { dataTransfer: transfer });

    const orden = get()
      .filter((e: { type: string }) => e.type === 'frame')
      .sort((a: { x: number }, b: { x: number }) => a.x - b.x)
      .map((f: { id: string }) => f.id);
    expect(orden).toEqual(['c', 'a', 'b']);
  });

  it('soltar una página sobre sí misma no cambia nada', () => {
    const { api, commits } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    const transfer = dt();
    const chip = screen.getByTitle('Portada');

    fireEvent.dragStart(chip, { dataTransfer: transfer });
    fireEvent.drop(chip, { dataTransfer: transfer });
    expect(commits).toHaveLength(0);
  });

  it('en modo lectura las tarjetas no se pueden arrastrar', () => {
    const { api } = tresPaginas();
    render(<PageNavigator api={api as never} viewMode />);
    expect(screen.getByTitle('Portada').getAttribute('draggable')).toBe('false');
  });

  it('doble clic abre el renombrado y Enter lo guarda', () => {
    const { api, get } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    fireEvent.doubleClick(screen.getByTitle('Portada'));

    const input = within(screen.getByTitle('Portada')).getByDisplayValue('Portada');
    fireEvent.change(input, { target: { value: 'Nueva' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const a = get().find((e: { id: string }) => e.id === 'a');
    expect(a.name).toBe('Nueva');
  });

  it('renombrar con Escape descarta el cambio', () => {
    const { api, get } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    fireEvent.doubleClick(screen.getByTitle('Portada'));
    const input = within(screen.getByTitle('Portada')).getByDisplayValue('Portada');
    fireEvent.change(input, { target: { value: 'Nueva' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    const a = get().find((e: { id: string }) => e.id === 'a');
    expect(a.name).toBe('Portada');
  });

  it('acepta etiquetas del host sin perder las que no traduce', () => {
    const { api } = tresPaginas();
    render(<PageNavigator api={api as never} labels={{ dock: { layers: 'Layers' } }} />);
    // La tira no muestra textos propios, pero debe aceptar el contrato sin
    // romperse: es la garantía de que el reparto de etiquetas llega hasta aquí.
    expect(screen.getByText('1')).toBeTruthy();
  });
});
