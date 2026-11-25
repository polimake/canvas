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
  it('sin página activa no hay acciones, pero cada página lleva su rótulo', () => {
    const { api } = tres();
    render(<PageActions api={api as never} activePageId={null} />);
    expect(screen.queryByTestId('canvas2-page-actions')).toBeNull();
    // El rótulo de cada hoja lo pinta canvas2 (Excalidraw ya no lo dibuja).
    expect(screen.getAllByTestId('canvas2-page-label')).toHaveLength(3);
  });

  it('el rótulo lleva el número en una ficha y el nombre sin numerar; doble clic renombra', () => {
    const { api } = fakeApi([
      frame('a', 0, 0, 1080, 1350, { name: '1. Portada' }),
      frame('b', 1128, 0, 1080, 1350, { name: 'Página 2' }),
    ]);
    render(<PageActions api={api as never} activePageId="a" />);
    const [portada, segunda] = screen.getAllByTestId('canvas2-page-label');
    expect(portada.textContent).toBe('1Portada');
    // Un nombre de serie ya dice su número: sin ficha.
    expect(segunda.textContent).toBe('Página 2');

    fireEvent.doubleClick(segunda);
    const input = screen.getByLabelText('Renombrar página') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Cierre' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.getSceneElements().find((e: { id: string }) => e.id === 'b')).toMatchObject({ name: 'Cierre' });
  });

  it('Esc cancela el nombre a medio escribir, y renombrar sin cambiar nada no deja deshacer', () => {
    const { api } = fakeApi([
      frame('a', 0, 0, 1080, 1350, { name: 'Portada' }),
      frame('b', 1128, 0, 1080, 1350, { name: 'Cierre' }),
    ]);
    const update = vi.spyOn(api, 'updateScene');
    render(<PageActions api={api as never} activePageId="a" />);
    const segunda = screen.getAllByTestId('canvas2-page-label')[1]!;
    fireEvent.doubleClick(segunda);
    let input = screen.getByLabelText('Renombrar página') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'A medias' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    // El navegador manda blur al quitar el campo: no tiene que guardar.
    fireEvent.blur(input);
    expect(api.getSceneElements().find((e: { id: string }) => e.id === 'b')).toMatchObject({ name: 'Cierre' });
    fireEvent.doubleClick(screen.getAllByTestId('canvas2-page-label')[1]!);
    input = screen.getByLabelText('Renombrar página') as HTMLInputElement;
    fireEvent.blur(input);
    expect(update).not.toHaveBeenCalled();
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

  it('la confirmación es un botón con nombre y se lleva el foco', () => {
    // La papelera se va al armar: sin el foco, el lector no anunciaba nada.
    const { api } = tres();
    render(<PageActions api={api as never} activePageId="b" />);
    fireEvent.click(screen.getByLabelText('Eliminar página'));
    const confirmar = screen.getByRole('button', { name: '¿Eliminar?' });
    expect(document.activeElement).toBe(confirmar);
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
