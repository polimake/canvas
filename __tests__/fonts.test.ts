import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  EXCALIDRAW_BUILTIN_FAMILIES,
  buildFontFaceCss,
  customFontFamilyId,
  dedupeFontFaces,
  fontFamilyAlias,
  normalizeFontName,
  normalizeFontSrc,
} from '../src/core/fonts';

describe('nombres de familia', () => {
  it('normaliza comillas y espacios', () => {
    expect(normalizeFontName("  'Instrument  Serif' ")).toBe('Instrument Serif');
    expect(normalizeFontName('"Inter"')).toBe('Inter');
  });

  it('deja intacto un nombre que no choca con Excalidraw', () => {
    expect(fontFamilyAlias('Montserrat')).toBe('Montserrat');
  });

  it('desambigua el que sí choca, sin importar mayúsculas', () => {
    expect(fontFamilyAlias('Nunito')).toBe('Nunito (marca)');
    expect(fontFamilyAlias('helvetica')).toBe('helvetica (marca)');
  });

  it('quita las cifras, que invalidarían el ctx.font del canvas', () => {
    // Sin esto, `${nombre}, Segoe UI Emoji` no es un atajo `font` válido, el
    // canvas cae a su 10px sans-serif y TODO el texto sale diminuto.
    expect(fontFamilyAlias('Source Sans 3')).toBe('Source Sans');
    expect(fontFamilyAlias('EB Garamond 400')).toBe('EB Garamond');
    expect(fontFamilyAlias('Archivo2Bold')).toBe('ArchivoBold');
    // El token vacío no deja un espacio doble detrás.
    expect(fontFamilyAlias('Jost 300 Light')).toBe('Jost Light');
  });

  it('el alias de choque se decide DESPUÉS de quitar las cifras', () => {
    expect(fontFamilyAlias('Nunito 700')).toBe('Nunito (marca)');
  });

  it('un nombre vacío no produce familia', () => {
    expect(fontFamilyAlias('   ')).toBe('');
    expect(fontFamilyAlias('400')).toBe('');
    expect(customFontFamilyId('')).toBe(0);
    expect(customFontFamilyId('400')).toBe(0);
  });
});

describe('id de familia', () => {
  it('es estable: el mismo nombre da siempre el mismo id', () => {
    // Es la propiedad que hace que un diseño migrado en node se abra bien en el
    // navegador dos años después. Si esto cambia, los diseños ya guardados se
    // abren con la tipografía de respaldo.
    expect(customFontFamilyId('Montserrat')).toBe(customFontFamilyId('Montserrat'));
    expect(customFontFamilyId('Montserrat')).toBe(customFontFamilyId("  'Montserrat'  "));
  });

  it('nombres distintos dan ids distintos', () => {
    const ids = ['Montserrat', 'Inter', 'DM Serif Display', 'Instrument Serif', 'Poppins'].map(
      customFontFamilyId,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cae siempre fuera del rango que usa Excalidraw', () => {
    // 1..9 propias, 100 Xiaolai, 1000 el emoji de Windows.
    for (const nombre of ['Montserrat', 'Inter', 'A', 'Zzz Wide Display']) {
      expect(customFontFamilyId(nombre)).toBeGreaterThanOrEqual(10_000);
    }
  });

  it('una fuente de marca homónima NO cae en el id de la de fábrica', () => {
    expect(customFontFamilyId('Nunito')).toBe(customFontFamilyId('Nunito (marca)'));
    expect(customFontFamilyId('Nunito')).toBeGreaterThanOrEqual(10_000);
  });
});

describe('CSS de @font-face', () => {
  it('emite el format() que toca y respeta peso y estilo', () => {
    const css = buildFontFaceCss([
      { family: 'Montserrat', src: 'https://x/m.woff2', weight: '700', style: 'italic' },
    ]);
    expect(css).toContain('font-family:"Montserrat"');
    expect(css).toContain('format("woff2")');
    expect(css).toContain('font-weight:700');
    expect(css).toContain('font-style:italic');
  });

  it('omite format() en un data URI, que ya lleva el tipo dentro', () => {
    const css = buildFontFaceCss([{ family: 'M', src: 'data:font/woff2;base64,AAA' }]);
    expect(css).not.toContain('format(');
  });

  it('añade font-display solo si se pide', () => {
    const faces = [{ family: 'M', src: 'https://x/m.woff2' }];
    expect(buildFontFaceCss(faces)).not.toContain('font-display');
    expect(buildFontFaceCss(faces, { display: 'swap' })).toContain('font-display:swap');
  });

  it('descarta las caras sin familia o sin fichero', () => {
    expect(buildFontFaceCss([{ family: '', src: 'https://x/m.woff2' }])).toBe('');
    expect(buildFontFaceCss([{ family: 'M', src: '' }])).toBe('');
  });

  it('dedupeFontFaces se queda con la última por familia/peso/estilo', () => {
    const out = dedupeFontFaces([
      { family: 'M', src: 'a.woff2' },
      { family: 'M', src: 'b.woff2' },
      { family: 'M', src: 'c.woff2', weight: '700' },
    ]);
    expect(out).toEqual([
      { family: 'M', src: 'b.woff2' },
      { family: 'M', src: 'c.woff2', weight: '700' },
    ]);
  });
});

describe('la lista de familias de fábrica sigue al día', () => {
  it('coincide con la que declara el Excalidraw instalado', () => {
    // `fonts.ts` es puro y no puede importar Excalidraw, así que duplica los
    // NOMBRES de sus familias para detectar colisiones. Este test es lo que
    // impide que la copia se quede vieja: se lee el `.d.ts` que se instala en
    // node_modules, no una lista escrita a mano en otro sitio.
    const require = createRequire(import.meta.url);
    // El paquete no publica `./package.json` en sus `exports`, así que se parte
    // del índice (que sí) y se sube hasta el árbol de tipos.
    const entrada = require.resolve('@excalidraw/excalidraw');
    const constantes = path.resolve(
      path.dirname(entrada),
      '../types/excalidraw/constants.d.ts',
    );
    const dts = fs.readFileSync(constantes, 'utf8');

    const bloque = (nombre: string) =>
      new RegExp(`declare const ${nombre}: \\{([^}]*)\\}`).exec(dts)?.[1] ?? '';
    const nombres = (cuerpo: string) =>
      [...cuerpo.matchAll(/^\s*"?([^":\n]+?)"?\s*:/gm)].map((m) => m[1]);

    const declaradas = [
      ...nombres(bloque('FONT_FAMILY')),
      ...nombres(bloque('FONT_FAMILY_FALLBACKS')),
    ];

    expect(declaradas.length).toBeGreaterThan(0);
    expect([...declaradas].sort()).toEqual([...EXCALIDRAW_BUILTIN_FAMILIES].sort());
  });
});

describe('registro contra FONT_FAMILY', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  /** Réplica del objeto real: mutable y sin congelar, que es de lo que depende todo. */
  const tablaFalsa = () => ({
    Virgil: 1,
    Helvetica: 2,
    Cascadia: 3,
    Excalifont: 5,
    Nunito: 6,
    'Lilita One': 7,
    'Comic Shanns': 8,
    'Liberation Sans': 9,
  });

  async function cargar(tabla: Record<string, number>) {
    vi.doMock('../src/core/excal', () => ({ FONT_FAMILY: tabla }));
    return import('../src/core/fontRegistry');
  }

  it('añade la familia a la tabla con su id derivado', async () => {
    const tabla = tablaFalsa();
    const { registerCustomFont } = await cargar(tabla);
    const reg = registerCustomFont('Montserrat');
    expect(reg).toEqual({ alias: 'Montserrat', id: customFontFamilyId('Montserrat') });
    expect(tabla.Montserrat).toBe(customFontFamilyId('Montserrat'));
  });

  it('no toca las familias de fábrica al registrar una homónima', async () => {
    const tabla = tablaFalsa();
    const { registerCustomFont } = await cargar(tabla);
    registerCustomFont('Nunito');
    expect(tabla.Nunito).toBe(6);
    expect(tabla['Nunito (marca)']).toBe(customFontFamilyId('Nunito'));
  });

  it('es idempotente', async () => {
    const tabla = tablaFalsa();
    const { registerCustomFont } = await cargar(tabla);
    const a = registerCustomFont('Inter');
    const b = registerCustomFont('Inter');
    expect(a).toEqual(b);
    expect(Object.keys(tabla).filter((k) => k === 'Inter')).toHaveLength(1);
  });

  it('rechaza una familia cuyo id ya ocupa otra, en vez de pintarla mal', async () => {
    const tabla = tablaFalsa();
    // Se ocupa el hueco de "Inter" con otro nombre para forzar la colisión.
    (tabla as Record<string, number>)['Otra Cosa'] = customFontFamilyId('Inter');
    const { registerCustomFont } = await cargar(tabla);
    const aviso = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(registerCustomFont('Inter')).toBeNull();
    expect(tabla).not.toHaveProperty('Inter');
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('registerCustomFonts devuelve las caras ya con su alias', async () => {
    const tabla = tablaFalsa();
    const { registerCustomFonts } = await cargar(tabla);
    const { faces, ids } = registerCustomFonts([
      { family: 'Montserrat', src: 'https://x/m.woff2' },
      { family: 'Nunito', src: 'https://x/n.woff2' },
    ]);
    expect(faces.map((f) => f.family)).toEqual(['Montserrat', 'Nunito (marca)']);
    expect(ids.get('Nunito (marca)')).toBe(customFontFamilyId('Nunito'));
  });

  it('fontFamilyId encuentra tanto las propias como las de fábrica', async () => {
    const tabla = tablaFalsa();
    const { registerCustomFont, fontFamilyId } = await cargar(tabla);
    registerCustomFont('Montserrat');
    expect(fontFamilyId('Montserrat')).toBe(customFontFamilyId('Montserrat'));
    expect(fontFamilyId('Helvetica')).toBe(2);
    expect(fontFamilyId('No Registrada')).toBeNull();
  });
});

describe('normalizeFontSrc', () => {
  it('sube a https una fuente servida en http', () => {
    // Un @font-face en http dentro de una página https es contenido mixto: el
    // navegador lo bloquea y el texto sale con la de respaldo. Salió en 12 de
    // los diseños reales del sandbox.
    expect(normalizeFontSrc('http://fonts.gstatic.com/s/x.woff2')).toBe(
      'https://fonts.gstatic.com/s/x.woff2',
    );
  });

  it('deja en paz lo que ya es https o un data URI', () => {
    expect(normalizeFontSrc('https://x/y.woff2')).toBe('https://x/y.woff2');
    expect(normalizeFontSrc('data:font/woff2;base64,AAA')).toBe('data:font/woff2;base64,AAA');
  });
});
