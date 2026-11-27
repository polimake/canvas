import { describe, it, expect, vi } from 'vitest';
import { excalMock } from './helpers';
import { PAGE_GAP } from '../src/core/layout';

vi.mock('../src/core/excal', () => excalMock);

const { pageInView } = await import('../src/core/pages.js');

// Las páginas del banco del lienzo: 4:5 en fila, con el hueco de verdad.
const W = 1080;
const H = 1350;
const page = (i: number) => ({ id: `p${i + 1}`, type: 'frame', x: i * (W + PAGE_GAP), y: 0, width: W, height: H });

/**
 * Lo que deja a la vista `goToPage` (`scrollToContent` con `fitToViewport` al
 * 72 %) en un lienzo de `vw` × `vh` px: la página centrada y su alto al 72 %.
 */
function boundsAfterGoTo(p: { x: number; y: number; width: number; height: number }, vw: number, vh: number) {
  const zoom = Math.min((vw * 0.72) / p.width, (vh * 0.72) / p.height);
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  const w = vw / zoom;
  const h = vh / zoom;
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] as const;
}

describe('pageInView: la página que se mira tras mover el encuadre', () => {
  it('saltar a la página 2 en una ventana ancha la deja activa, aunque la 1 también se vea entera', () => {
    // Banco de la nightly del 25/10: «borrar la página 2: no salió «¿Eliminar?»».
    // Con 1860 × 850 las dos páginas caben enteras; antes ganaba la primera de la
    // escena y la activa volvía a la 1 150 ms después del salto.
    const pages = [page(0), page(1)];
    const bounds = boundsAfterGoTo(pages[1], 1860, 850);
    expect(pageInView(pages, bounds, 'p2')).toBe('p2');
  });

  it('con tres páginas a la vista, la del centro y la última siguen activas', () => {
    const pages = [page(0), page(1), page(2)];
    expect(pageInView(pages, boundsAfterGoTo(pages[2], 1860, 850), 'p3')).toBe('p3');
    expect(pageInView(pages, boundsAfterGoTo(pages[1], 1860, 850), 'p2')).toBe('p2');
  });

  it('desplazarse hasta otra página la activa', () => {
    const pages = [page(0), page(1)];
    // Encuadre centrado en la 2 y la activa aún es la 1, que se ve a medias.
    const bounds = boundsAfterGoTo(pages[1], 1200, 850);
    expect(pageInView(pages, bounds, 'p1')).toBe('p2');
  });

  it('sin activa (o con una que no se ve) gana la que más se ve', () => {
    const pages = [page(0), page(1)];
    const bounds = boundsAfterGoTo(pages[1], 1200, 850);
    expect(pageInView(pages, bounds, null)).toBe('p2');
    expect(pageInView([...pages, page(5)], bounds, 'p6')).toBe('p2');
  });

  it('nada a la vista: null', () => {
    expect(pageInView([page(0)], [5000, 5000, 6000, 6000], 'p1')).toBeNull();
  });

  it('una página borrada no cuenta', () => {
    const pages = [{ ...page(0), isDeleted: true }, page(1)];
    expect(pageInView(pages, boundsAfterGoTo(page(0), 1860, 850), null)).toBe('p2');
  });
});
