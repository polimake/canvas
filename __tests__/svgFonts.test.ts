import { describe, it, expect, vi } from 'vitest';
import { buildFontFaceCss, inlineFontFaces } from '../src/svgFonts';

describe('buildFontFaceCss', () => {
  it('declara la familia con su fichero y el format correcto', () => {
    const css = buildFontFaceCss([
      { family: 'Lilita One', src: 'https://cdn/x/brand.woff2' },
    ]);
    expect(css).toContain('font-family:"Lilita One"');
    expect(css).toContain('url("https://cdn/x/brand.woff2")');
    expect(css).toContain('format("woff2")');
  });

  it('deduce el format de cada extensión', () => {
    const css = buildFontFaceCss([
      { family: 'A', src: 'https://c/a.ttf' },
      { family: 'B', src: 'https://c/b.otf' },
      { family: 'C', src: 'https://c/c.woff' },
    ]);
    expect(css).toContain('format("truetype")');
    expect(css).toContain('format("opentype")');
    expect(css).toContain('format("woff")');
  });

  it('no inventa un format cuando no puede saberlo', () => {
    // Un data URI ya lleva el tipo dentro; declarar un format equivocado hace
    // que algunos visores descarten la fuente entera.
    const css = buildFontFaceCss([{ family: 'A', src: 'data:font/woff2;base64,AAA' }]);
    expect(css).toContain('url("data:font/woff2;base64,AAA")');
    expect(css).not.toContain('format(');
  });

  it('ignora la query al deducir la extensión', () => {
    const css = buildFontFaceCss([{ family: 'A', src: 'https://c/a.woff2?v=3' }]);
    expect(css).toContain('format("woff2")');
  });

  it('descarta entradas sin familia o sin fichero', () => {
    expect(buildFontFaceCss([{ family: '', src: 'https://c/a.woff2' }])).toBe('');
    expect(buildFontFaceCss([{ family: 'A', src: '' }])).toBe('');
  });

  it('respeta peso y estilo, con normal por defecto', () => {
    const css = buildFontFaceCss([
      { family: 'A', src: 'https://c/a.woff2', weight: '700', style: 'italic' },
      { family: 'B', src: 'https://c/b.woff2' },
    ]);
    expect(css).toContain('font-weight:700');
    expect(css).toContain('font-style:italic');
    expect(css).toContain('font-weight:normal;font-style:normal');
  });
});

describe('inlineFontFaces', () => {
  const blob = (texto: string) => new Blob([texto], { type: 'font/woff2' });

  it('incrusta el fichero como data URI para que el SVG no dependa de la red', async () => {
    const fetcher = vi.fn().mockResolvedValue(blob('abc'));
    const { faces, failed } = await inlineFontFaces(
      [{ family: 'Lilita One', src: 'https://cdn/x.woff2' }],
      fetcher,
    );
    expect(failed).toEqual([]);
    expect(faces[0].src.startsWith('data:font/woff2;base64,')).toBe(true);
    expect(fetcher).toHaveBeenCalledWith('https://cdn/x.woff2');
  });

  it('no vuelve a descargar lo que ya es data URI', async () => {
    const fetcher = vi.fn();
    const { faces } = await inlineFontFaces(
      [{ family: 'A', src: 'data:font/woff2;base64,QQ==' }],
      fetcher,
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(faces[0].src).toBe('data:font/woff2;base64,QQ==');
  });

  it('una fuente que falla se queda con su URL y se reporta, sin tumbar el export', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('403'))
      .mockResolvedValueOnce(blob('ok'));
    const { faces, failed } = await inlineFontFaces(
      [
        { family: 'Rota', src: 'https://cdn/rota.woff2' },
        { family: 'Buena', src: 'https://cdn/buena.woff2' },
      ],
      fetcher,
    );
    expect(failed).toEqual(['Rota']);
    expect(faces[0].src).toBe('https://cdn/rota.woff2');
    expect(faces[1].src.startsWith('data:')).toBe(true);
  });
});
