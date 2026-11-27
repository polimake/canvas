import { describe, it, expect } from 'vitest';
import { elementosParaExportar, recortesALaImagen } from '../src/core/recortes';

// Recortada sobre la vista previa de Media (1500 × 1000) y exportada con el
// original (4500 × 3000): el mismo trozo, en los píxeles del original.
const recortada = {
  id: 'r',
  type: 'image',
  fileId: 'f1',
  crop: { x: 150, y: 100, width: 600, height: 400, naturalWidth: 1500, naturalHeight: 1000 },
};
const entera = { id: 'e', type: 'image', fileId: 'f2', crop: null };

describe('los recortes, al tamaño de la imagen que se exporta', () => {
  it('reescala el recorte por la proporción original / vista previa, sin tocar el elemento', () => {
    const [r, e] = recortesALaImagen([recortada, entera], new Map([['f1', { width: 4500, height: 3000 }], ['f2', { width: 10, height: 10 }]]));
    expect(r.crop).toEqual({ x: 450, y: 300, width: 1800, height: 1200, naturalWidth: 4500, naturalHeight: 3000 });
    expect(recortada.crop.naturalWidth).toBe(1500);
    expect(e).toBe(entera);
  });

  it('a su mismo tamaño, o sin tamaño, se queda como estaba', () => {
    const [igual] = recortesALaImagen([recortada], new Map([['f1', { width: 1500, height: 1000 }]]));
    expect(igual).toBe(recortada);
    const [sin] = recortesALaImagen([recortada], new Map());
    expect(sin).toBe(recortada);
  });

  it('solo mide las recortadas, y la que no se deja medir conserva su recorte', async () => {
    const medidas: string[] = [];
    const medir = async (src: string) => {
      medidas.push(src);
      return src === 'blob:original' ? { width: 3000, height: 2000 } : null;
    };
    const otra = { ...recortada, id: 'o', fileId: 'f3' };
    const files = { f1: { dataURL: 'blob:original' }, f2: { dataURL: 'blob:entera' }, f3: { dataURL: 'blob:rota' } };
    const [r, e, o] = await elementosParaExportar([recortada, entera, otra], files, medir);
    expect(medidas.sort()).toEqual(['blob:original', 'blob:rota']);
    expect(r.crop?.width).toBe(1200);
    expect(e).toBe(entera);
    expect(o).toBe(otra);
  });
});
