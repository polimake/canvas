import { describe, expect, it, vi } from 'vitest';
import { excalMock, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { pickOverPageEdge, pickOverSelection, pickVisible } = await import('../src/core/pick.js');

const papel = (id: string, frameId: string) => ({
  ...member(id, frameId, 0, 0, 1080, 1350),
  locked: true,
  customData: { c2: 'pageBackground' },
});

/** Como la secuencia del banco: un texto seleccionado y una foto encima de parte de él. */
const escena = () => [
  papel('papel', 'p'),
  member('texto', 'p', 120, 860, 580, 120, { type: 'text' }),
  member('foto', 'p', 120, 860, 480, 360, { type: 'image' }),
  frame('p', 0, 0, 1080, 1350),
] as any[];

describe('pulsar sobre lo que está encima', () => {
  it('con el texto seleccionado, pulsar en la foto que lo tapa coge la foto', () => {
    expect(pickOverSelection(escena(), { texto: true }, { x: 360, y: 920 }, 0.5)).toBe('foto');
  });

  it('si lo de encima es lo seleccionado, manda Excalidraw', () => {
    expect(pickOverSelection(escena(), { foto: true }, { x: 360, y: 920 }, 0.5)).toBeNull();
  });

  it('fuera de la caja de la selección, o sin selección, manda Excalidraw', () => {
    expect(pickOverSelection(escena(), { texto: true }, { x: 360, y: 1100 }, 0.5)).toBeNull();
    expect(pickOverSelection(escena(), {}, { x: 360, y: 920 }, 0.5)).toBeNull();
  });

  it('cerca de una esquina de la selección es su asa: escalar', () => {
    // Esquina de arriba a la izquierda del texto (120, 860): 16 px de pantalla a zoom 0,5 son 32 de escena.
    expect(pickOverSelection(escena(), { texto: true }, { x: 140, y: 880 }, 0.5)).toBeNull();
  });

  it('ni el papel ni lo bloqueado se cogen', () => {
    const els = escena().filter((e) => e.id !== 'foto');
    expect(pickOverSelection(els, { texto: true }, { x: 360, y: 920 }, 0.5)).toBeNull();
    const bloqueada = escena().map((e) => (e.id === 'foto' ? { ...e, locked: true } : e));
    expect(pickOverSelection(bloqueada, { texto: true }, { x: 360, y: 920 }, 0.5)).toBeNull();
  });

  it('una página seleccionada se arrastra entera', () => {
    expect(pickOverSelection(escena(), { p: true }, { x: 360, y: 920 }, 0.5)).toBeNull();
  });
});

/** Como el banco del 23/10: una elipse a caballo del borde derecho de la página 1. */
const aCaballo = () => [
  papel('papel-1', 'p1'),
  { ...papel('papel-2', 'p2'), x: 1128 },
  member('elipse', 'p1', 909, 80, 280, 280, { type: 'ellipse' }),
  frame('p1', 0, 0, 1080, 1350),
  frame('p2', 1128, 0, 1080, 1350),
] as any[];

describe('pulsar un elemento pegado al borde de una página', () => {
  it('coge el elemento y no la página', () => {
    // A 5 de escena del borde derecho (1080), dentro de la elipse: a zoom 0,5 es el borde de la página.
    expect(pickOverPageEdge(aCaballo(), {}, { x: 1075, y: 232 }, 0.5)).toBe('elipse');
  });

  it('lejos del borde, Excalidraw ya coge el elemento', () => {
    expect(pickOverPageEdge(aCaballo(), {}, { x: 1000, y: 220 }, 0.5)).toBeNull();
  });

  it('la parte que la página recorta no se coge', () => {
    // 1100 queda fuera de la página 1, entre las dos: ahí no se ve la elipse.
    expect(pickOverPageEdge(aCaballo(), {}, { x: 1100, y: 220 }, 0.5)).toBeNull();
  });

  it('en el borde sin nada encima, ni en la esquina vacía de la caja de una elipse, se deja a Excalidraw', () => {
    expect(pickOverPageEdge(aCaballo(), {}, { x: 1075, y: 900 }, 0.5)).toBeNull();
    expect(pickOverPageEdge(aCaballo(), {}, { x: 1076, y: 81 }, 0.5)).toBeNull();
  });

  it('si ya está seleccionado, Excalidraw ya lo arrastra', () => {
    expect(pickOverPageEdge(aCaballo(), { elipse: true }, { x: 1075, y: 232 }, 0.5)).toBeNull();
  });
});

/**
 * Como el banco: una forma A con otra B encima que la tapa en parte, y un clic
 * sobre A a 3,5 px de pantalla del borde de B (zoom 0,5: 7 de escena).
 * Excalidraw coge B por su margen (4 px entre dos que se tocan); en Canva se
 * coge A, que es lo que se ve.
 */
const roce = (extraB: Record<string, unknown> = {}, extraA: Record<string, unknown> = {}) => [
  papel('papel', 'p'),
  member('A', 'p', 100, 100, 400, 400, { backgroundColor: '#ffcc00', ...extraA }),
  member('B', 'p', 300, 300, 400, 300, { backgroundColor: '#0066ff', ...extraB }),
  frame('p', 0, 0, 1080, 1350),
] as any[];
const fuera = { x: 293, y: 400 }; // 7 de escena a la izquierda de B, dentro de A

describe('pulsar coge lo que se ve (Canva)', () => {
  it('a 3,5 px fuera de B pero dentro de A, se coge A', () => {
    expect(pickVisible(roce(), { selectedElementIds: {} }, fuera, 0.5)).toEqual({
      id: 'A',
      selectedElementIds: { A: true },
      selectedGroupIds: {},
    });
  });

  it('dentro de B, B; lejos de B, Excalidraw ya coge A', () => {
    expect(pickVisible(roce(), { selectedElementIds: {} }, { x: 310, y: 400 }, 0.5)).toBeNull();
    expect(pickVisible(roce(), { selectedElementIds: {} }, { x: 200, y: 200 }, 0.5)).toBeNull();
  });

  it('en el papel junto a B no hay nada que coger: lo decide Excalidraw (la página)', () => {
    expect(pickVisible(roce(), { selectedElementIds: {} }, { x: 600, y: 293 }, 0.5)).toBeNull();
  });

  it('con B seleccionada, su borde es su asa: escalar B', () => {
    expect(pickVisible(roce(), { selectedElementIds: { B: true } }, fuera, 0.5)).toBeNull();
    // La esquina de abajo a la derecha, a 7 px en diagonal.
    expect(pickVisible(roce(), { selectedElementIds: { B: true } }, { x: 714, y: 614 }, 0.5)).toBeNull();
  });

  it('con otra cosa seleccionada, también se coge A', () => {
    const els = [...roce(), member('C', 'p', 800, 900, 100, 100, { backgroundColor: '#000' })];
    expect(pickVisible(els, { selectedElementIds: { C: true } }, fuera, 0.5)?.selectedElementIds).toEqual({ A: true });
  });

  it('A ya seleccionada con más cosas: se queda la selección y se arrastra entera', () => {
    const els = [...roce(), member('C', 'p', 800, 900, 100, 100, { backgroundColor: '#000' })];
    expect(pickVisible(els, { selectedElementIds: { A: true, C: true } }, fuera, 0.5)?.selectedElementIds).toEqual({ A: true, C: true });
  });

  it('una B sin relleno solo se coge por su trazo: por dentro se coge A', () => {
    const hueca = roce({ backgroundColor: 'transparent', strokeWidth: 2 });
    expect(pickVisible(hueca, { selectedElementIds: {} }, { x: 400, y: 400 }, 0.5)?.id).toBe('A');
    // Sobre el trazo, B (Excalidraw ya la coge).
    expect(pickVisible(hueca, { selectedElementIds: {} }, { x: 301, y: 400 }, 0.5)).toBeNull();
  });

  it('A en un grupo: se coge el grupo entero', () => {
    const els = [...roce({}, { groupIds: ['g'] }), member('A2', 'p', 0, 1200, 50, 50, { groupIds: ['g'] })];
    expect(pickVisible(els, { selectedElementIds: {} }, fuera, 0.5)).toEqual({
      id: 'A',
      selectedElementIds: { A: true, A2: true },
      selectedGroupIds: { g: true },
    });
  });

  it('B del mismo grupo que A: Excalidraw coge el grupo igual', () => {
    expect(pickVisible(roce({ groupIds: ['g'] }, { groupIds: ['g'] }), { selectedElementIds: {} }, fuera, 0.5)).toBeNull();
  });

  it('una foto pulsada junto a su borde se deja a Excalidraw (ahí la escalaría)', () => {
    const foto = roce({}, { type: 'image' });
    expect(pickVisible(foto, { selectedElementIds: {} }, fuera, 0.5)?.id).toBe('A');
    expect(pickVisible(foto, { selectedElementIds: {} }, { x: 293, y: 495 }, 0.5)).toBeNull();
  });

  it('una línea solo se coge por su trazo', () => {
    const linea = [
      ...roce(),
      member('L', 'p', 120, 150, 100, 0, { type: 'line', points: [[0, 0], [100, 0]], strokeWidth: 2, backgroundColor: 'transparent' }),
    ] as any[];
    // 8 de escena por debajo de la línea (4 px a zoom 0,5): A, aunque Excalidraw rozaría la línea.
    expect(pickVisible(linea, { selectedElementIds: {} }, { x: 170, y: 158 }, 0.5)?.id).toBe('A');
  });
});
