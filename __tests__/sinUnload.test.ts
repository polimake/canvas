import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Excalidraw registraba un listener de `unload` en `window`. Chrome ya no lo
// permite: en Studio salía «Permissions policy violation: unload» en la consola
// del lienzo (21/11) y la página dejaba de entrar en el bfcache. Su `onUnload`
// solo suelta el estado de teclado (`onBlur`), así que va en `pagehide`.
const raiz = join(__dirname, '..');
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8');

describe('Excalidraw sin listener de unload', () => {
  it('el paquete compilado que usan Studio y desktop escucha pagehide', () => {
    const js = leer('vendor/excalidraw-dist/dist/prod/index.js');
    expect(js).not.toMatch(/\(window,"unload",/);
    expect(js).toContain('(window,"pagehide",this.onUnload,!1)');
  });

  it('el fuente lleva el mismo parche', () => {
    const app = leer('vendor/excalidraw/packages/excalidraw/components/App.tsx');
    expect(app).not.toContain('EVENT.UNLOAD');
    expect(app).toContain('addEventListener(window, EVENT.PAGEHIDE, this.onUnload, false)');
  });
});
