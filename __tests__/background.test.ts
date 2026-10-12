import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { setPageBackgroundColor, getPageBackground, ensurePagePapers, fitPagePapersInArray } =
  await import('../src/core/background.js');

const isBg = (e: any) => e.customData?.c2 === 'pageBackground';

/** El papel de una página, como lo guarda un diseño. */
function paper(
  id: string,
  frameId: string | null,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Record<string, unknown> = {},
) {
  return {
    ...member(id, frameId as string, x, y, width, height),
    locked: true,
    backgroundColor: '#ffffff',
    customData: { c2: 'pageBackground' },
    ...extra,
  };
}

const box = (e: any) => [e.x, e.y, e.width, e.height];

describe('page background', () => {
  it('creates a locked full-bleed rect at the back of the page', () => {
    const { api } = fakeApi([
      frame('p1', 100, 50, 500, 500),
      member('m1', 'p1', 120, 60, 40, 40),
    ]);
    const id = setPageBackgroundColor(api as any, 'p1', '#d0ebff');
    expect(id).toBeTruthy();
    const els = api.getSceneElements();
    const bg = els.find(isBg);
    expect(bg).toMatchObject({
      x: 100,
      y: 50,
      width: 500,
      height: 500,
      locked: true,
      backgroundColor: '#d0ebff',
      frameId: 'p1',
    });
    // Back of the page = first among the page's members in array order.
    const members = els.filter((e: any) => e.frameId === 'p1');
    expect(members[0].id).toBe(bg.id);
    expect(getPageBackground(api as any, 'p1')).toBe('#d0ebff');
  });

  it('re-applying PATCHES the paper in place — same element id, bumped version', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 500, 500)]);
    const firstId = setPageBackgroundColor(api as any, 'p1', '#ffffff');
    const secondId = setPageBackgroundColor(api as any, 'p1', '#1e1e1e');
    expect(secondId).toBe(firstId);
    const bgs = api.getSceneElements().filter(isBg);
    expect(bgs).toHaveLength(1);
    expect(bgs[0].backgroundColor).toBe('#1e1e1e');
    expect(bgs[0].version).toBeGreaterThan(0);
  });

  it("same-color re-apply is a no-op; 'transient' capture maps to EVENTUALLY", () => {
    const { api, commits } = fakeApi([frame('p1', 0, 0, 500, 500)]);
    setPageBackgroundColor(api as any, 'p1', '#ffffff');
    const before = commits.length;
    setPageBackgroundColor(api as any, 'p1', '#ffffff');
    expect(commits.length).toBe(before); // no commit at all
    setPageBackgroundColor(api as any, 'p1', '#d0ebff', { capture: 'transient' });
    expect(commits[commits.length - 1].captureUpdate).toBe('EVENTUALLY');
  });

  it('null removes the background', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 500, 500)]);
    setPageBackgroundColor(api as any, 'p1', '#ffffff');
    setPageBackgroundColor(api as any, 'p1', null);
    expect(api.getSceneElements().filter(isBg)).toHaveLength(0);
    expect(getPageBackground(api as any, 'p1')).toBeNull();
  });

  it('ensurePagePapers migrates ALL paperless pages in ONE history-invisible commit', () => {
    const { api, commits } = fakeApi([
      frame('p1', 0, 0, 500, 500),
      frame('p2', 500, 0, 500, 500),
    ]);
    setPageBackgroundColor(api as any, 'p1', '#d0ebff');
    const before = commits.length;
    ensurePagePapers(api as any);
    // One batched commit, invisible to undo (first Ctrl+Z after opening a
    // legacy scene must not delete a page's paper).
    expect(commits.length).toBe(before + 1);
    expect(commits[commits.length - 1].captureUpdate).toBe('NEVER');
    const bgs = api.getSceneElements().filter(isBg);
    expect(bgs).toHaveLength(2);
    // The page that already had a background keeps its color.
    expect(getPageBackground(api as any, 'p1')).toBe('#d0ebff');
    expect(getPageBackground(api as any, 'p2')).toBe('#ffffff');
    // Idempotent.
    ensurePagePapers(api as any);
    expect(api.getSceneElements().filter(isBg)).toHaveLength(2);
  });

  it('vuelve a hundir un papel que se ha levantado', () => {
    // El fallo que dejaba una página tapada por su propio fondo PARA SIEMPRE:
    // la función solo miraba si el papel EXISTÍA, así que bastaba con que algo
    // lo subiera una vez (un deshacer, un reordenado con la lista incompleta)
    // para que nadie volviera a bajarlo nunca.
    const { api, get, commits } = fakeApi([
      frame('p1', 0, 0, 500, 500),
      member('texto', 'p1', 10, 10, 100, 20, { type: 'text' }),
    ]);
    setPageBackgroundColor(api as any, 'p1', '#ffffff');
    // Se levanta el papel a mano, simulando el reordenado defectuoso.
    const els = get();
    const papel = els.find(isBg);
    (api as any).updateScene({
      elements: [...els.filter((e: any) => e !== papel), papel],
    });
    expect(isBg(get().filter((e: any) => e.frameId === 'p1')[0])).toBe(false);

    const before = commits.length;
    ensurePagePapers(api as any);
    expect(commits.length).toBe(before + 1);
    expect(isBg(get().filter((e: any) => e.frameId === 'p1')[0])).toBe(true);
    // Y una vez hundido, no vuelve a commitear: apto para un onChange.
    const settled = commits.length;
    ensurePagePapers(api as any);
    expect(commits.length).toBe(settled);
  });

  it('does nothing for an unknown page', () => {
    const { api, get } = fakeApi([frame('p1', 0, 0, 500, 500)]);
    const before = get();
    expect(setPageBackgroundColor(api as any, 'ghost', '#fff')).toBeNull();
    expect(get()).toBe(before);
  });
});

/**
 * El papel ocupa exactamente los límites de su marco. Hasta el 11/10 una página
 * añadida se guardaba con el papel 10 px por debajo (el margen que Excalidraw
 * pone a un marco sin hijos), y esos diseños siguen guardados así.
 */
describe('el papel, en su marco', () => {
  it('devuelve a su marco el papel guardado 10 px por debajo', () => {
    // Tal cual sale de un `.excalidraw` guardado: marco en (1128, 0), su papel
    // en (1128, 10).
    const escena = [
      frame('p1', 0, 0, 1080, 1080),
      paper('papel1', 'p1', 0, 0, 1080, 1080),
      frame('p2', 1128, 0, 1080, 1080),
      paper('papel2', 'p2', 1128, 10, 1080, 1080),
    ];
    const next = fitPagePapersInArray(escena as any);
    expect(next).not.toBe(escena);
    expect(box(next.find((e: any) => e.id === 'papel2'))).toEqual([1128, 0, 1080, 1080]);
    // La entrada no se toca: es una función pura.
    expect(box(escena[3])).toEqual([1128, 10, 1080, 1080]);
  });

  it('con todo en su sitio devuelve la MISMA referencia', () => {
    const escena = [
      frame('p1', 0, 0, 1080, 1080),
      paper('papel1', 'p1', 0, 0, 1080, 1080),
      member('m1', 'p1', 40, 40, 100, 100),
      frame('p2', 1128, 0, 1080, 1350),
      paper('papel2', 'p2', 1128, 0, 1080, 1350),
    ];
    expect(fitPagePapersInArray(escena as any)).toBe(escena);
  });

  it('es idempotente: la segunda pasada ya no encuentra nada', () => {
    const escena = [
      frame('p1', 0, 0, 1080, 1080),
      paper('papel1', 'p1', 0, 10, 1080, 1080),
    ];
    const una = fitPagePapersInArray(escena as any);
    expect(fitPagePapersInArray(una)).toBe(una);
  });

  it('una página sin papel se queda como está: aquí no se inventa ninguno', () => {
    const escena = [
      frame('p1', 0, 0, 1080, 1080),
      member('m1', 'p1', 40, 40, 100, 100),
      frame('p2', 1128, 0, 1080, 1080),
      paper('papel2', 'p2', 1128, 10, 1080, 1080),
    ];
    const next = fitPagePapersInArray(escena as any);
    expect(next).toHaveLength(escena.length);
    expect(next.filter(isBg).map((e: any) => e.id)).toEqual(['papel2']);
    // Y sin ningún papel en toda la escena, ni un elemento nuevo ni un cambio.
    const sinPapel = [frame('p1', 0, 0, 1080, 1080), member('m1', 'p1', 40, 40, 100, 100)];
    expect(fitPagePapersInArray(sinPapel as any)).toBe(sinPapel);
  });

  it('arregla varios papeles en varias páginas, cada uno contra SU marco', () => {
    const escena = [
      frame('p1', 0, 0, 1080, 1080),
      paper('papel1', 'p1', 0, 10, 1080, 1080),
      frame('p2', 1128, 0, 1080, 1350),
      paper('papel2', 'p2', 1128, 0, 1080, 1350),
      // Tamaño viejo: el marco se estiró a mano y el papel no le siguió.
      frame('p3', 2256, 0, 1920, 1080),
      paper('papel3', 'p3', 2256, 10, 1080, 1080),
      // Dos papeles en la misma página: los dos vuelven, no se borra ninguno.
      frame('p4', 4224, 300, 500, 500),
      paper('papel4a', 'p4', 4224, 310, 500, 500),
      paper('papel4b', 'p4', 4214, 290, 520, 520),
    ];
    const next = fitPagePapersInArray(escena as any);
    const por = (id: string) => next.find((e: any) => e.id === id);
    expect(box(por('papel1'))).toEqual([0, 0, 1080, 1080]);
    expect(box(por('papel3'))).toEqual([2256, 0, 1920, 1080]);
    expect(box(por('papel4a'))).toEqual([4224, 300, 500, 500]);
    expect(box(por('papel4b'))).toEqual([4224, 300, 500, 500]);
    // El que ya estaba bien es el mismo objeto de antes.
    expect(por('papel2')).toBe(escena[3]);
    expect(next.map((e: any) => e.id)).toEqual(escena.map((e) => e.id));
  });

  it('no mueve nada que no sea el papel, ni cambia de él otra cosa que su caja', () => {
    const escena = [
      frame('p1', 0, 0, 1080, 1080, { customData: { c2page: { index: 0 } } }),
      paper('papel1', 'p1', 0, 10, 1080, 1080, { backgroundColor: '#d0ebff' }),
      member('m1', 'p1', 40, 50, 100, 100),
      member('texto', 'p1', 200, 210, 300, 40, { type: 'text', fontSize: 32 }),
      // Suelto y justo encima del papel: no es de la página y no se toca.
      member('suelto', null as any, 0, 10, 1080, 1080),
    ];
    const next = fitPagePapersInArray(escena as any);
    next.forEach((e: any, i: number) => {
      if (e.id !== 'papel1') expect(e).toBe(escena[i]);
    });
    const papel = next[1] as any;
    expect(papel).toMatchObject({
      id: 'papel1',
      frameId: 'p1',
      locked: true,
      backgroundColor: '#d0ebff',
      customData: { c2: 'pageBackground' },
    });
    // Pasa por `patchElement`: la versión sube, que es lo que ve el historial.
    expect(papel.version).toBe(1);
  });

  it('deja en paz el papel sin marco: suelto, de un marco que ya no existe o de uno roto', () => {
    const escena = [
      frame('p1', 0, 0, 1080, 1080),
      paper('papel1', 'p1', 0, 0, 1080, 1080),
      paper('suelto', null, 300, 310, 1080, 1080),
      paper('huerfano', 'ya-no-existe', 300, 310, 1080, 1080),
      frame('roto', Number.NaN, 0, 1080, 1080),
      paper('papel-roto', 'roto', 2256, 10, 1080, 1080),
    ];
    expect(fitPagePapersInArray(escena as any)).toBe(escena);
  });

  it('no se pelea por ruido de coma flotante', () => {
    const escena = [
      frame('p1', 1128.0000001, 0, 1080, 1080),
      paper('papel1', 'p1', 1128, 0, 1080, 1080),
    ];
    expect(fitPagePapersInArray(escena as any)).toBe(escena);
  });

  it('ensurePagePapers lo aplica en UN commit invisible al historial, y luego se calla', () => {
    const { api, get, commits } = fakeApi([
      frame('p1', 0, 0, 1080, 1080),
      paper('papel1', 'p1', 0, 0, 1080, 1080),
      member('m1', 'p1', 40, 40, 100, 100),
      frame('p2', 1128, 0, 1080, 1080),
      paper('papel2', 'p2', 1128, 10, 1080, 1080),
      member('m2', 'p2', 1168, 40, 100, 100),
    ]);
    const antes = get();
    ensurePagePapers(api as any);
    expect(commits).toHaveLength(1);
    expect(commits[0].captureUpdate).toBe('NEVER');
    expect(box(get().find((e: any) => e.id === 'papel2'))).toEqual([1128, 0, 1080, 1080]);
    // Todo lo demás, los mismos objetos y en el mismo orden.
    get().forEach((e: any, i: number) => {
      if (e.id !== 'papel2') expect(e).toBe(antes[i]);
    });
    // Apto para un `onChange`: con la escena ya en su sitio no vuelve a escribir.
    ensurePagePapers(api as any);
    expect(commits).toHaveLength(1);
  });

  it('ensurePagePapers no escribe nada cuando cada papel ya ocupa su marco', () => {
    const { api, get, commits } = fakeApi([
      frame('p1', 0, 0, 1080, 1080),
      paper('papel1', 'p1', 0, 0, 1080, 1080),
      member('m1', 'p1', 40, 40, 100, 100),
    ]);
    const antes = get();
    ensurePagePapers(api as any);
    expect(commits).toHaveLength(0);
    expect(get()).toBe(antes);
  });

  it('ensurePagePapers coloca, hunde y crea en el mismo commit', () => {
    // Las tres mitades a la vez: p1 con el papel descolocado Y levantado, p2
    // sin papel.
    const { api, get, commits } = fakeApi([
      frame('p1', 0, 0, 1080, 1080),
      member('m1', 'p1', 40, 40, 100, 100),
      paper('papel1', 'p1', 0, 10, 1080, 1080),
      frame('p2', 1128, 0, 1080, 1080),
    ]);
    ensurePagePapers(api as any);
    expect(commits).toHaveLength(1);
    const p1 = get().filter((e: any) => e.frameId === 'p1');
    expect(p1.map((e: any) => e.id)).toEqual(['papel1', 'm1']);
    expect(box(p1[0])).toEqual([0, 0, 1080, 1080]);
    const nuevo = get().find((e: any) => e.frameId === 'p2' && isBg(e));
    expect(box(nuevo)).toEqual([1128, 0, 1080, 1080]);
  });
});
