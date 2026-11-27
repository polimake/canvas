import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const {
  SLIDE_NOTES_KEY,
  SLIDE_SKIP_KEY,
  SLIDE_TRANSITION_KEY,
  notesOf,
  getPageNotes,
  setPageNotes,
  isPageSkipped,
  setPageSkipped,
  getPageTransition,
  setPageTransition,
  setSlideMetaInArray,
} = await import('../src/core/slideMeta.js');

const p = (fx: { get: () => any[] }, id: string) => fx.get().find((e) => e.id === id);

describe('notas del orador', () => {
  it('una página sin notas devuelve texto vacío', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 1920, 1080)]);
    expect(getPageNotes(api, 'p1')).toBe('');
    expect(getPageNotes(api, 'no-existe')).toBe('');
  });

  it('guarda en el marco, conserva el resto de su customData y deja UNA entrada de deshacer', () => {
    const fx = fakeApi([
      frame('p1', 0, 0, 1920, 1080, { customData: { c2page: { index: 0 } } }),
      member('r1', 'p1', 10, 10, 100, 100),
    ]);
    expect(setPageNotes(fx.api, 'p1', 'Abrir con la pregunta')).toBe(true);
    expect(fx.commits).toHaveLength(1);
    expect(fx.commits[0].captureUpdate).toBe('IMMEDIATELY');
    expect(p(fx, 'p1').customData).toEqual({ c2page: { index: 0 }, [SLIDE_NOTES_KEY]: 'Abrir con la pregunta' });
    expect(p(fx, 'p1').version).toBe(1);
    expect(getPageNotes(fx.api, 'p1')).toBe('Abrir con la pregunta');
  });

  it('no escribe nada si el texto no cambia (los espacios del final no cuentan)', () => {
    const fx = fakeApi([frame('p1', 0, 0, 1920, 1080, { customData: { [SLIDE_NOTES_KEY]: 'Hola' } })]);
    expect(setPageNotes(fx.api, 'p1', 'Hola  \n')).toBe(false);
    expect(fx.commits).toHaveLength(0);
  });

  it('vaciar las notas borra la clave en vez de guardar una cadena vacía', () => {
    const fx = fakeApi([frame('p1', 0, 0, 1920, 1080, { customData: { c2page: { index: 0 }, [SLIDE_NOTES_KEY]: 'Hola' } })]);
    setPageNotes(fx.api, 'p1', '   ');
    expect(p(fx, 'p1').customData).toEqual({ c2page: { index: 0 } });
  });

  it('notesOf ignora valores que no son texto', () => {
    expect(notesOf({ customData: { [SLIDE_NOTES_KEY]: 42 } })).toBe('');
    expect(notesOf(null)).toBe('');
  });
});

describe('saltar al presentar', () => {
  it('marca y desmarca sin dejar la clave a false', () => {
    const fx = fakeApi([frame('p1', 0, 0, 1920, 1080)]);
    setPageSkipped(fx.api, 'p1', true);
    expect(isPageSkipped(fx.api, 'p1')).toBe(true);
    expect(p(fx, 'p1').customData[SLIDE_SKIP_KEY]).toBe(true);
    setPageSkipped(fx.api, 'p1', false);
    expect(isPageSkipped(fx.api, 'p1')).toBe(false);
    expect(SLIDE_SKIP_KEY in p(fx, 'p1').customData).toBe(false);
    expect(fx.commits).toHaveLength(2);
  });
});

describe('transiciones', () => {
  it('por defecto ninguna, y un valor desconocido también cuenta como ninguna', () => {
    const fx = fakeApi([frame('p1', 0, 0, 1, 1, { customData: { [SLIDE_TRANSITION_KEY]: 'girar' } })]);
    expect(getPageTransition(fx.api, 'p1')).toBe('none');
  });

  it('«aplicar a todas» cambia todas las páginas en UNA entrada de deshacer', () => {
    const fx = fakeApi([
      frame('p1', 0, 0, 1, 1),
      frame('p2', 100, 0, 1, 1),
      member('r1', 'p1', 0, 0, 1, 1),
    ]);
    expect(setPageTransition(fx.api, null, 'fade')).toBe(true);
    expect(fx.commits).toHaveLength(1);
    expect(getPageTransition(fx.api, 'p1')).toBe('fade');
    expect(getPageTransition(fx.api, 'p2')).toBe('fade');
    expect(p(fx, 'r1').customData).toBeUndefined();
  });

  it('volver a «ninguna» borra la clave', () => {
    const fx = fakeApi([frame('p1', 0, 0, 1, 1, { customData: { [SLIDE_TRANSITION_KEY]: 'fade' } })]);
    setPageTransition(fx.api, 'p1', 'none');
    expect(p(fx, 'p1').customData).toEqual({});
  });
});

describe('setSlideMetaInArray', () => {
  it('solo toca marcos: un elemento con ese id que no es página se ignora', () => {
    const els = [member('p1', 'x', 0, 0, 10, 10)] as never[];
    expect(setSlideMetaInArray(els, 'p1', SLIDE_NOTES_KEY, 'nota')).toBe(els);
  });
});
