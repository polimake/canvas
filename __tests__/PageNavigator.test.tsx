// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/core/excal', () => excalMock);
// Rasterizar necesita un canvas real; aquí solo importa la tira, no la imagen.
vi.mock('../src/ui/hooks/pageThumbnails', () => ({ usePageThumbnails: () => ({}) }));

const { PageNavigator } = await import('../src/ui/navigation/PageNavigator.js');

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

/**
 * Arrastra con el puntero, como en el escritorio (desktop#371): jsdom no mide
 * nada, así que cada ficha dice dónde está por su orden (120 px de ancho).
 */
function arrastrar(desde: HTMLElement, hastaX: number) {
  const fichas = Array.from(document.querySelectorAll<HTMLElement>('.canvas2-page-chip'));
  fichas.forEach((f, i) => {
    f.getBoundingClientRect = () =>
      ({ left: i * 120, top: 0, width: 100, height: 120, right: i * 120 + 100, bottom: 120, x: i * 120, y: 0 }) as DOMRect;
  });
  const x0 = desde.getBoundingClientRect().left + 50;
  fireEvent.pointerDown(desde, { button: 0, pointerId: 1, clientX: x0, clientY: 60 });
  const mover = (tipo: string, x: number) => {
    const ev = new MouseEvent(tipo, { clientX: x, clientY: 60, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerId', { value: 1 });
    act(() => {
      window.dispatchEvent(ev);
    });
  };
  mover('pointermove', x0 + (hastaX > x0 ? 20 : -20));
  mover('pointermove', hastaX);
  mover('pointerup', hastaX);
  // El navegador manda un clic tras el `pointerup`: el arrastre se lo traga.
  act(() => desde.click());
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

    arrastrar(screen.getByTitle('Página 3'), 10);

    const orden = get()
      .filter((e: { type: string }) => e.type === 'frame')
      .sort((a: { x: number }, b: { x: number }) => a.x - b.x)
      .map((f: { id: string }) => f.id);
    expect(orden).toEqual(['c', 'a', 'b']);
  });

  it('soltar una página sobre sí misma no cambia nada', () => {
    const { api, commits } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    arrastrar(screen.getByTitle('Portada'), 40);
    expect(commits).toHaveLength(0);
  });

  it('en modo lectura las tarjetas no se pueden arrastrar', () => {
    const { api, commits } = tresPaginas();
    render(<PageNavigator api={api as never} viewMode />);
    arrastrar(screen.getByTitle('Página 3'), 10);
    expect(commits).toHaveLength(0);
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

  // El "+" de `PageActions` se ancla a la esquina del marco y con zoom de
  // trabajo queda fuera de pantalla: en un contenido recién creado no había
  // ningún camino visible para crear la segunda página.
  it('añade una página al final, del tamaño de la última', () => {
    const { api, get } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    fireEvent.click(screen.getByTestId('canvas2-add-page'));

    const marcos = get().filter((e: { type: string }) => e.type === 'frame');
    expect(marcos).toHaveLength(4);
    const nueva = marcos[marcos.length - 1];
    expect(nueva.width).toBe(1080);
    expect(nueva.height).toBe(1350);
  });

  it('el revisor con enlace público no puede añadir páginas', () => {
    const { api } = tresPaginas();
    render(<PageNavigator api={api as never} viewMode />);
    expect(screen.queryByTestId('canvas2-add-page')).toBeNull();
  });

  // Crear en medio obligaba a crear al final y arrastrar hasta su sitio: dos
  // gestos y dos entradas de deshacer para insertar una página.
  it('la juntura inserta EN MEDIO, no al final', () => {
    const { api, get } = tresPaginas();
    render(<PageNavigator api={api as never} />);

    // Hay una juntura ANTES de cada página; la segunda inserta entre a y b.
    fireEvent.click(screen.getAllByTestId('canvas2-insert-page')[1]);

    const orden = get()
      .filter((e: { type: string }) => e.type === 'frame')
      .sort((a: { x: number }, b: { x: number }) => a.x - b.x)
      .map((f: { id: string }) => f.id);
    expect(orden).toHaveLength(4);
    expect(orden[0]).toBe('a');
    expect(orden[2]).toBe('b');
    expect(orden[3]).toBe('c');
  });

  it('la juntura de la primera página inserta en cabeza', () => {
    const { api, get, commits } = tresPaginas();
    render(<PageNavigator api={api as never} />);
    fireEvent.click(screen.getAllByTestId('canvas2-insert-page')[0]);

    const orden = get()
      .filter((e: { type: string }) => e.type === 'frame')
      .sort((a: { x: number }, b: { x: number }) => a.x - b.x)
      .map((f: { id: string }) => f.id);
    expect(orden.slice(1)).toEqual(['a', 'b', 'c']);
    // Un solo gesto, una sola entrada de deshacer.
    expect(commits).toHaveLength(1);
  });

  it('en modo lectura no hay junturas', () => {
    const { api } = tresPaginas();
    render(<PageNavigator api={api as never} viewMode />);
    expect(screen.queryAllByTestId('canvas2-insert-page')).toHaveLength(0);
  });

  it('acepta etiquetas del host sin perder las que no traduce', () => {
    const { api } = tresPaginas();
    render(<PageNavigator api={api as never} labels={{ dock: { layers: 'Layers' } }} />);
    // La tira no muestra textos propios, pero debe aceptar el contrato sin
    // romperse: es la garantía de que el reparto de etiquetas llega hasta aquí.
    expect(screen.getByText('1')).toBeTruthy();
  });
});
