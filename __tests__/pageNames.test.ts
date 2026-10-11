import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAGE_NAMES,
  isDefaultPageName,
  renumberedPageName,
  resolvePageNames,
} from '../src/core/pageNames';

describe('nombres de serie de las páginas', () => {
  it('reconoce los que ya hay guardados, en español y en inglés', () => {
    expect(isDefaultPageName('Página 1')).toBe(true);
    expect(isDefaultPageName('Página 12')).toBe(true);
    expect(isDefaultPageName('Page 1')).toBe(true);
    expect(isDefaultPageName('Page 12')).toBe(true);
  });

  it('no confunde con uno de serie un nombre puesto a mano', () => {
    for (const nombre of [
      'Portada',
      'Página',
      'Página 1 (copia)',
      'Page 1 (copy)',
      'Página uno',
      'página 1',
      'Pagina 1',
      ' Página 1',
      'Página 1 ',
      'Página  1',
      'Pages 1',
      'Frame 1',
      '',
    ]) {
      expect(isDefaultPageName(nombre), nombre).toBe(false);
    }
    expect(isDefaultPageName(null)).toBe(false);
    expect(isDefaultPageName(undefined)).toBe(false);
  });

  it('renumerar cambia el número y deja la palabra que ya tenía', () => {
    expect(renumberedPageName('Página 3', 2)).toBe('Página 2');
    expect(renumberedPageName('Page 3', 2)).toBe('Page 2');
    expect(renumberedPageName('Página 2', 2)).toBe('Página 2');
  });

  it('renumerar no toca lo que no es de serie', () => {
    expect(renumberedPageName('Portada', 2)).toBeNull();
    expect(renumberedPageName('Página 3 (copia)', 2)).toBeNull();
    expect(renumberedPageName(null, 2)).toBeNull();
  });

  it('los nombres de quien llama pisan los de serie, y lo que falte cae al de serie', () => {
    expect(resolvePageNames()).toEqual(DEFAULT_PAGE_NAMES);
    expect(resolvePageNames(null)).toEqual(DEFAULT_PAGE_NAMES);

    const soloUno = resolvePageNames({ defaultName: (n) => `Page ${n}` });
    expect(soloUno.defaultName(4)).toBe('Page 4');
    expect(soloUno.untitled).toBe('Página');
    expect(soloUno.copyName('Portada')).toBe('Portada (copia)');

    // Una traducción vacía no deja una página sin nombre.
    expect(resolvePageNames({ untitled: '' }).untitled).toBe('Página');
  });

  it('los de serie son los de siempre', () => {
    expect(DEFAULT_PAGE_NAMES.defaultName(1)).toBe('Página 1');
    expect(DEFAULT_PAGE_NAMES.untitled).toBe('Página');
    expect(DEFAULT_PAGE_NAMES.copyName('Página 1')).toBe('Página 1 (copia)');
  });
});
