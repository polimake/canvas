// Regresión: soltar en el lienzo un archivo arrastrado desde la mediateca no
// hacía NADA cuando la biblioteca iba en modo gestión. La biblioteca marcaba el
// arrastre `effectAllowed = 'move'` (para poder apilar y mover entre carpetas) y
// el lienzo respondía `dropEffect = 'copy'`. Ese par es incompatible, así que el
// navegador se limitaba a no emitir `drop`: la zona se iluminaba, soltabas, y
// silencio. Insertar con un clic sí funcionaba, lo que despistaba todavía más.
import { describe, it, expect } from 'vitest';
import { copyDropEffect } from '../src/ui/dropEffect';

describe('copyDropEffect', () => {
  it('cede a mover cuando el origen no admite copiar', () => {
    // El caso del fallo: aquí devolver 'copy' anula el arrastre entero.
    expect(copyDropEffect('move')).toBe('move');
    expect(copyDropEffect('linkMove')).toBe('move');
  });

  it('copia siempre que el origen lo admita', () => {
    for (const allowed of ['copy', 'copyMove', 'copyLink', 'all', 'uninitialized']) {
      expect(copyDropEffect(allowed)).toBe('copy');
    }
  });

  it('copia también sin `effectAllowed`', () => {
    // jsdom y algunos navegadores dejan la propiedad vacía; no es motivo para
    // rechazar el arrastre.
    expect(copyDropEffect(undefined)).toBe('copy');
    expect(copyDropEffect('')).toBe('copy');
  });
});
