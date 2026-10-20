import { describe, expect, it, vi } from 'vitest';
import { excalMock, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { pickOverSelection } = await import('../src/core/pick.js');

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
