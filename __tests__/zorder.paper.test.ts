// El papel de la página es un MIEMBRO más del marco, aunque el panel de capas
// no lo liste (lo filtra `isPageBackground`). Esa asimetría es una trampa:
// `reorderMembersInArray` añade al final —o sea, ARRIBA— cualquier miembro que
// no venga en la lista, así que reordenar "solo las capas visibles" mandaba el
// papel al frente y dejaba la página en negro.
//
// Estas pruebas fijan las dos mitades del contrato: la del reordenador (omitir
// = subir al frente) y la de quien lo llama (nombrar el papel el primero).
import { describe, it, expect, vi } from 'vitest';
import { excalMock } from './helpers';

// El adaptador se dobla igual que en el resto de pruebas: el paquete real de
// Excalidraw toca `window` al importarse y no carga bajo node.
vi.mock('../src/excal', () => excalMock);

const { reorderMembersInArray } = await import('../src/zorder.js');
const { isPageBackground } = await import('../src/background.js');
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
    // El comportamiento documentado del reordenador. No es un fallo suyo: es
    // lo que hace peligroso llamarlo con una lista incompleta.
    const out = reorderMembersInArray(escena(), PAGINA, ['foto', 'texto']);
    expect(ids(out)).toEqual(['foto', 'texto', 'papel']);
    expect(isPageBackground(out[out.length - 1])).toBe(true);
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
