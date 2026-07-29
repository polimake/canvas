import { describe, it, expect, vi } from 'vitest';
import { hydrateFilesForExport, withHydratedFiles } from '../src/exportHydrate';

/** API mínima de Excalidraw: solo lo que toca el módulo. */
function fakeApi(files: Record<string, { id: string; dataURL: string; mimeType: string }>) {
  let store = { ...files };
  return {
    getFiles: () => store,
    addFiles: (list: { id: string; dataURL: string }[]) => {
      for (const f of list) store = { ...store, [f.id]: { ...store[f.id], ...f } };
    },
    _snapshot: () => store,
  } as never;
}

const remoto = (id: string, url: string) => ({ id, dataURL: url, mimeType: 'image/webp' });
const blobDe = (txt: string) => new Blob([txt], { type: 'image/webp' });

describe('hydrateFilesForExport()', () => {
  it('cambia URLs remotas por dataURL', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const fetcher = vi.fn().mockResolvedValue(blobDe('bytes'));

    const res = await hydrateFilesForExport(api, fetcher);

    expect(res.hydrated).toBe(1);
    expect(res.failed).toEqual([]);
    expect((api as never as { _snapshot: () => never })._snapshot().a.dataURL).toMatch(/^data:/);
    expect(fetcher).toHaveBeenCalledWith('https://cdn/x.webp');
  });

  it('restore() devuelve el mapa original', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const snap = () => (api as never as { _snapshot: () => never })._snapshot();

    const res = await hydrateFilesForExport(api, async () => blobDe('bytes'));
    expect(snap().a.dataURL).toMatch(/^data:/);

    res.restore();
    expect(snap().a.dataURL).toBe('https://cdn/x.webp');
  });

  it('restore() es idempotente', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const res = await hydrateFilesForExport(api, async () => blobDe('bytes'));
    res.restore();
    res.restore();
    expect((api as never as { _snapshot: () => never })._snapshot().a.dataURL).toBe('https://cdn/x.webp');
  });

  it('no toca los que ya son dataURL', async () => {
    const api = fakeApi({ a: { id: 'a', dataURL: 'data:image/webp;base64,AAA', mimeType: 'image/webp' } });
    const fetcher = vi.fn();

    const res = await hydrateFilesForExport(api, fetcher);

    expect(res.hydrated).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('una imagen que falla no tumba el resto', async () => {
    const api = fakeApi({
      a: remoto('a', 'https://cdn/ok.webp'),
      b: remoto('b', 'https://cdn/roto.webp'),
    });
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('roto')) throw new Error('502');
      return blobDe('bytes');
    });

    const res = await hydrateFilesForExport(api, fetcher);

    expect(res.hydrated).toBe(1);
    expect(res.failed).toEqual(['https://cdn/roto.webp']);
    const snap = (api as never as { _snapshot: () => never })._snapshot();
    expect(snap.a.dataURL).toMatch(/^data:/);
    // La que falló se queda como estaba: se verá, pero contaminará el canvas.
    expect(snap.b.dataURL).toBe('https://cdn/roto.webp');
  });

  it('escena sin imágenes: no hace nada y no rompe', async () => {
    const api = fakeApi({});
    const res = await hydrateFilesForExport(api, vi.fn());
    expect(res.hydrated).toBe(0);
    expect(() => res.restore()).not.toThrow();
  });
});

describe('withHydratedFiles()', () => {
  it('restaura aunque el export lance', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const snap = () => (api as never as { _snapshot: () => never })._snapshot();

    await expect(
      withHydratedFiles(api, async () => blobDe('bytes'), async () => {
        expect(snap().a.dataURL).toMatch(/^data:/);
        throw new Error('export falló');
      }),
    ).rejects.toThrow('export falló');

    // Esto es lo importante: si no restaurase, la escena se guardaría con
    // base64 dentro y multiplicaría su tamaño.
    expect(snap().a.dataURL).toBe('https://cdn/x.webp');
  });

  it('devuelve el resultado del export', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const out = await withHydratedFiles(api, async () => blobDe('b'), async () => 'listo');
    expect(out).toBe('listo');
  });
});
