// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const insertImageFromUrl = vi.fn();
vi.mock('../src/core/media', () => ({
  insertImageFromUrl: (...args: unknown[]) => insertImageFromUrl(...args),
}));

const { BrandGallery } = await import('../src/ui/panels/BrandGallery.js');

afterEach(() => {
  cleanup();
  insertImageFromUrl.mockReset();
});

const KIT = {
  mainColor: '#e6b019',
  colorPalette: ['#ca7507'],
  smallLogo: 'https://cdn/logo-small.png',
  logoBlack: 'https://cdn/logo-black.png',
};

const escena = () =>
  fakeApi([
    frame('p1', 0, 0, 1080, 1350),
    member('rect', 'p1', 10, 10, 100, 100),
    member('txt', 'p1', 10, 200, 100, 40, { type: 'text' }),
  ]);

describe('BrandGallery', () => {
  it('no se dibuja sin marca: un panel vacío solo ocupa lienzo', () => {
    const { api } = escena();
    const { container } = render(<BrandGallery api={api as never} brandKit={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('no se dibuja en modo lectura: todo lo que hace es mutar', () => {
    const { api } = escena();
    const { container } = render(<BrandGallery api={api as never} brandKit={KIT} viewMode />);
    expect(container.firstChild).toBeNull();
  });

  it('pinta el color principal delante y sin duplicar', () => {
    const { api } = escena();
    render(<BrandGallery api={api as never} brandKit={{ ...KIT, colorPalette: ['#e6b019', '#ca7507'] }} />);
    const swatches = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label')?.startsWith('#'));
    expect(swatches.map((b) => b.getAttribute('aria-label'))).toEqual(['#e6b019', '#ca7507']);
  });

  it('sin selección, el color queda como predeterminado y NO toca la escena', () => {
    const { api, commits } = escena();
    render(<BrandGallery api={api as never} brandKit={KIT} />);
    fireEvent.click(screen.getByLabelText('#e6b019'));

    expect(commits).toHaveLength(1);
    expect(commits[0].appState).toMatchObject({
      currentItemStrokeColor: '#e6b019',
      currentItemBackgroundColor: '#e6b019',
    });
    expect(commits[0].elements).toBeUndefined();
  });

  it('con selección, el relleno va a las figuras y el trazo a los textos', () => {
    // La regla es por TIPO de elemento, y es la que hay que poder explicar en
    // una frase; si se invierte, colorear un texto lo dejaría invisible.
    const { api, get, setSelected } = escena();
    render(<BrandGallery api={api as never} brandKit={KIT} />);
    act(() => setSelected(['rect', 'txt']));

    fireEvent.click(screen.getByLabelText('#e6b019'));

    const rect = get().find((e: { id: string }) => e.id === 'rect');
    const txt = get().find((e: { id: string }) => e.id === 'txt');
    expect(rect.backgroundColor).toBe('#e6b019');
    expect(rect.strokeColor).not.toBe('#e6b019');
    expect(txt.strokeColor).toBe('#e6b019');
  });

  it('no pinta lo que no está seleccionado', () => {
    const { api, get, setSelected } = escena();
    render(<BrandGallery api={api as never} brandKit={KIT} />);
    act(() => setSelected(['rect']));
    fireEvent.click(screen.getByLabelText('#e6b019'));

    const txt = get().find((e: { id: string }) => e.id === 'txt');
    expect(txt.strokeColor).not.toBe('#e6b019');
  });

  it('inserta el logo por referencia remota, en la página activa', async () => {
    const { api } = escena();
    render(<BrandGallery api={api as never} brandKit={KIT} activePageId="p1" />);
    fireEvent.click(screen.getByTitle('Insertar negro'));

    await waitFor(() => expect(insertImageFromUrl).toHaveBeenCalled());
    expect(insertImageFromUrl).toHaveBeenCalledWith(api, 'https://cdn/logo-black.png', {
      pageId: 'p1',
    });
  });

  it('solo ofrece los logos que existen', () => {
    const { api } = escena();
    render(<BrandGallery api={api as never} brandKit={{ mainColor: '#e6b019', logoBlack: 'https://cdn/b.png' }} />);
    expect(screen.getByTitle('Insertar negro')).toBeTruthy();
    expect(screen.queryByTitle('Insertar blanco')).toBeNull();
  });

  it('usa las etiquetas del host cuando se las pasan', () => {
    const { api } = escena();
    render(
      <BrandGallery
        api={api as never}
        brandKit={KIT}
        labels={{ brand: { title: 'Brand', black: 'Black', insertLogo: (l) => `Insert ${l}` } }}
      />,
    );
    expect(screen.getByText('Brand')).toBeTruthy();
    expect(screen.getByTitle('Insert Black')).toBeTruthy();
  });
});
