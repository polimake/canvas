// El papel de la página es un MIEMBRO más del marco, aunque el panel de capas
// no lo liste (lo filtra `isPageBackground`). Esa asimetría era una trampa:
// `reorderMembersInArray` añade al final —o sea, ARRIBA— cualquier miembro que
// no venga en la lista, así que reordenar "solo las capas visibles" mandaba el
// papel al frente y dejaba la página en blanco. La otra mitad del mismo fallo
// era nombrarlo en cualquier otro sitio: `fitToPage` mandaba la imagen "al
// fondo" POR DEBAJO del papel opaco, es decir, a la invisibilidad.
//
// Ahora la regla la aplica el propio reordenador (`floorFirst`), no sus
// llamantes: el papel es el suelo y no se puede subir por descuido. Estas
// pruebas fijan ese contrato por las dos vías — omitiéndolo y nombrándolo mal.
import { describe, it, expect, vi } from 'vitest';
import { excalMock } from './helpers';

// El adaptador se dobla igual que en el resto de pruebas: el paquete real de
// Excalidraw toca `window` al importarse y no carga bajo node.
vi.mock('../src/core/excal', () => excalMock);

const { reorderMembersInArray } = await import('../src/core/zorder.js');
const { isPageBackground } = await import('../src/core/background.js');
type SceneElement = { id: string; type: string; frameId: string | null };

const PAGINA = 'page1';

function elemento(id: string, extra: Partial<SceneElement> = {}): SceneElement {
  return { id, type: 'rectangle', frameId: PAGINA, ...extra } as unknown as SceneElement;
}

/** Escena mínima con el mismo orden que guarda canvas2: papel abajo del todo. */
function escena(): SceneElement[] {
  return [
    elemento('papel', { locked: true, customData: { c2: 'pageBackground' } }),
    elemento('foto', { type: 'image' } as Partial<SceneElement>),
    elemento('texto', { type: 'text' } as Partial<SceneElement>),
  ];
}

const ids = (els: readonly SceneElement[]) => els.map((e) => e.id);

describe('reorderMembersInArray', () => {
  it('sube al frente a los miembros que no se nombran', () => {
    // El comportamiento documentado del reordenador, que es lo que hace
    // peligroso llamarlo con una lista incompleta…
    const out = reorderMembersInArray(escena(), PAGINA, ['texto']);
    expect(ids(out)).toEqual(['papel', 'texto', 'foto']);
  });

  it('…salvo con el papel: omitirlo ya NO lo sube', () => {
    // Lo que hacía el panel de capas antes de acordarse de nombrarlo.
    const out = reorderMembersInArray(escena(), PAGINA, ['foto', 'texto']);
    expect(ids(out)).toEqual(['papel', 'foto', 'texto']);
    expect(isPageBackground(out[0])).toBe(true);
  });

  it('nombrar el papel ARRIBA tampoco lo sube: el suelo es el suelo', () => {
    // El fallo de `fitToPage`: mandar una imagen "al fondo" la metía DEBAJO
    // del papel opaco. Ahora el fondo del contenido es justo encima del papel.
    const out = reorderMembersInArray(escena(), PAGINA, ['foto', 'texto', 'papel']);
    expect(ids(out)).toEqual(['papel', 'foto', 'texto']);
    expect(isPageBackground(out[0])).toBe(true);
  });

  it('nombrando el papel el primero, la página conserva su fondo abajo', () => {
    // Lo que hace ahora el panel de capas al soltar una fila.
    const out = reorderMembersInArray(escena(), PAGINA, ['papel', 'texto', 'foto']);
    expect(ids(out)).toEqual(['papel', 'texto', 'foto']);
    expect(isPageBackground(out[0])).toBe(true);
  });

  it('no toca a los miembros de otras páginas', () => {
    const els = [...escena(), elemento('otra', { frameId: 'page2' })];
    const out = reorderMembersInArray(els, PAGINA, ['papel', 'foto', 'texto']);
    expect(out[out.length - 1].id).toBe('otra');
  });
});
