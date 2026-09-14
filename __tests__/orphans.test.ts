import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { adoptLooseIntoPage, looseElements } = await import('../src/core/paginate.js');
const { deletePage, fitAllPages } = await import('../src/core/pages.js');

/**
 * Elementos fuera de toda página: el fallo silencioso de canvas2.
 *
 * El editor legacy no podía tenerlos — su modelo era un árbol y toda capa
 * colgaba de una página. Aquí un elemento sin `frameId` se ve en el lienzo pero
 * no sale en el panel de capas, ni en ningún export, ni en la miniatura.
 */
describe('adoptLooseIntoPage', () => {
  const suelto = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    type: 'rectangle',
    x: 500,
    y: 0,
    width: 20,
    height: 20,
    frameId: null,
    locked: false,
    version: 0,
    ...extra,
  });

  it('mete los sueltos en la página y no reescribe los que ya tenían una', () => {
    const { api, get } = fakeApi([
      frame('p1', 0, 0, 100, 100),
      suelto('fuera'),
      member('dentro', 'p1', 10, 10, 20, 20, { version: 7 }),
    ]);

    expect(adoptLooseIntoPage(api, 'p1')).toBe(1);

    const porId = Object.fromEntries(get().map((e) => [e.id, e]));
    expect(porId.fuera.frameId).toBe('p1');
    // Reescribir el que ya pertenecía subiría su versión y ensuciaría el
    // diseño sin motivo — y con ello dispararía un autoguardado fantasma.
    expect(porId.dentro.version).toBe(7);
  });

  it('deja los elementos donde están: adopta, no recoloca', () => {
    // Moverlos de golpe desconcierta más que el problema. Pertenecer basta para
    // que dejen de ser invisibles.
    const { api, get } = fakeApi([frame('p1', 0, 0, 100, 100), suelto('fuera')]);
    adoptLooseIntoPage(api, 'p1');
    const movido = get().find((e) => e.id === 'fuera');
    expect(movido.x).toBe(500);
    expect(movido.y).toBe(0);
  });

  it('arrastra el texto ligado junto a su contenedor', () => {
    // Mover la forma sin su texto dejaría al texto suelto: el mismo fallo que
    // esto viene a arreglar, provocado por el propio arreglo.
    const { api, get } = fakeApi([
      frame('p1', 0, 0, 100, 100),
      suelto('forma'),
      suelto('rotulo', { type: 'text', containerId: 'forma' }),
    ]);

    expect(adoptLooseIntoPage(api, 'p1')).toBe(2);
    for (const e of get()) {
      if (e.type !== 'frame') expect(e.frameId).toBe('p1');
    }
  });

  it('commitea UNA sola vez (una entrada de deshacer)', () => {
    const { api, commits } = fakeApi([
      frame('p1', 0, 0, 100, 100),
      suelto('a'),
      suelto('b'),
      suelto('c'),
    ]);
    expect(adoptLooseIntoPage(api, 'p1')).toBe(3);
    expect(commits).toHaveLength(1);
  });

  it('con `only` mueve solo los pedidos', () => {
    const { api, get } = fakeApi([frame('p1', 0, 0, 100, 100), suelto('a'), suelto('b')]);
    expect(adoptLooseIntoPage(api, 'p1', { only: ['a'] })).toBe(1);
    const porId = Object.fromEntries(get().map((e) => [e.id, e]));
    expect(porId.a.frameId).toBe('p1');
    expect(porId.b.frameId).toBe(null);
  });

  it('no toca nada si la página no existe', () => {
    const { api, commits } = fakeApi([frame('p1', 0, 0, 100, 100), suelto('a')]);
    expect(adoptLooseIntoPage(api, 'no-existe')).toBe(0);
    expect(commits).toHaveLength(0);
  });

  it('no commitea cuando no hay nada suelto', () => {
    const { api, commits } = fakeApi([
      frame('p1', 0, 0, 100, 100),
      member('dentro', 'p1', 0, 0, 10, 10),
    ]);
    expect(adoptLooseIntoPage(api, 'p1')).toBe(0);
    expect(commits).toHaveLength(0);
  });

  it('un marco nunca cuenta como suelto', () => {
    expect(looseElements([frame('p1', 0, 0, 10, 10) as never])).toHaveLength(0);
  });
});

describe('deletePage', () => {
  it('devuelve false y no toca la escena cuando es la única página', () => {
    // Un diseño sin ninguna página no es representable: no se exporta, no tiene
    // miniatura y no sabe a qué tamaño volver. Quien llama debe poder DECIRLO,
    // que era justo lo que faltaba: el botón se limitaba a desaparecer.
    const { api, commits } = fakeApi([frame('p1', 0, 0, 10, 10)]);
    expect(deletePage(api, 'p1')).toBe(false);
    expect(commits).toHaveLength(0);
  });

  it('devuelve true cuando sí borra', () => {
    const { api, commits } = fakeApi([frame('p1', 0, 0, 10, 10), frame('p2', 20, 0, 10, 10)]);
    expect(deletePage(api, 'p2')).toBe(true);
    expect(commits).toHaveLength(1);
  });
});

describe('fitAllPages', () => {
  it('encuadra TODOS los marcos, no solo el activo', () => {
    const { api } = fakeApi([
      frame('p1', 0, 0, 10, 10),
      frame('p2', 20, 0, 10, 10),
      member('x', 'p1', 0, 0, 5, 5),
    ]);
    api.scrollToContent = vi.fn();
    fitAllPages(api);
    const [target, opts] = api.scrollToContent.mock.calls[0];
    expect(target.map((f: { id: string }) => f.id)).toEqual(['p1', 'p2']);
    expect(opts.fitToViewport).toBe(true);
  });

  it('sin páginas no hace nada', () => {
    const { api } = fakeApi([]);
    api.scrollToContent = vi.fn();
    fitAllPages(api);
    expect(api.scrollToContent).not.toHaveBeenCalled();
  });
});
