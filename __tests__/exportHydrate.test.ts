import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildHydratedFiles, clearHydrationCache } from '../src/exportHydrate';

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

/**
 * Los tests fuerzan `preferProxy` porque lo que se prueba es el contrato del
 * módulo, no el fetch directo: sin él, cada caso intentaría una petición CORS
 * real contra un host inventado antes de caer al `fetcher` de mentira.
 */
const PROXY = { preferProxy: true } as const;

describe('buildHydratedFiles()', () => {
  // La caché de bytes vive en el módulo: sin vaciarla, un test se comería la
  // petición de otro y el orden de ejecución pasaría a importar.
  beforeEach(() => clearHydrationCache());

  it('por defecto entrega un blob: (same-origin, sin pasar por base64)', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const fetcher = vi.fn().mockResolvedValue(blobDe('bytes'));

    const { files, hydrated, failed } = await buildHydratedFiles(api, fetcher, PROXY);

    expect(hydrated).toBe(1);
    expect(failed).toEqual([]);
    // Un `blob:` no contamina el canvas y evita inflar un 33% con base64.
    expect(files.a.dataURL).toMatch(/^blob:/);
    expect(fetcher).toHaveBeenCalledWith('https://cdn/x.webp');
  });

  it('con output dataurl entrega base64, que es lo que necesita el SVG', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const fetcher = vi.fn().mockResolvedValue(blobDe('bytes'));

    const { files, hydrated } = await buildHydratedFiles(api, fetcher, {
      ...PROXY,
      output: 'dataurl',
    });

    expect(hydrated).toBe(1);
    // En un SVG los bytes viajan dentro del fichero: un blob: moriría con la pestaña.
    expect(files.a.dataURL).toMatch(/^data:image\/webp;base64,/);
  });

  it('NO muta la escena viva', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/x.webp') });
    const src = (api as never as { _source: () => Record<string, { dataURL: string }> })._source();

    await buildHydratedFiles(api, async () => blobDe('bytes'), PROXY);

    // La escena conserva la URL: si se guardara, no engordaría con base64.
    expect(src.a.dataURL).toBe('https://cdn/x.webp');
    // Y no se intenta por `addFiles`, que sería un no-op silencioso.
    expect((api as never as { addFiles: ReturnType<typeof vi.fn> }).addFiles).not.toHaveBeenCalled();
  });

  it('no toca los que ya son dataURL ni los pide', async () => {
    const api = fakeApi({ a: { id: 'a', dataURL: 'data:image/webp;base64,AAA', mimeType: 'image/webp' } });
    const fetcher = vi.fn();

    const { hydrated, files } = await buildHydratedFiles(api, fetcher, PROXY);

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

    const { files, hydrated, failed } = await buildHydratedFiles(api, fetcher, PROXY);

    expect(hydrated).toBe(1);
    expect(failed).toEqual(['https://cdn/roto.webp']);
    expect(files.a.dataURL).toMatch(/^blob:/);
    // La que falla se queda como estaba: exportar con ella contaminaría.
    expect(files.b.dataURL).toBe('https://cdn/roto.webp');
  });

  it('escena sin imágenes: mapa vacío y sin peticiones', async () => {
    const fetcher = vi.fn();
    const { files, hydrated, failed } = await buildHydratedFiles(fakeApi({}), fetcher, PROXY);
    expect(hydrated).toBe(0);
    expect(failed).toEqual([]);
    expect(files).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('conserva el mimeType original cuando el blob no lo trae', async () => {
    const api = fakeApi({ a: { id: 'a', dataURL: 'https://cdn/x', mimeType: 'image/png' } });
    const { files } = await buildHydratedFiles(api, async () => new Blob(['x']), PROXY);
    expect(files.a.mimeType).toBe('image/png');
  });

  it('en dataurl, el mimeType de respaldo acaba en la propia cadena', async () => {
    const api = fakeApi({ a: { id: 'a', dataURL: 'https://cdn/x', mimeType: 'image/png' } });
    const { files } = await buildHydratedFiles(api, async () => new Blob(['x']), {
      ...PROXY,
      output: 'dataurl',
    });
    expect(files.a.dataURL.startsWith('data:image/png;base64,')).toBe(true);
  });

  // ─── Caché de bytes ────────────────────────────────────────────────────────
  // `useCanvas2LivePreview` rehidrata tras CUALQUIER edición. Sin caché eso
  // volvía a bajar y recodificar la escena entera cada 10 s, que es lo que
  // atascaba el lienzo con fotos grandes.

  it('no vuelve a pedir una URL ya hidratada', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/foto.webp') });
    const fetcher = vi.fn().mockResolvedValue(blobDe('bytes'));

    const primera = await buildHydratedFiles(api, fetcher, PROXY);
    const segunda = await buildHydratedFiles(api, fetcher, PROXY);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(segunda.hydrated).toBe(1);
    expect(segunda.files.a.dataURL).toBe(primera.files.a.dataURL);
  });

  it('solo pide las imágenes NUEVAS de la escena', async () => {
    const fetcher = vi.fn().mockResolvedValue(blobDe('bytes'));
    await buildHydratedFiles(fakeApi({ a: remoto('a', 'https://cdn/1.webp') }), fetcher, PROXY);

    const conDosMas = fakeApi({
      a: remoto('a', 'https://cdn/1.webp'),
      b: remoto('b', 'https://cdn/2.webp'),
    });
    const { hydrated } = await buildHydratedFiles(conDosMas, fetcher, PROXY);

    expect(hydrated).toBe(2);
    // La primera ya estaba: solo se pide la segunda.
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith('https://cdn/2.webp');
  });

  it('un fallo NO se cachea: se reintenta y puede recuperarse', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/intermitente.webp') });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('403'))
      .mockResolvedValueOnce(blobDe('bytes'));

    const roto = await buildHydratedFiles(api, fetcher, PROXY);
    expect(roto.failed).toEqual(['https://cdn/intermitente.webp']);

    // Un 403 puede ser una allowlist recién desplegada; fijarlo obligaría a
    // recargar la página para volver a ver la imagen.
    const bueno = await buildHydratedFiles(api, fetcher, PROXY);
    expect(bueno.hydrated).toBe(1);
    expect(bueno.failed).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('clearHydrationCache() obliga a volver a pedirlas', async () => {
    const api = fakeApi({ a: remoto('a', 'https://cdn/foto.webp') });
    const fetcher = vi.fn().mockResolvedValue(blobDe('bytes'));

    await buildHydratedFiles(api, fetcher, PROXY);
    clearHydrationCache();
    await buildHydratedFiles(api, fetcher, PROXY);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
