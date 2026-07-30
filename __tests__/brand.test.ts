import { describe, it, expect } from 'vitest';
import { resolveBrandKit, EMPTY_BRAND } from '../src/brand';

/**
 * Fixtures copiadas literalmente de `projects.brandKit` en producción. Las dos
 * formas conviven según la antigüedad del proyecto: fuente como cadena suelta
 * (Paella, Barbecho) y como objeto con `url` (Ciconea, Keriba) — y en TODOS los
 * proyectos reales ese `url` viene vacío.
 */
const PAELLA = {
  headingFont: 'DM Serif Display',
  bodyFont: 'Montserrat',
  mainColor: '#e6b019',
  colorPalette: ['#ca7507'],
  logoBlack: 'https://pub-81b995875065412182805d6e6616a339.r2.dev/projects/K7iL/logos/black.png',
  smallLogo: 'https://pub-81b995875065412182805d6e6616a339.r2.dev/projects/K7iL/logos/small.png',
};

const CICONEA = {
  mainColor: '#2a2d6f',
  colorPalette: ['#ffffff', '#b0e9e9', '#233b21', '#b47913'],
  headingFont: { name: 'Instrument Serif', family: 'Instrument Serif', style: 'regular', url: '' },
  bodyFont: { name: 'Helvetica', family: 'Helvetica', style: 'regular', url: '' },
};

describe('resolveBrandKit', () => {
  it('devuelve la marca vacía sin reventar cuando no hay brand kit', () => {
    expect(resolveBrandKit(null)).toBe(EMPTY_BRAND);
    expect(resolveBrandKit(undefined)).toBe(EMPTY_BRAND);
    expect(resolveBrandKit('{}')).toBe(EMPTY_BRAND);
  });

  it('pone el color principal al frente de la paleta y no lo duplica', () => {
    const b = resolveBrandKit({ mainColor: '#E6B019', colorPalette: ['#ca7507', '#e6b019'] });
    expect(b.palette).toEqual(['#e6b019', '#ca7507']);
  });

  it('descarta colores que no son hex y lo dice', () => {
    const b = resolveBrandKit({ mainColor: 'naranja', colorPalette: ['#ca7507', 'rgb(1,2,3)'] });
    expect(b.mainColor).toBeNull();
    expect(b.palette).toEqual(['#ca7507']);
    expect(b.notes.join(' ')).toContain('naranja');
    expect(b.notes.join(' ')).toContain('rgb(1,2,3)');
  });

  it('no inventa una fuente cuando el brand kit solo tiene el nombre', () => {
    // El caso mayoritario en producción: `url` vacío en los 9 proyectos con kit.
    const b = resolveBrandKit(PAELLA);
    expect(b.fontOverrides).toEqual([]);
    expect(b.headingFamily).toBeNull();
    expect(b.bodyFamily).toBeNull();
    expect(b.notes.some((n) => n.includes('DM Serif Display') && n.includes('titulares'))).toBe(true);
    expect(b.notes.some((n) => n.includes('Montserrat'))).toBe(true);
  });

  it('trata la forma objeto con url vacía igual que la cadena suelta', () => {
    const b = resolveBrandKit(CICONEA);
    expect(b.fontOverrides).toEqual([]);
    expect(b.notes.some((n) => n.includes('Instrument Serif'))).toBe(true);
    expect(b.palette).toEqual(['#2a2d6f', '#ffffff', '#b0e9e9', '#233b21', '#b47913']);
  });

  it('registra cada rol con el NOMBRE real de su tipografía', () => {
    const b = resolveBrandKit({
      headingFont: { name: 'Instrument Serif', url: 'https://fonts.example/serif.woff2', style: 'regular' },
      bodyFont: { name: 'Inter', url: 'https://fonts.example/inter.woff2', style: 'italic' },
    });
    expect(b.headingFamily).toBe('Instrument Serif');
    expect(b.bodyFamily).toBe('Inter');
    expect(b.fontOverrides).toEqual([
      { family: 'Instrument Serif', src: 'https://fonts.example/serif.woff2', style: undefined },
      { family: 'Inter', src: 'https://fonts.example/inter.woff2', style: 'italic' },
    ]);
    expect(b.notes).toEqual([]);
  });

  it('desambigua una fuente de marca que se llame como una de Excalidraw', () => {
    // Si se registrara como "Nunito" a secas, machacaría la entrada de fábrica
    // y cualquier diseño que usara la Nunito de Excalidraw dejaría de resolver.
    const b = resolveBrandKit({
      headingFont: { name: 'Nunito', url: 'https://fonts.example/nunito-cliente.woff2' },
    });
    expect(b.headingFamily).toBe('Nunito (marca)');
    expect(b.fontOverrides[0].family).toBe('Nunito (marca)');
  });

  it('rechaza urls de fuente que no sobreviven a una recarga', () => {
    const b = resolveBrandKit({
      headingFont: { name: 'X', url: 'blob:http://localhost/9f2c' },
      bodyFont: { name: 'Y', url: 'data:font/woff2;base64,AAA' },
    });
    expect(b.fontOverrides).toEqual([]);
    expect(b.notes).toHaveLength(2);
  });

  it('recoge solo los logos con url http', () => {
    const b = resolveBrandKit({ ...PAELLA, logoWhite: 'blob:algo' });
    expect(b.logos.black).toContain('/logos/black.png');
    expect(b.logos.small).toContain('/logos/small.png');
    expect(b.logos.white).toBeNull();
  });

  it('dos roles con la misma tipografía comparten familia sin duplicarla', () => {
    const b = resolveBrandKit({
      headingFont: { name: 'Inter', url: 'https://fonts.example/inter.woff2' },
      bodyFont: { name: 'Inter', url: 'https://fonts.example/inter.woff2' },
    });
    expect(b.headingFamily).toBe('Inter');
    expect(b.bodyFamily).toBe('Inter');
  });
});
