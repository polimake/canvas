// Issue #103: «cuando pegas o editas textos, que vayan siempre en la capa de
// arriba».
//
// Excalidraw inserta un elemento con `frameId` en el ÍNDICE DEL PROPIO MARCO
// (`Scene.insertElement`: `getElementIndex(element.frameId)`). Ese cálculo da
// por hecho SU convención de array, donde los hijos van ANTES del marco
// —`[…hijo, hijo, marco]`—, así que caer en el hueco del marco significa
// «encima de todo lo suyo».
//
// canvas2 construía la página al revés —`[marco, papel, contenido…]`— así que
// el mismo cálculo dejaba el texto DELANTE del papel, es decir, DEBAJO de un
// rectángulo opaco: invisible, no sólo mal apilado.
//
// Estas pruebas fijan la convención nueva (miembros primero, marco al final)
// sobre el constructor real, que es lo que hace que la inserción de Excalidraw
// caiga donde debe. No doblan la inserción: comprueban la precondición de la
// que depende.
import { describe, it, expect, vi } from 'vitest';
import { excalMock } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { createBlankScene } = await import('../src/core/pages.js');
const { isPageBackground } = await import('../src/core/background.js');

type El = { id: string; type: string; frameId: string | null };

describe('convención del array de una página (issue #103)', () => {
  it('coloca el marco DESPUÉS de sus miembros', () => {
    const { elements } = createBlankScene({ width: 1080, height: 1350 });
    const els = elements as unknown as El[];

    const frameAt = els.findIndex((e) => e.type === 'frame');
    expect(frameAt).toBeGreaterThanOrEqual(0);

    const frameId = els[frameAt].id;
    const memberSlots = els
      .map((e, i) => (e.frameId === frameId ? i : -1))
      .filter((i) => i >= 0);

    expect(memberSlots.length).toBeGreaterThan(0);
    // Todo miembro va ANTES del marco: es lo que hace que insertar en el hueco
    // del marco signifique «encima de todo lo de esta página».
    for (const slot of memberSlots) {
      expect(slot).toBeLessThan(frameAt);
    }
  });

  it('deja el papel como suelo, y el hueco del marco por encima de él', () => {
    const { elements } = createBlankScene({ width: 1080, height: 1350 });
    const els = elements as unknown as El[];

    const frameAt = els.findIndex((e) => e.type === 'frame');
    const paperAt = els.findIndex((e) =>
      isPageBackground(e as unknown as Parameters<typeof isPageBackground>[0]),
    );

    expect(paperAt).toBeGreaterThanOrEqual(0);
    // El papel sigue siendo el primero de los suyos…
    expect(paperAt).toBeLessThan(frameAt);
    // …y un texto insertado en el hueco del marco cae POR ENCIMA del papel,
    // que es justo lo que no pasaba antes.
    const inserted = [...els.slice(0, frameAt), { id: 'texto', type: 'text', frameId: els[frameAt].id }, ...els.slice(frameAt)];
    expect(inserted.findIndex((e) => e.id === 'texto')).toBeGreaterThan(paperAt);
  });
});
