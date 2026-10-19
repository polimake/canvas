import { describe, expect, it } from 'vitest';
import { emptySceneGate, sceneChange } from '../src/ui/editor/sceneGate';

const el = (id: string, version: number, versionNonce: number) => ({ id, x: 0, version, versionNonce });

describe('sceneChange: qué ticks de onChange llegan al host', () => {
  it('el primero siempre pasa', () => {
    expect(sceneChange(emptySceneGate(), [el('a', 1, 11)], '#fff')).not.toBeNull();
  });

  it('un tick de vista (mismo array, mismas versiones, mismo fondo) no pasa', () => {
    const elements = [el('a', 1, 11)];
    const gate = sceneChange(emptySceneGate(), elements, '#fff')!;
    expect(sceneChange(gate, elements, '#fff')).toBeNull();
  });

  // Lo que hace Excalidraw al mover con las flechas: `mutateElement` en el
  // sitio y `triggerUpdate()`. El array es el mismo; antes no salía.
  it('una mutación en el sitio (mismo array) pasa', () => {
    const elements = [el('a', 1, 11), el('b', 3, 33)];
    const gate = sceneChange(emptySceneGate(), elements, '#fff')!;
    Object.assign(elements[1], { x: 1, version: 4, versionNonce: 44 });
    const next = sceneChange(gate, elements, '#fff');
    expect(next).not.toBeNull();
    // Y el tick siguiente, ya sin cambios, vuelve a no pasar.
    expect(sceneChange(next!, elements, '#fff')).toBeNull();
  });

  it('un array nuevo o un fondo nuevo pasan', () => {
    const elements = [el('a', 1, 11)];
    const gate = sceneChange(emptySceneGate(), elements, '#fff')!;
    expect(sceneChange(gate, [...elements], '#fff')).not.toBeNull();
    expect(sceneChange(gate, elements, '#000')).not.toBeNull();
  });
});
