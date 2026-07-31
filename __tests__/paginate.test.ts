import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';
import { PAGE_GAP } from '../src/layout';

vi.mock('../src/excal', () => excalMock);

const { convertToPages, clusterLooseElements, looseElements, paginateSceneInArray } =
  await import('../src/paginate.js');

/** Elemento suelto: sin `frameId`, o sea fuera de toda página. */
function loose(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    type: 'image',
    x,
    y,
    width,
    height,
    frameId: null,
    locked: false,
    opacity: 100,
    version: 0,
    ...extra,
  };
}

const isPaper = (e: any) => e.customData?.c2 === 'pageBackground';

describe('clusterLooseElements', () => {
  it('un carrusel en fila da un grupo por slide, de izquierda a derecha', () => {
    const slides = [
      loose('c', 2400, 0, 1080, 1350),
      loose('a', 0, 0, 1080, 1350),
      loose('b', 1200, 0, 1080, 1350),
    ];
    expect(clusterLooseElements(slides as any).map((g) => g.map((e) => e.id))).toEqual([
      ['a'],
      ['b'],
      ['c'],
    ]);
  });

  it('el texto encima de una imagen viaja con ella', () => {
    const els = [
      loose('img', 0, 0, 1080, 1350),
      loose('titulo', 80, 100, 900, 200, { type: 'text', fontSize: 96 }),
      loose('otro-slide', 1200, 0, 1080, 1350),
    ];
    const groups = clusterLooseElements(els as any).map((g) => g.map((e) => e.id).sort());
    expect(groups).toEqual([['img', 'titulo'], ['otro-slide']]);
  });

  it('un grupo de Excalidraw no se parte aunque sus piezas no se toquen', () => {
    const els = [
      loose('pie', 0, 1200, 300, 60, { groupIds: ['g1'] }),
      loose('logo', 700, 40, 120, 60, { groupIds: ['g1'] }),
    ];
    expect(clusterLooseElements(els as any)).toHaveLength(1);
  });

  it('un texto anclado sigue a su contenedor aunque se salga de la caja', () => {
    const els = [
      loose('caja', 0, 0, 200, 40, { type: 'rectangle' }),
      loose('etiqueta', 500, 500, 100, 20, { type: 'text', containerId: 'caja' }),
    ];
    expect(clusterLooseElements(els as any)).toHaveLength(1);
  });

  it('una rejilla se lee por filas y, dentro de cada fila, de izquierda a derecha', () => {
    const els = [
      loose('abajo-dcha', 1200, 1500, 1080, 1350),
      loose('arriba-dcha', 1200, 0, 1080, 1350),
      loose('abajo-izq', 0, 1500, 1080, 1350),
      loose('arriba-izq', 0, 0, 1080, 1350),
    ];
    expect(clusterLooseElements(els as any).map((g) => g[0].id)).toEqual([
      'arriba-izq',
      'arriba-dcha',
      'abajo-izq',
      'abajo-dcha',
    ]);
  });
});

describe('convertToPages', () => {
  it('convierte un carrusel suelto en páginas alineadas, con papel y numeradas', () => {
    const { api, get, commits } = fakeApi([
      loose('s1', 0, 0, 1080, 1350),
      loose('s2', 1200, 0, 1080, 1350),
      loose('s3', 2400, 0, 1080, 1350),
    ]);

    const { created, total } = convertToPages(api as any);
    expect({ created, total }).toEqual({ created: 3, total: 3 });
    // Una sola entrada de deshacer para toda la operación.
    expect(commits).toHaveLength(1);

    const frames = get()
      .filter((e) => e.type === 'frame')
      .sort((a, b) => a.x - b.x);
    expect(frames.map((f) => f.name)).toEqual(['Página 1', 'Página 2', 'Página 3']);
    // Tamaño heredado del slide y empaquetado a hueso desde x = 0.
    expect(frames.map((f) => [f.x, f.width, f.height])).toEqual([
      [0, 1080, 1350],
      [1080 + PAGE_GAP, 1080, 1350],
      [(1080 + PAGE_GAP) * 2, 1080, 1350],
    ]);

    // Cada slide queda DENTRO de su página, centrado, y con su papel detrás.
    for (const f of frames) {
      const miembros = get().filter((e) => e.frameId === f.id);
      expect(miembros.filter(isPaper)).toHaveLength(1);
      const contenido = miembros.filter((e) => !isPaper(e));
      expect(contenido).toHaveLength(1);
      expect(contenido[0]).toMatchObject({ x: f.x, y: f.y });
      // El papel va por DEBAJO del contenido (antes en el array).
      const idx = (id: string) => get().findIndex((e) => e.id === id);
      expect(idx(miembros.filter(isPaper)[0].id)).toBeLessThan(idx(contenido[0].id));
    }

    // Ya no queda nada suelto: la acción desaparece del menú.
    expect(looseElements(get() as any)).toHaveLength(0);
  });

  it('respeta las páginas que ya existen y añade las nuevas a continuación', () => {
    const { api, get } = fakeApi([
      frame('p1', 0, 0, 1080, 1350, { name: 'Portada' }),
      member('m1', 'p1', 10, 10, 100, 100),
      loose('suelto', 5000, 0, 1080, 1350),
    ]);

    const { created, total } = convertToPages(api as any);
    expect({ created, total }).toEqual({ created: 1, total: 2 });

    const frames = get()
      .filter((e) => e.type === 'frame')
      .sort((a, b) => a.x - b.x);
    expect(frames.map((f) => f.name)).toEqual(['Portada', 'Página 2']);
    expect(frames[1].x).toBe(1080 + PAGE_GAP);
    // El miembro de la página existente viaja con su marco, no se queda atrás.
    expect(get().find((e) => e.id === 'm1')).toMatchObject({ x: 10, frameId: 'p1' });
  });

  it('reduce (nunca amplía) el grupo que no cabe, sin recortarlo', () => {
    const { api, get } = fakeApi([
      frame('p1', 0, 0, 1000, 1000),
      loose('grande', 5000, 0, 2000, 1000),
    ]);

    convertToPages(api as any, { pageSize: { width: 1000, height: 1000 } });
    const nuevo = get()
      .filter((e) => e.type === 'frame')
      .find((f) => f.id !== 'p1')!;
    const escalado = get().find((e) => e.id === 'grande')!;
    // k = min(1, 1000/2000, 1000/1000) = 0,5 → cabe entero y queda centrado.
    expect(escalado.width).toBe(1000);
    expect(escalado.height).toBe(500);
    expect(escalado.x).toBe(nuevo.x);
    expect(escalado.y).toBe(nuevo.y + 250);
  });

  it('no amplía un grupo más pequeño que la página', () => {
    const { api, get } = fakeApi([loose('pequeño', 0, 0, 200, 200)]);
    convertToPages(api as any, { pageSize: { width: 1080, height: 1080 } });
    expect(get().find((e) => e.id === 'pequeño')).toMatchObject({ width: 200, height: 200 });
  });

  it('escala el cuerpo de un texto junto con su caja', () => {
    const { api, get } = fakeApi([
      loose('t', 0, 0, 2000, 1000, { type: 'text', fontSize: 100 }),
    ]);
    convertToPages(api as any, { pageSize: { width: 1000, height: 1000 } });
    expect(get().find((e) => e.id === 't')).toMatchObject({ fontSize: 50 });
  });

  it('sin nada suelto solo alinea y renumera los marcos hechos a mano', () => {
    const { api, get } = fakeApi([
      frame('a', 0, 0, 1000, 1000, { name: 'Página 1' }),
      frame('b', 4000, 0, 1000, 1000, { name: 'Página 2' }),
    ]);
    const { created, total } = convertToPages(api as any);
    expect({ created, total }).toEqual({ created: 0, total: 2 });
    expect(get().find((e) => e.id === 'b')).toMatchObject({ x: 1000 + PAGE_GAP });
  });

  it('sobre un documento ya paginado y alineado no escribe nada', () => {
    const { api, commits } = fakeApi([
      frame('a', 0, 0, 1000, 1000, { name: 'Página 1' }),
      frame('b', 1000 + PAGE_GAP, 0, 1000, 1000, { name: 'Página 2' }),
    ]);
    convertToPages(api as any);
    expect(commits).toHaveLength(0);
  });

  it('la función pura no muta el array de entrada', () => {
    const entrada = [loose('s1', 0, 0, 100, 100), loose('s2', 500, 0, 100, 100)];
    const copia = JSON.parse(JSON.stringify(entrada));
    paginateSceneInArray(entrada as any);
    expect(entrada).toEqual(copia);
  });
});
