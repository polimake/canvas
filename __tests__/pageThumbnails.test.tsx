// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/excal', () => excalMock);

/**
 * `exportScenePng` se mockea porque rasterizar de verdad necesita un canvas con
 * WebGL, que jsdom no tiene. Lo que se prueba aquí no es el rasterizado sino
 * CUÁNDO se decide rasterizar — que es donde estaba el fallo.
 */
const exportScenePng = vi.fn();
vi.mock('../src/export', () => ({
  exportScenePng: (...args: unknown[]) => exportScenePng(...args),
}));

const { usePageThumbnails } = await import('../src/pageThumbnails.js');

const blob = () => new Blob(['x'], { type: 'image/png' });

beforeEach(() => {
  exportScenePng.mockReset();
  exportScenePng.mockResolvedValue(blob());
  // jsdom no implementa las URL de objeto.
  globalThis.URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  // Sin `globals: true`, testing-library no registra su limpieza automática.
  cleanup();
  vi.useRealTimers();
});

describe('usePageThumbnails', () => {
  it('rasteriza una miniatura por página', async () => {
    const { api } = fakeApi([frame('a', 0, 0, 500, 500), frame('b', 660, 0, 500, 500)]);
    const { result } = renderHook(() => usePageThumbnails(api as never, { enabled: true }));

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(2));
    expect(exportScenePng).toHaveBeenCalledTimes(2);
  });

  it('no rerasteriza si la escena no cambia', async () => {
    const { api } = fakeApi([frame('a', 0, 0, 500, 500)]);
    renderHook(() => usePageThumbnails(api as never, { enabled: true }));

    await waitFor(() => expect(exportScenePng).toHaveBeenCalledTimes(1));
    // Varios latidos del intervalo sin tocar nada.
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(exportScenePng).toHaveBeenCalledTimes(1);
  });

  /**
   * EL FALLO QUE ESTE FICHERO EXISTE PARA IMPEDIR.
   *
   * Al montar, el mapa hidratado todavía no ha llegado y rasterizar revienta por
   * canvas contaminado. El `catch` marcaba la página como hecha para no
   * rasterizar en bucle — pero cuando la hidratación llegaba, la huella seguía
   * siendo la misma, se saltaba todas las páginas y las miniaturas no aparecían
   * NUNCA. Ahora la identidad del mapa entra en la huella.
   */
  it('reintenta cuando llegan los ficheros hidratados tras haber fallado', async () => {
    const { api } = fakeApi([frame('a', 0, 0, 500, 500)]);
    exportScenePng.mockRejectedValueOnce(new Error('Tainted canvases'));

    const { result, rerender } = renderHook(
      ({ files }) => usePageThumbnails(api as never, { enabled: true, files }),
      { initialProps: { files: undefined as Record<string, unknown> | undefined } },
    );

    await waitFor(() => expect(exportScenePng).toHaveBeenCalledTimes(1));
    expect(Object.keys(result.current)).toHaveLength(0);

    rerender({ files: { f1: { id: 'f1' } } });

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    expect(exportScenePng).toHaveBeenCalledTimes(2);
  });

  it('un mapa nuevo con las MISMAS claves no dispara otra rasterización', async () => {
    // El host publica un objeto nuevo en cada captura (cada 10 s). Si la huella
    // dependiera de su identidad, se rerasterizaría todo en cada latido.
    const { api } = fakeApi([frame('a', 0, 0, 500, 500)]);
    const { rerender } = renderHook(
      ({ files }) => usePageThumbnails(api as never, { enabled: true, files }),
      { initialProps: { files: { f1: { id: 'f1' } } as Record<string, unknown> } },
    );

    await waitFor(() => expect(exportScenePng).toHaveBeenCalledTimes(1));
    rerender({ files: { f1: { id: 'f1' } } }); // mismo contenido, otro objeto
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(exportScenePng).toHaveBeenCalledTimes(1);
  });

  it('apagado no rasteriza nada', async () => {
    const { api } = fakeApi([frame('a', 0, 0, 500, 500)]);
    renderHook(() => usePageThumbnails(api as never, { enabled: false }));
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(exportScenePng).not.toHaveBeenCalled();
  });
});
