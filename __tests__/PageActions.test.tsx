// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { PageActions } = await import('../src/ui/navigation/PageActions.js');

afterEach(cleanup);

const tres = () =>
  fakeApi([
    frame('a', 0, 0, 1080, 1350),
    frame('b', 1128, 0, 1080, 1350),
    frame('c', 2256, 0, 1080, 1350),
  ]);

describe('PageActions', () => {
  it('no se dibuja sin página activa', () => {
    const { api } = tres();
    const { container } = render(<PageActions api={api as never} activePageId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('se ancla a la esquina superior DERECHA del marco', () => {
    // El nombre de la página lo dibuja Excalidraw a la izquierda; anclar ahí lo
    // taparía. El borde derecho es `x + width`, en coordenadas de pantalla.
    const { api } = tres();
    api.updateScene({ appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } } });
    render(<PageActions api={api as never} activePageId="a" />);

    const barra = screen.getByTestId('canvas2-page-actions') as HTMLElement;
    expect(barra.style.left).toBe('1080px');
    // Sujeta por su borde derecho para no despegarse al crecer.
    expect(barra.style.transform).toContain('translateX(-100%)');
  });

  it('el zoom y el scroll entran en la posición', () => {
    const { api } = tres();
    api.updateScene({ appState: { scrollX: 100, scrollY: 50, zoom: { value: 0.5 } } });
    render(<PageActions api={api as never} activePageId="b" />);

    const barra = screen.getByTestId('canvas2-page-actions') as HTMLElement;
    // (x + width + scrollX) * zoom = (1128 + 1080 + 100) * 0.5
    expect(barra.style.left).toBe('1154px');
  });

  it('mover a la izquierda no se ofrece en la primera página', () => {
    const { api } = tres();
    render(<PageActions api={api as never} activePageId="a" />);
    expect(screen.queryByLabelText('Mover a la izquierda')).toBeNull();
    expect(screen.getByLabelText('Mover a la derecha')).toBeTruthy();
  });

  it('mover a la derecha no se ofrece en la última', () => {
    const { api } = tres();
    render(<PageActions api={api as never} activePageId="c" />);
    expect(screen.getByLabelText('Mover a la izquierda')).toBeTruthy();
    expect(screen.queryByLabelText('Mover a la derecha')).toBeNull();
  });

  it('borrar pide confirmación antes de hacerlo', () => {
    // Dos pasos en vez de `window.confirm`: el primer clic arma, el segundo
    // borra. Un clic accidental no puede llevarse una página.
    const { api, get } = tres();
    render(<PageActions api={api as never} activePageId="b" />);

    fireEvent.click(screen.getByLabelText('Eliminar página'));
    expect(get().filter((e: { type: string }) => e.type === 'frame')).toHaveLength(3);

    fireEvent.click(screen.getByText('¿Eliminar?'));
    const quedan = get().filter((e: { type: string }) => e.type === 'frame');
    expect(quedan.map((f: { id: string }) => f.id)).toEqual(['a', 'c']);
  });

  it('cambiar de página desarma el borrado', () => {
    // Si no, el "¿Eliminar?" armado en una se dispararía sobre otra.
    const { api } = tres();
    const { rerender } = render(<PageActions api={api as never} activePageId="b" />);
    fireEvent.click(screen.getByLabelText('Eliminar página'));
    expect(screen.getByText('¿Eliminar?')).toBeTruthy();

    rerender(<PageActions api={api as never} activePageId="c" />);
    expect(screen.queryByText('¿Eliminar?')).toBeNull();
  });

  it('una página bloqueada no ofrece borrarse', () => {
    const { api } = fakeApi([
      frame('a', 0, 0, 1080, 1350),
      frame('b', 1128, 0, 1080, 1350, { locked: true }),
    ]);
    render(<PageActions api={api as never} activePageId="b" />);
    expect(screen.queryByLabelText('Eliminar página')).toBeNull();
    expect(screen.getByLabelText('Desbloquear página')).toBeTruthy();
  });

  it('con una sola página no se ofrece borrarla', () => {
    const { api } = fakeApi([frame('a', 0, 0, 1080, 1350)]);
    render(<PageActions api={api as never} activePageId="a" />);
    expect(screen.queryByLabelText('Eliminar página')).toBeNull();
  });

  it('sigue al lienzo cuando cambia el scroll', () => {
    const { api } = tres();
    api.updateScene({ appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } } });
    render(<PageActions api={api as never} activePageId="a" />);
    expect((screen.getByTestId('canvas2-page-actions') as HTMLElement).style.left).toBe('1080px');

    act(() => {
      api.updateScene({ appState: { scrollX: -500 } });
    });
    expect((screen.getByTestId('canvas2-page-actions') as HTMLElement).style.left).toBe('580px');
  });

  it('usa las etiquetas del host', () => {
    const { api } = tres();
    render(
      <PageActions
        api={api as never}
        activePageId="b"
        labels={{ pages: { duplicate: 'Duplicate page', confirmDelete: 'Delete?' } }}
      />,
    );
    expect(screen.getByLabelText('Duplicate page')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Eliminar página'));
    expect(screen.getByText('Delete?')).toBeTruthy();
  });
});
