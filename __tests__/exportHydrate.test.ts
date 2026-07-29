import { describe, it, expect, vi } from 'vitest';
import { buildHydratedFiles } from '../src/exportHydrate';

/** API mínima de Excalidraw: solo lo que toca el módulo. */
function fakeApi(files: Record<string, { id: string; dataURL: string; mimeType: string }>) {
  const store = { ...files };
  return {
    getFiles: () => store,
    // Se expone a propósito para poder afirmar que NO se llama: `addFiles`
    // ignora los ids existentes, así que mutar la escena por ahí no funciona.
    addFiles: vi.fn(),
    _source: () => store,
  } as never;
}

const remoto = (id: string, url: string) => ({ id, dataURL: url, mimeType: 'image/webp' });
const blobDe = (txt: string) => new Blob([txt], { type: 'image/webp' });

describe('buildHydratedFiles()', () => {
  it('devuelve las URLs remotas convertidas a dataURL', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const fetcher = vi.fn().mockResolvedValue(blobDe('bytes'));

    const { files, hydrated, failed } = await buildHydratedFiles(api, fetcher);

    expect(hydrated).toBe(1);
    expect(failed).toEqual([]);
    expect(files.a.dataURL).toMatch(/^data:/);
    expect(fetcher).toHaveBeenCalledWith('https://cdn/x.webp');
  });

  it('NO muta la escena viva', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const src = (api as never as { _source: () => Record<string, { dataURL: string }> })._source();

    await buildHydratedFiles(api, async () => blobDe('bytes'));

    // La escena conserva la URL: si se guardara, no engordaría con base64.
    expect(src.a.dataURL).toBe('https://cdn/x.webp');
    // Y no se intenta por `addFiles`, que sería un no-op silencioso.
    expect((api as never as { addFiles: ReturnType<typeof vi.fn> }).addFiles).not.toHaveBeenCalled();
  });

  it('no toca los que ya son dataURL ni los pide', async () => {
    const api = fakeApi({ a: { id: 'a', dataURL: 'data:image/webp;base64,AAA', mimeType: 'image/webp' } });
    const fetcher = vi.fn();

    const { hydrated, files } = await buildHydratedFiles(api, fetcher);

    expect(hydrated).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(files.a.dataURL).toBe('data:image/webp;base64,AAA');
  });

  it('una imagen que falla no tumba el resto, y se reporta', async () => {
    const api = fakeApi({
      a: remoto('a', 'https://cdn/ok.webp'),
      b: remoto('b', 'https://cdn/roto.webp'),
    });
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('roto')) throw new Error('502');
      return blobDe('bytes');
    });

    const { files, hydrated, failed } = await buildHydratedFiles(api, fetcher);

    expect(hydrated).toBe(1);
    expect(failed).toEqual(['https://cdn/roto.webp']);
    expect(files.a.dataURL).toMatch(/^data:/);
    // La que falla se queda como estaba: exportar con ella contaminaría.
    expect(files.b.dataURL).toBe('https://cdn/roto.webp');
  });

  it('escena sin imágenes: mapa vacío y sin peticiones', async () => {
    const fetcher = vi.fn();
    const { files, hydrated, failed } = await buildHydratedFiles(fakeApi({}), fetcher);
    expect(hydrated).toBe(0);
    expect(failed).toEqual([]);
    expect(files).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('conserva el mimeType original cuando el blob no lo trae', async () => {
    const api = fakeApi({ a: { id: 'a', dataURL: 'https://cdn/x', mimeType: 'image/png' } });
    const { files } = await buildHydratedFiles(api, async () => new Blob(['x']));
    expect(files.a.dataURL.startsWith('data:image/png;base64,')).toBe(true);
  });
});
